import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  pausePlayback,
  resumePlayback,
  cmdNextTrack,
  cmdPreviousTrack,
  setVolume as cmdSetVolume,
} from '../../lib/tauri';
import type { Track } from '../../types';

function formatTime(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Player() {
  const { playback, setPlayback, updatePosition, setLyrics, queue, repeatMode } = usePlayerStore();
  const [localPos, setLocalPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    tickRef.current = setInterval(() => {
      if (playback.status === 'playing' && !dragging) {
        setLocalPos((p) => Math.min(p + 0.25, playback.duration_secs));
      }
    }, 250);
    return () => clearInterval(tickRef.current);
  }, [playback.status, dragging, playback.duration_secs]);

  useEffect(() => {
    setLocalPos(playback.position_secs);
  }, [playback.position_secs]);

  const handlePlayPause = useCallback(async () => {
    if (playback.status === 'playing') {
      await pausePlayback();
      setPlayback({ ...playback, status: 'paused' });
    } else {
      await resumePlayback();
      setPlayback({ ...playback, status: 'playing' });
    }
  }, [playback, setPlayback]);

  const handleNext = useCallback(async () => {
    const track = await cmdNextTrack();
    if (track) {
      const st = await (await import('../../lib/tauri')).playTrack(track);
      setPlayback(st);
    }
  }, [setPlayback]);

  const handlePrev = useCallback(async () => {
    const track = await cmdPreviousTrack();
    if (track) {
      const st = await (await import('../../lib/tauri')).playTrack(track);
      setPlayback(st);
    }
  }, [setPlayback]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = pct * playback.duration_secs;
    setLocalPos(newTime);
  };

  const track = playback.current_track;

  return (
    <div className="h-20 flex-shrink-0 bg-surface-1 border-t border-surface-3 flex items-center px-5 gap-5">
      {/* Track info */}
      <div className="w-56 flex items-center gap-3 overflow-hidden">
        {track?.cover_path ? (
          <img src={`asset://localhost/${track.cover_path}`} alt="" className="w-11 h-11 rounded-sm object-cover" />
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

      {/* Controls */}
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
            className="flex-1 h-1 bg-surface-3 rounded-full cursor-pointer group relative"
            onClick={handleSeek}
          >
            <div
              className="h-full rounded-full transition-all duration-100"
              style={{
                width: `${playback.duration_secs ? (localPos / playback.duration_secs) * 100 : 0}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
          <span className="font-mono text-[10px] text-gray-500 w-10">{formatTime(playback.duration_secs)}</span>
        </div>
      </div>

      {/* Volume & info */}
      <div className="w-40 flex items-center gap-3 justify-end">
        <span className="font-mono text-[10px] text-gray-600">
          {playback.volume > 0 ? `${Math.round(playback.volume * 100)}%` : 'vol'}
        </span>
        <div className="w-20 h-1 bg-surface-3 rounded-full">
          <div
            className="h-full rounded-full"
            style={{
              width: `${playback.volume * 100}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
        <span className="font-mono text-[10px] text-gray-600">
          {playback.speed !== 1 ? `${playback.speed}×` : ''}
        </span>
      </div>
    </div>
  );
}
