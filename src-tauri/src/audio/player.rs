use crate::library::Track;
use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};
use serde::{Deserialize, Serialize};
use std::io::BufReader;
use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PlayerStatus {
    Stopped,
    Playing,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    pub status: PlayerStatus,
    pub current_track: Option<Track>,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub volume: f32,
    pub speed: f32,
}

enum AudioCommand {
    #[allow(dead_code)]
    Play(String),
    Pause,
    Resume,
    Stop,
    SetVolume(f32),
    Seek(f64),
}

pub struct AudioState {
    pub status: AtomicU8,
    pub current_track: Mutex<Option<Track>>,
    pub position: Mutex<f64>,
    pub duration: Mutex<f64>,
    pub volume: AtomicU32,
    pub speed: AtomicU32,
    cmd_tx: mpsc::Sender<AudioCommand>,
}

impl AudioState {
    /// Create the AudioState and spawn the dedicated audio thread.
    /// The OutputStream is created ON that thread and lives there.
    pub fn new() -> Arc<Self> {
        let (cmd_tx, cmd_rx) = mpsc::channel::<AudioCommand>();

        let state = Arc::new(Self {
            status: AtomicU8::new(0),
            current_track: Mutex::new(None),
            position: Mutex::new(0.0),
            duration: Mutex::new(0.0),
            volume: AtomicU32::new((0.8f32).to_bits()),
            speed: AtomicU32::new((1.0f32).to_bits()),
            cmd_tx,
        });

        let state_for_thread = Arc::clone(&state);
        thread::Builder::new()
            .name("zeroplayer-audio".to_string())
            .spawn(move || run_audio_loop(cmd_rx, state_for_thread))
            .expect("Failed to spawn audio thread");

        state
    }

    pub fn play_file(&self, track: &Track) -> Result<(), String> {
        let path = track
            .file_path
            .as_ref()
            .ok_or_else(|| "No file path for track".to_string())?;

        // Actual audio playback is handled by HTML5 Audio in the frontend.
        // The rodio backend only tracks state so get_playback_state stays in sync.
        let _ = path;
        *self.current_track.lock().unwrap() = Some(track.clone());
        *self.duration.lock().unwrap() = track.duration.unwrap_or(0.0);
        *self.position.lock().unwrap() = 0.0;
        self.status.store(1, Ordering::Relaxed);
        Ok(())
    }

    pub fn pause(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Pause);
        self.status.store(2, Ordering::Relaxed);
    }

    pub fn resume(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Resume);
        self.status.store(1, Ordering::Relaxed);
    }

    pub fn stop(&self) {
        let _ = self.cmd_tx.send(AudioCommand::Stop);
        self.status.store(0, Ordering::Relaxed);
        *self.position.lock().unwrap() = 0.0;
    }

    pub fn set_volume(&self, v: f32) {
        let v = v.clamp(0.0, 1.0);
        self.volume.store(v.to_bits(), Ordering::Relaxed);
        let _ = self.cmd_tx.send(AudioCommand::SetVolume(v));
    }

    pub fn seek(&self, pos: f64) {
        *self.position.lock().unwrap() = pos.max(0.0);
        // Note: rodio doesn't support seeking mid-stream; HTML5 Audio handles real seek.
        // If playback hasn't started, update the base position.
        let _ = self.cmd_tx.send(AudioCommand::Seek(pos.max(0.0)));
    }

    pub fn set_speed(&self, s: f32) {
        let s = if s <= 0.0 { 1.0 } else { s };
        self.speed.store(s.to_bits(), Ordering::Relaxed);
    }

    pub fn state(&self) -> PlaybackState {
        PlaybackState {
            status: match self.status.load(Ordering::Relaxed) {
                1 => PlayerStatus::Playing,
                2 => PlayerStatus::Paused,
                _ => PlayerStatus::Stopped,
            },
            current_track: self.current_track.lock().unwrap().clone(),
            position_secs: *self.position.lock().unwrap(),
            duration_secs: *self.duration.lock().unwrap(),
            volume: f32::from_bits(self.volume.load(Ordering::Relaxed)),
            speed: f32::from_bits(self.speed.load(Ordering::Relaxed)),
        }
    }
}

