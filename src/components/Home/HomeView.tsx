import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { playTrackAndSet } from '../../lib/player';
import { fileUrl, likeTrack, unlikeTrack } from '../../lib/tauri';
import type { Track } from '../../types';

function TrackRow({ track, context }: { track: Track; context?: Track[] }) {
  const { likedIds, toggleLike } = usePlayerStore();
  const liked = likedIds.has(track.id);

  const play = async () => {
    await playTrackAndSet(track, context);
  };

  const heart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liked) { await unlikeTrack(track.id); } else { await likeTrack(track.id); }
    toggleLike(track.id);
  };

  const thumb = track.source === 'youtube_music'
    ? (track.cover_path?.startsWith('http') ? track.cover_path : undefined)
    : fileUrl(track.cover_path);

  return (
    <div onClick={play} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-1 cursor-pointer transition-colors rounded-sm">
      {thumb ? (
        <img src={thumb} alt="" className="w-10 h-10 rounded-sm object-cover border border-surface-3" />
      ) : (
        <div className="w-10 h-10 rounded-sm bg-surface-2 border border-surface-3 flex items-center justify-center font-mono text-sm text-gray-700">♫</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
        <div className="font-mono text-[10px] text-gray-500 truncate">{track.artist || '—'}</div>
      </div>
      <button onClick={heart} className={`text-sm transition-colors ${liked ? 'text-red-500' : 'text-gray-700 hover:text-red-400'}`}>
        {liked ? '♥' : '♡'}
      </button>
    </div>
  );
}

function Shelf({ title, tracks, onMore }: { title: string; tracks: Track[]; onMore?: () => void }) {
  if (tracks.length === 0) return null;
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="font-mono text-[10px] tracking-widest uppercase text-gray-600">{title}</span>
        {onMore && (
          <button onClick={onMore} className="font-mono text-[10px] text-[var(--accent)] hover:opacity-80 transition-opacity">
            view all →
          </button>
        )}
      </div>
      <div className="divide-y divide-surface-2 bg-surface-1 border border-surface-2 rounded-sm mx-5">
        {tracks.map((t) => (
          <TrackRow key={t.id} track={t} context={tracks} />
        ))}
      </div>
    </div>
  );
}

export default function HomeView() {
  const { recentlyPlayed, topPlayed, setActiveView } = usePlayerStore();
  const { tracks } = useLibraryStore();

  const fresh = tracks
    .filter((t) => !t.play_count || t.play_count === 0)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    .slice(0, 12);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="accent-bg w-3 h-3" />
          <h1 className="text-xl text-gray-100">zeroplayer</h1>
        </div>
        <p className="font-mono text-[10px] text-gray-500 ml-6">your music, your way</p>
      </div>

      {tracks.length === 0 && (
        <div className="px-6 py-16 text-center font-mono text-sm text-gray-600">
          <span className="accent-text">{'>'}</span> no tracks yet — add music in the Library tab
        </div>
      )}

      <Shelf title="recently played" tracks={recentlyPlayed} onMore={() => setActiveView('library')} />
      <Shelf title="most played" tracks={topPlayed} onMore={() => setActiveView('stats')} />
      <Shelf title="fresh & unplayed" tracks={fresh} onMore={() => setActiveView('library')} />

      <div className="px-5 pb-8">
        <div className="font-mono text-[10px] tracking-widest text-gray-600 uppercase mb-3">quick actions</div>
        <div className="flex gap-3">
          {[
            { label: 'search yt-music', view: 'search' as const, icon: '/' },
            { label: 'playlists', view: 'library' as const, icon: '≡' },
            { label: 'queue', view: 'queue' as const, icon: '↻' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => setActiveView(a.view)}
              className="px-4 py-2.5 border border-surface-3 text-gray-400 hover:text-[var(--accent)] hover:border-[var(--accent)] font-mono text-[10px] transition-colors"
            >
              <span className="mr-2 text-sm">{a.icon}</span>{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
