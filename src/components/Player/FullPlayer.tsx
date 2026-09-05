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
  const { playback, lyrics, setLyrics, lyricsSynced } = usePlayerStore();
  const track = playback.current_track;
  const [loadingLyrics, setLoadingLyrics] = useState(false);

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

  const coverSrc = fileUrl(track?.cover_path);

  return (
    <div className="h-full w-full flex bg-black-pure">
      {/* Left: album art + track info */}
      <div className="w-[42%] min-w-[380px] flex flex-col items-center justify-center gap-6 p-8">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            className="w-[320px] h-[320px] object-cover border border-surface-2 shadow-2xl shadow-black"
          />
        ) : (
          <div className="w-[320px] h-[320px] bg-surface-1 border border-surface-2 flex items-center justify-center">
            <span className="font-mono text-[64px] text-gray-700">♫</span>
          </div>
        )}

        <div className="text-center">
          <h1 className="font-mono text-xl text-gray-100 tracking-wide">{track?.title || '—'}</h1>
          <p className="font-mono text-sm text-gray-500 mt-1">{track?.artist || '—'}</p>
          <p className="font-mono text-xs text-gray-600 mt-0.5">{track?.album || ''}</p>
        </div>

        {/* Time / speed badges */}
        <div className="flex gap-3 font-mono text-[10px] text-gray-600">
          <span className="px-2 py-1 border border-surface-3">
            {formatTime(playback.position_secs)} / {formatTime(playback.duration_secs)}
          </span>
          <span className="px-2 py-1 border border-surface-3">{playback.speed}×</span>
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