fn run_audio_loop(cmd_rx: mpsc::Receiver<AudioCommand>, state: Arc<AudioState>) {
    let (_stream, handle): (OutputStream, OutputStreamHandle) = match OutputStream::try_default() {
        Ok(sh) => sh,
        Err(e) => {
            log::error!("Audio: failed to open output device: {}", e);
            return;
        }
    };
    log::info!("Audio: thread started, output device ready");

    let mut sink: Option<Sink> = None;
    let mut paused = false;
    let mut start_instant: Option<Instant> = None;
    let mut base_position: f64 = 0.0;

    loop {
        // Update position while playing
        if !paused {
            if let Some(st) = start_instant {
                let pos = base_position + st.elapsed().as_secs_f64();
                *state.position.lock().unwrap() = pos;
            }
        }

        // Check if sink has finished playback
        if let Some(s) = &sink {
            if s.empty() && start_instant.is_some() {
                log::info!("Audio: track finished");
                state.status.store(0, Ordering::Relaxed);
                *state.position.lock().unwrap() = 0.0;
                sink = None;
                start_instant = None;
                base_position = 0.0;
            }
        }

        match cmd_rx.try_recv() {
            Ok(cmd) => match cmd {
                AudioCommand::Play(path) => {
                    if let Some(s) = sink.take() {
                        s.stop();
                    }
                    let file = match std::fs::File::open(&path) {
                        Ok(f) => f,
                        Err(e) => {
                            log::error!("Audio: open error {}: {}", path, e);
                            continue;
                        }
                    };
                    let source = match Decoder::new(BufReader::new(file)) {
                        Ok(s) => s,
                        Err(e) => {
                            log::error!("Audio: decode error {}: {}", path, e);
                            continue;
                        }
                    };
                    match Sink::try_new(&handle) {
                        Ok(s) => {
                            let vol = f32::from_bits(state.volume.load(Ordering::Relaxed));
                            s.set_volume(vol);
                            s.append(source);
                            s.play();
                            sink = Some(s);
                            paused = false;
                            start_instant = Some(Instant::now());
                            base_position = 0.0;
                            *state.position.lock().unwrap() = 0.0;
                            state.status.store(1, Ordering::Relaxed);
                            log::info!("Audio: playing {}", path);
                        }
                        Err(e) => {
                            log::error!("Audio: sink error: {}", e);
                        }
                    }
                }
                AudioCommand::Pause => {
                    if let Some(s) = &sink {
                        s.pause();
                    }
                    if let Some(st) = start_instant {
                        base_position += st.elapsed().as_secs_f64();
                    }
                    start_instant = None;
                    paused = true;
                }
                AudioCommand::Resume => {
                    if let Some(s) = &sink {
                        s.play();
                    }
                    start_instant = Some(Instant::now());
                    paused = false;
                }
                AudioCommand::Stop => {
                    if let Some(s) = sink.take() {
                        s.stop();
                    }
                    start_instant = None;
                    base_position = 0.0;
                    *state.position.lock().unwrap() = 0.0;
                    state.status.store(0, Ordering::Relaxed);
                }
                AudioCommand::SetVolume(v) => {
                    if let Some(s) = &sink {
                        s.set_volume(v);
                    }
                }
                AudioCommand::Seek(pos) => {
                    base_position = pos;
                    start_instant = Some(Instant::now());
                    *state.position.lock().unwrap() = pos;
                }
            },
            Err(mpsc::TryRecvError::Empty) => {}
            Err(mpsc::TryRecvError::Disconnected) => break,
        }

        thread::sleep(std::time::Duration::from_millis(50));
    }
}
