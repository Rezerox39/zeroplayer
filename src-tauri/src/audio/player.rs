use crate::library::Track;
use rodio::OutputStream;
use serde::{Deserialize, Serialize};

use std::sync::atomic::{AtomicU32, AtomicU8};
use std::sync::Mutex;
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

/// Non-Send wrapper for rodio OutputStream (which holds cpal::Stream, !Send).
#[derive(Debug)]
pub struct NonSend<T>(pub T);
unsafe impl<T> Send for NonSend<T> {}


/// Audio state that is Send + Sync (safe to use in AppState).
pub struct AudioState {
    pub stream: Mutex<Option<NonSend<OutputStream>>>,
    pub sink: Mutex<Option<rodio::Sink>>,
    pub status: std::sync::atomic::AtomicU8,
    pub position_start: Mutex<Option<PositionTracker>>,
    pub volume: std::sync::atomic::AtomicU32,
    pub speed: std::sync::atomic::AtomicU32,
    pub current_track: Mutex<Option<Track>>,
}

pub struct PositionTracker {
    started_at: Instant,
    base_position: f64,
    playing: bool,
}

impl PositionTracker {
    fn new() -> Self {
        Self {
            started_at: Instant::now(),
            base_position: 0.0,
            playing: false,
        }
    }

    fn current(&self) -> f64 {
        if self.playing {
            self.base_position + self.started_at.elapsed().as_secs_f64()
        } else {
            self.base_position
        }
    }

    fn start(&mut self, from: f64) {
        self.base_position = from;
        self.started_at = Instant::now();
        self.playing = true;
    }

    fn pause(&mut self) {
        if self.playing {
            self.base_position = self.current();
            self.playing = false;
        }
    }

    fn seek(&mut self, to: f64) {
        self.base_position = to;
        if self.playing {
            self.started_at = Instant::now();
        }
    }
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            stream: Mutex::new(None),
            sink: Mutex::new(None),
            status: AtomicU8::new(0), // 0=stopped, 1=playing, 2=paused
            position_start: Mutex::new(Some(PositionTracker::new())),
            volume: AtomicU32::new((0.8f32 * 1000.0) as u32),
            speed: AtomicU32::new((1.0f32 * 1000.0) as u32),
            current_track: Mutex::new(None),
        }
    }

    pub fn play_file(&self, track: &Track) -> Result<(), String> {
        let file_path = track
            .file_path
            .as_ref()
            .ok_or("No file path for track")?;

        let (stream, handle) = OutputStream::try_default()
            .map_err(|e| format!("Failed to open audio device: {}", e))?;

        let sink = rodio::Sink::try_new(&handle)
            .map_err(|e| format!("Failed to create sink: {}", e))?;

        let file =
            std::fs::File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
        let source = rodio::Decoder::new(file)
            .map_err(|e| format!("Failed to decode audio: {}", e))?;

        let vol = f32::from_bits(self.volume.load(std::sync::atomic::Ordering::Relaxed));
        sink.set_volume(vol);

        sink.append(source);

        // Store stream, sink, track
        *self.stream.lock().unwrap() = Some(NonSend(stream));
        *self.sink.lock().unwrap() = Some(sink);
        *self.current_track.lock().unwrap() = Some(track.clone());
        self.status
            .store(1, std::sync::atomic::Ordering::Relaxed);

        // Reset position tracker
        let tracker = PositionTracker::new();
        *self.position_start.lock().unwrap() = Some(tracker);

        Ok(())
    }

    pub fn pause(&self) {
        let sink = self.sink.lock().unwrap();
        if let Some(s) = sink.as_ref() {
            s.pause();
        }
        self.status
            .store(2, std::sync::atomic::Ordering::Relaxed);
        if let Some(tracker) = self.position_start.lock().unwrap().as_mut() {
            tracker.pause();
        }
    }

    pub fn resume(&self) {
        let sink = self.sink.lock().unwrap();
        if let Some(s) = sink.as_ref() {
            s.play();
        }
        self.status
            .store(1, std::sync::atomic::Ordering::Relaxed);
        if let Some(tracker) = self.position_start.lock().unwrap().as_mut() {
            let pos = tracker.current();
            tracker.start(pos);
        }
    }

    pub fn stop(&self) {
        let mut sink_opt = self.sink.lock().unwrap();
        let mut stream_opt = self.stream.lock().unwrap();
        if let Some(sink) = sink_opt.take() {
            sink.stop();
        }
        *stream_opt = None;
        *self.current_track.lock().unwrap() = None;
        self.status
            .store(0, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn position(&self) -> f64 {
        self.position_start
            .lock()
            .unwrap()
            .as_ref()
            .map(|t| t.current())
            .unwrap_or(0.0)
    }

    pub fn status(&self) -> PlayerStatus {
        match self.status.load(std::sync::atomic::Ordering::Relaxed) {
            1 => PlayerStatus::Playing,
            2 => PlayerStatus::Paused,
            _ => PlayerStatus::Stopped,
        }
    }

    pub fn volume_f32(&self) -> f32 {
        f32::from_bits(self.volume.load(std::sync::atomic::Ordering::Relaxed))
    }

    pub fn speed_f32(&self) -> f32 {
        f32::from_bits(self.speed.load(std::sync::atomic::Ordering::Relaxed))
    }

    pub fn set_volume(&self, v: f32) {
        let v = v.clamp(0.0, 1.0);
        self.volume
            .store(v.to_bits(), std::sync::atomic::Ordering::Relaxed);
        if let Some(sink) = self.sink.lock().unwrap().as_ref() {
            sink.set_volume(v);
        }
    }

    pub fn state(&self) -> PlaybackState {
        PlaybackState {
            status: self.status(),
            current_track: self.current_track.lock().unwrap().clone(),
            position_secs: self.position(),
            duration_secs: self
                .current_track
                .lock()
                .unwrap()
                .as_ref()
                .and_then(|t| t.duration)
                .unwrap_or(0.0),
            volume: self.volume_f32(),
            speed: self.speed_f32(),
        }
    }
}
