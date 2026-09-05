import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { playTrack, pausePlayback, resumePlayback, cmdNextTrack, cmdPreviousTrack, setVolume as cmdSetVolume, fileUrl } from '../../lib/tauri';
import type { Track } from '../../types';

function formatTime(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player() {
  const { playback, setPlayback, setCurrentSrc, setLyrics, queue, repeatMode, currentSrc } = usePlayerStore();
  const [localPos, setLocalPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const track = playback.current_track;

  // Keep localPos synced with store when not dragging
  useEffect(() => {
    if (!dragging) setLocalPos(playback.position_secs);
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
      // Auto-next or stop
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
  }, [dragging]);

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
      setPlayback({ ...playback, status: 'paused' });
    } else {
      audioRef.current?.play().catch(() => {});
      await resumePlayback();
      setPlayback({ ...playback, status: 'playing' });
    }
  }, [playback, setPlayback]);

  const playTrackAsync = useCallback(async (t: Track) => {
    try {
      const result = await playTrack(t);
      // result: { state: PlaybackState, file_path?: string }
      const fp = (result as any).file_path || t.file_path;
      const src = fileUrl(fp);
      setCurrentSrc(src || null);
      setPlayback(result.state);
    } catch (e: any) {
      console.error('Play error', e);
    }
  }, [setPlayback, setCurrentSrc]);

  const handleNext = useCallback(async () => {
    const t = await cmdNextTrack();
    if (t) {
      await playTrackAsync(t);
    } else {
      // No next track — stop
      audioRef.current?.pause();
      audioRef.current!.currentTime = 0;
      setLocalPos(0);
      setPlayback({ ...playback, status: 'stopped', position_secs: 0 });
      setCurrentSrc(null);
    }
  }, [setPlayback, setCurrentSrc, playback, playTrackAsync]);

  const handlePrev = useCallback(async () => {
    // If more than 3s in, restart current track; otherwise go to previous
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setLocalPos(0);
      return;
    }
    const t = await cmdPreviousTrack();
    if (t) {
      await playTrackAsync(t);
    }
  }, [playback, playTrackAsync]);

  // Seek by clicking on the progress bar
  const handleSeekStart = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true);
    handleSeek(e);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * (playback.duration_secs || 0);
    setLocalPos(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const handleSeekEnd = () => {
    setDragging(false);
  };

  // Drag seek
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const bar = document.getElementById('seek-bar');
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = pct * (playback.duration_secs || 0);
    setLocalPos(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  }, [dragging, playback.duration_secs]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

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
            <div className="font-mono text-xs text-gray-200 truncate">{track?.title || 'No track'}</div>
            <div className="font-mono text-[10px] text-gray-500 truncate">{track?.artist || ''}</div>
          </div>
        </div>

        {/* Controls + seek */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-5">
            <button
              onClick={handlePrev}
              className="text-gray-400 hover:text-white transition-colors text-sm"
              title="Previous"
            >
              ▮◄
            </button>
            <button
              onClick={handlePlayPause}
              className="accent-text text-xl hover:opacity-80 transition-opacity"
              title={playback.status === 'playing' ? 'Pause' : 'Play'}
            >
              {playback.status === 'playing' ? '▮▮' : '►'}
            </button>
            <button
              onClick={handleNext}
              className="text-gray-400 hover:text-white transition-colors text-sm"
              title="Next"
            >
              ►▮
            </button>
          </div>
          <div className="w-full max-w-xl flex items-center gap-2">
            <span className="font-mono text-[10px] text-gray-500 w-10 text-right">{formatTime(localPos)}</span>
            <div
              id="seek-bar"
              className="flex-1 h-1 bg-surface-3 rounded-full cursor-pointer group relative"
              onMouseDown={handleSeekStart}
              onMouseMove={dragging ? undefined : handleSeek}
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

        {/* Volume */}
        <div className="w-40 flex items-center gap-3 justify-end">
          <span className="font-mono text-[10px] text-gray-600">
            {playback.volume > 0 ? `${Math.round(playback.volume * 100)}%` : 'vol'}
          </span>
          <div
            className="w-20 h-1 bg-surface-3 rounded-full cursor-pointer"
            onClick={handleVolumeChange}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${playback.volume * 100}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
