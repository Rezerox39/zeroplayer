import { useEffect, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { fetchLyrics, setSpeed as cmdSetSpeed, fileUrl } from '../../lib/tauri';
import LyricDisplay from '../Lyrics/LyricDisplay';

function formatTime(secs: number): string {
  if (!secs || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FullPlayer() {
  const { playback, setPlayback, lyrics, setLyrics, lyricsSynced } = usePlayerStore();
  const track = playback.current_track;
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [sleepMin, setSleepMin] = useState(0);
  const [sleepLeft, setSleepLeft] = useState(0);
  const [sleepTimerId, setSleepTimerId] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLyrics(null, false);
    if (track) {
      setLoadingLyrics(true);
      fetchLyrics(track.title, track.artist || '')
        .then((result) => {
          if (result) setLyrics(result.text, result.synced);
        })
        .catch(() => {})
        .finally(() => setLoadingLyrics(false));
    }
  }, [track?.id]);

  const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const cycleSpeed = async () => {
    const cur = playback.speed || 1;
    const idx = SPEEDS.indexOf(cur);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    await cmdSetSpeed(next);
    setPlayback({ ...playback, speed: next });
  };

  const cycleSleep = () => {
    const OPTIONS = [0, 15, 30, 45, 60, 90];
    const cur = sleepMin;
    const next = OPTIONS[(OPTIONS.indexOf(cur) + 1) % OPTIONS.length];
    if (sleepTimerId) clearTimeout(sleepTimerId);
    setSleepMin(next);
    setSleepLeft(0);
    if (next > 0) {
      const timer = setTimeout(() => {
        const audio = document.querySelector('audio');
        audio?.pause();
        usePlayerStore.getState().setPlayback({
          ...usePlayerStore.getState().playback,
          status: 'paused',
        });
        setSleepMin(0);
        setSleepLeft(0);
      }, next * 60 * 1000);
      setSleepTimerId(timer);
      // countdown ticker
      let left = next * 60;
      const ticker = setInterval(() => {
        left -= 1;
        setSleepLeft(Math.max(0, left));
        if (left <= 0) clearInterval(ticker);
      }, 1000);
    }
  };

  const coverSrc = fileUrl(track?.cover_path);

  return (
    <div className="h-full w-full flex bg-black-pure">
      {/* Left: album art + track info */}
      <div className="w-[42%] min-w-[380px] flex flex-col items-center justify-center gap-6 p-8">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className={`w-[320px] h-[320px] object-cover border shadow-2xl shadow-black ${
              playback.status === 'playing' ? 'border-[var(--accent)] accent-pulse' : 'border-surface-2'
            }`}
          />
        ) : (
          <div
            className={`w-[320px] h-[320px] bg-surface-1 border flex items-center justify-center ${
              playback.status === 'playing' ? 'border-[var(--accent)] accent-pulse' : 'border-surface-2'
            }`}
          >
            <span className="font-mono text-[64px] text-gray-700">♫</span>
          </div>
        )}

        <div className="text-center">
          <h1 className="font-mono text-xl text-gray-100 tracking-wide">{track?.title || '—'}</h1>
          <p className="font-mono text-sm text-gray-500 mt-1">{track?.artist || '—'}</p>
          <p className="font-mono text-xs text-gray-600 mt-0.5">{track?.album || ''}</p>
        </div>

        {/* Time / speed badges */}
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={cycleSpeed} className="px-3 py-1.5 border border-surface-3 font-mono text-[10px] text-gray-400 hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
            speed {playback.speed || 1}×
          </button>
          <button onClick={cycleSleep} className={`px-3 py-1.5 border font-mono text-[10px] transition-colors ${sleepMin > 0 ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-surface-3 text-gray-400 hover:text-[var(--accent)] hover:border-[var(--accent)]'}`}>
            {sleepMin > 0 ? `sleep ${sleepLeft ? formatTime(sleepLeft) : sleepMin + 'm'}` : 'sleep timer'}
          </button>
          <span className="px-3 py-1.5 border border-surface-3 font-mono text-[10px] text-gray-500">
            {formatTime(playback.position_secs)} / {formatTime(playback.duration_secs)}
          </span>
        </div>
      </div>

      {/* Right: lyrics */}
      <div className="flex-1 border-l border-surface-2 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-surface-2 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest uppercase text-gray-600">
            lyrics{lyricsSynced ? ' · synced' : loadingLyrics ? ' · loading…' : ''}
          </span>
          <span className="font-mono text-[10px] text-gray-700">source: {lyrics?.source || '—'}</span>
        </div>
        <LyricDisplay lyrics={lyrics?.text || null} synced={lyricsSynced} position={playback.position_secs} />
      </div>
    </div>
  );
}
