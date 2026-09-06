import { useEffect, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import {
  searchLibrary,
  ytmusicSearchAsTracks,
  jellyfinSearch,
  fileUrl,
  cmdAddToQueue,
  getPlaylists,
  addToPlaylist,
} from '../../lib/tauri';
import { playTrackAndSet } from '../../lib/player';
import type { Track, Playlist } from '../../types';

type SearchSource = 'all' | 'local' | 'jellyfin' | 'yt-music';

const SOURCES: { id: SearchSource; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'local', label: 'local' },
  { id: 'jellyfin', label: 'jellyfin' },
  { id: 'yt-music', label: 'yt-music' },
];

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SearchSource>('all');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState('');
  const [menuTrackId, setMenuTrackId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [plMsg, setPlMsg] = useState('');
  const { likedIds, toggleLike } = usePlayerStore();

  useEffect(() => {
    getPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    const all: Track[] = [];
    const errors: string[] = [];

    try {
      if (source === 'all' || source === 'local') {
        try { const r = await searchLibrary(query); all.push(...r); }
        catch (e: any) { errors.push(`local: ${e}`); }
      }
      if (source === 'all' || source === 'yt-music') {
        try { const r = await ytmusicSearchAsTracks(query); all.push(...r); }
        catch (e: any) { errors.push(`yt-music: ${e}`); }
      }
      if (source === 'all' || source === 'jellyfin') {
        try { const r = await jellyfinSearch(query); all.push(...(r as Track[])); }
        catch (e: any) { errors.push(`jellyfin: ${e}`); }
      }
    } catch (e: any) {
      errors.push(e.toString());
    }

    setResults(all);
    if (errors.length > 0) setError(errors.join('\n'));
    setSearching(false);
  };

  const handlePlay = async (track: Track) => {
    setPlayingId(track.id);
    setError('');
    try {
      await playTrackAndSet(track, results);
    } catch (e: any) {
      setError(`Failed to play "${track.title}": ${e}`);
    } finally {
      setPlayingId('');
    }
  };

  const handleMenuAdd = async (track: Track, playlistId?: string) => {
    setMenuTrackId(null);
    try {
      if (playlistId) {
        await addToPlaylist(playlistId, track);
        const pl = playlists.find((p) => p.id === playlistId);
        setPlMsg(`added to "${pl?.name || 'playlist'}"`);
      } else {
        await cmdAddToQueue(track);
        setPlMsg('added to queue');
      }
      setTimeout(() => setPlMsg(''), 2500);
    } catch (e: any) {
      setError(String(e));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-4 border-b border-surface-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[var(--accent)] text-sm">/</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="search tracks, artists, albums..."
            autoFocus
            className="flex-1 bg-transparent font-mono text-sm text-gray-200 outline-none placeholder:text-gray-600"
          />
          <button
            onClick={runSearch}
            disabled={searching}
            className="font-mono text-[10px] px-3 py-1 border border-[var(--accent)] text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {searching ? 'searching...' : 'search'}
          </button>
        </div>

        <div className="flex mt-3 gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={`font-mono text-[10px] px-2.5 py-1 border transition-colors
                ${source === s.id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-surface-3 text-gray-600 hover:text-gray-400'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 bg-red-900/30 border border-red-800 font-mono text-[10px] text-red-400 whitespace-pre-wrap">
            {error}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-surface-2">
        {results.map((track, i) => {
          // YT search results carry a remote thumbnail URL; local tracks carry a file path.
          const thumb = track.source === 'youtube_music'
            ? (track.cover_path?.startsWith('http') ? track.cover_path : undefined)
            : fileUrl(track.cover_path);
          const liked = likedIds.has(track.id);
          return (
            <div
              key={`${track.source}-${track.id}-${i}`}
              onClick={() => handlePlay(track)}
              className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
            >
              {thumb ? (
                <img src={thumb} alt="" className="w-10 h-10 rounded-sm object-cover border border-surface-3" />
              ) : (
                <div className="w-10 h-10 rounded-sm bg-surface-2 border border-surface-3 flex items-center justify-center font-mono text-sm text-gray-700">
                  ♫
                </div>
              )}
              <span className="font-mono text-[9px] px-1.5 py-0.5 border border-surface-3 text-gray-500 w-18 text-center">
                {track.source}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
                <div className="font-mono text-[10px] text-gray-500 truncate">{track.artist || '—'}</div>
              </div>
              {track.duration && (
                <span className="font-mono text-[10px] text-gray-600">
                  {Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}
                </span>
              )}
              {playingId === track.id && (
                <span className="font-mono text-[10px] text-[var(--accent)] animate-pulse">
                  loading...
                </span>
              )}
              <button
                onClick={async (e) => { e.stopPropagation(); if (liked) { await import('../../lib/tauri').then(m => m.unlikeTrack(track.id)); } else { await import('../../lib/tauri').then(m => m.likeTrack(track.id)); } toggleLike(track.id); }}
                className={`text-sm transition-colors ${liked ? 'text-red-500' : 'text-gray-700 hover:text-red-400'}`}
              >
                {liked ? '♥' : '♡'}
              </button>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuTrackId(menuTrackId === track.id ? null : track.id); }}
                  className="font-mono text-[10px] text-gray-600 hover:text-[var(--accent)] px-2 py-0.5 border border-surface-3 hover:border-[var(--accent)]"
                  title="Add to queue / playlist"
                >
                  +
                </button>
                {menuTrackId === track.id && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-52 bg-surface-2 border border-surface-3 shadow-2xl shadow-black">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMenuAdd(track); }}
                      className="w-full text-left px-3 py-2 font-mono text-[10px] text-gray-300 hover:bg-surface-3"
                    >
                      + add to queue
                    </button>
                    {playlists.map((pl) => (
                      <button
                        key={pl.id}
                        onClick={(e) => { e.stopPropagation(); handleMenuAdd(track, pl.id); }}
                        className="w-full text-left px-3 py-2 font-mono text-[10px] text-gray-400 hover:bg-surface-3 border-t border-surface-3"
                      >
                        + {pl.name}
                      </button>
                    ))}
                    {playlists.length === 0 && (
                      <div className="px-3 py-2 font-mono text-[9px] text-gray-600 border-t border-surface-3">
                        no playlists — create one in library
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {plMsg && (
          <div className="px-5 py-2 font-mono text-[10px] text-[var(--accent)]">{'>'} {plMsg}</div>
        )}
        {results.length === 0 && !searching && !error && (
          <div className="p-12 text-center font-mono text-xs text-gray-600">
            {query ? 'no results' : 'type a query and press enter'}
          </div>
        )}
      </div>
    </div>
  );
}
