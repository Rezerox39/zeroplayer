import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  playTrack,
  pausePlayback,
  resumePlayback,
  cmdNextTrack,
  cmdPreviousTrack,
  cmdToggleShuffle,
  downloadTrack,
  setVolume as cmdSetVolume,
  fileUrl,
} from '../../lib/tauri';
import type { Track } from '../../types';

function formatTime(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player() {
  const { playback, setPlayback, setCurrentSrc, currentSrc, shuffled, setShuffled } = usePlayerStore();
  const [localPos, setLocalPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dlState, setDlState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [dlMsg, setDlMsg] = useState('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const track = playback.current_track;

  // Keep localPos synced with store when not dragging
  useEffect(() => {
    if (!dragging) setLocalPos(playback.position_secs || 0);
  }, [playback.position_secs, dragging]);

  // --- HTML5 Audio element lifecycle ---
  // On src change, load and play
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSrc) return;
    audio.src = currentSrc;
    audio.load();
    audio.play().catch(() => {});
  }, [currentSrc]);

  // Play a track: invoke backend to resolve file (downloads YT via yt-dlp),
  // then set src and state. Defensive: null-check everything.
  const playTrackFromInvoke = useCallback(async (t: Track) => {
    try {
      const result: any = await playTrack(t);
      const fp: string | undefined = result?.file_path || t.file_path;
      const src = fp ? fileUrl(fp) : undefined;
      setCurrentSrc(src || null);
      if (result?.state) {
        setPlayback(result.state);
      } else {
        // Fallback in case backend returns flat object (old builds)
        const { state, file_path, ...rest } = result;
        if (result && 'status' in result) {
          setPlayback(result as any);
        } else if (state && 'status' in state) {
          setPlayback(state);
        }
      }
    } catch (e: any) {
      console.error('Play error:', e);
    }
  }, [setPlayback, setCurrentSrc]);

  const handleNext = useCallback(async () => {
    try {
      const t = await cmdNextTrack();
      if (t) {
        await playTrackFromInvoke(t);
      } else {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
        setLocalPos(0);
        setPlayback({ ...usePlayerStore.getState().playback, status: 'stopped', position_secs: 0 });
        setCurrentSrc(null);
      }
    } catch (e: any) {
      console.error('Next error:', e);
    }
  }, [playTrackFromInvoke, setPlayback, setCurrentSrc]);

  // Sync HTML5 Audio time → store position (real time, no fake ticker)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (!dragging) {
        setLocalPos(audio.currentTime);
        usePlayerStore.getState().updatePosition(audio.currentTime);
      }
    };
    const onLoadedMetadata = () => {
      const dur = audio.duration || 0;
      if (isFinite(dur)) {
        usePlayerStore.getState().setPlayback({
          ...usePlayerStore.getState().playback,
          duration_secs: dur,
        });
      }
    };
    const onEnded = () => {
      handleNext();
    };
    const onError = (e: Event) => {
      console.error('Audio error', (e.target as HTMLAudioElement).error);
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [dragging, handleNext]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = playback.volume;
    }
  }, [playback.volume]);

  // Sync play/pause with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSrc) return;
    if (playback.status === 'playing') {
      audio.play().catch(() => {});
    } else if (playback.status === 'paused') {
      audio.pause();
    }
  }, [playback.status, currentSrc]);

  const handlePlayPause = useCallback(async () => {
    if (playback.status === 'playing') {
      audioRef.current?.pause();
      await pausePlayback();
      setPlayback({ ...usePlayerStore.getState().playback, status: 'paused' });
    } else {
      audioRef.current?.play().catch(() => {});
      await resumePlayback();
      setPlayback({ ...usePlayerStore.getState().playback, status: 'playing' });
    }
  }, [playback.status, setPlayback]);

  const handlePrev = useCallback(async () => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setLocalPos(0);
      return;
    }
    try {
      const t = await cmdPreviousTrack();
      if (t) {
        await playTrackFromInvoke(t);
      }
    } catch (e: any) {
      console.error('Prev error:', e);
    }
  }, [playTrackFromInvoke]);

  const handleToggleShuffle = useCallback(async () => {
    try {
      const on = await cmdToggleShuffle();
      setShuffled(on);
    } catch (e: any) {
      console.error('Shuffle error:', e);
    }
  }, [setShuffled]);

  const handleDownload = useCallback(async (t: Track | undefined) => {
    if (!t) return;
    setDlState('working');
    setDlMsg('');
    try {
      const path = await downloadTrack(t);
      setDlState('done');
      setDlMsg(path);
      setTimeout(() => setDlState('idle'), 4000);
    } catch (e: any) {
      setDlState('error');
      setDlMsg(String(e));
      setTimeout(() => setDlState('idle'), 5000);
    }
  }, []);

  // Seek by clicking on the progress bar
  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true);
    applySeek(e);
  };

  const applySeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * (playback.duration_secs || 0);
    setLocalPos(newTime);
    if (audioRef.current && isFinite(newTime)) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Drag seek via window listeners while dragging
  useEffect(() => {
    if (!dragging) return;
    const bar = document.getElementById('seek-bar');
    if (!bar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const newTime = pct * (playback.duration_secs || 0);
      setLocalPos(newTime);
      if (audioRef.current && isFinite(newTime)) {
        audioRef.current.currentTime = newTime;
      }
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, playback.duration_secs]);

  // Volume via click on volume bar
  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const vol = Math.round(pct * 100) / 100;
    cmdSetVolume(vol);
    usePlayerStore.getState().setPlayback({
      ...usePlayerStore.getState().playback,
      volume: vol,
    });
  };

  const coverSrc = fileUrl(track?.cover_path);

  return (
    <>
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="auto" />

      <div className="h-20 flex-shrink-0 bg-surface-1 border-t border-surface-3 flex items-center px-5 gap-5">
        {/* Track info + cover art */}
        <div className="w-56 flex items-center gap-3 overflow-hidden">
          {coverSrc ? (
            <img src={coverSrc} alt="" className="w-11 h-11 rounded-sm object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-sm bg-surface-3 flex items-center justify-center font-mono text-lg text-gray-600">
              ♫
            </div>
          )}
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              {playback.status === 'playing' && (
                <span className="eq" title="playing">
                  <span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" /><span className="eq-bar" />
                </span>
              )}
              <div className="font-mono text-xs text-gray-200 truncate">{track?.title || 'No track'}</div>
            </div>
            <div className="font-mono text-[10px] text-gray-500 truncate">{track?.artist || ''}</div>
          </div>
        </div>

        {/* Controls + seek */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-5">
            <button
              onClick={handleToggleShuffle}
              className={`transition-colors text-sm ${shuffled ? 'accent-text' : 'text-gray-400 hover:text-white'}`}
              title="Shuffle"
            >
              ⤨
            </button>
            <button onClick={handlePrev} className="text-gray-400 hover:text-white transition-colors text-sm" title="Previous">▮◄</button>
            <button
              onClick={handlePlayPause}
              className="accent-text text-xl hover:opacity-80 transition-opacity"
              title={playback.status === 'playing' ? 'Pause' : 'Play'}
            >
              {playback.status === 'playing' ? '▮▮' : '►'}
            </button>
            <button onClick={handleNext} className="text-gray-400 hover:text-white transition-colors text-sm" title="Next">►▮</button>
          </div>
          <div className="w-full max-w-xl flex items-center gap-2">
            <span className="font-mono text-[10px] text-gray-500 w-10 text-right">{formatTime(localPos)}</span>
            <div
              id="seek-bar"
              className="flex-1 h-1 bg-surface-3 rounded-full cursor-pointer group relative"
              onMouseDown={handleSeekStart}
            >
              <div
                className="h-full rounded-full transition-[width] duration-75"
                style={{
                  width: `${playback.duration_secs ? (localPos / playback.duration_secs) * 100 : 0}%`,
                  backgroundColor: 'var(--accent)',
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-gray-500 w-10">{formatTime(playback.duration_secs)}</span>
          </div>
        </div>

        {/* Download + Volume */}
        <div className="w-52 flex items-center gap-3 justify-end">
          <button
            onClick={() => handleDownload(track)}
            disabled={!track || dlState === 'working'}
            className={`text-sm transition-colors disabled:opacity-40 ${dlState === 'error' ? 'text-red-500' : 'text-gray-400 hover:text-[var(--accent)]'}`}
            title={dlMsg || 'Download to app downloads folder'}
          >
            {dlState === 'working' ? '…' : '⬇'}
          </button>
          <span className="font-mono text-[10px] text-gray-600">
            {playback.volume > 0 ? `${Math.round(playback.volume * 100)}%` : 'vol'}
          </span>
          <div className="w-20 h-1 bg-surface-3 rounded-full cursor-pointer" onClick={handleVolumeChange}>
            <div
              className="h-full rounded-full"
              style={{ width: `${playback.volume * 100}%`, backgroundColor: 'var(--accent)' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
