import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { searchLibrary, ytmusicSearchAsTracks, jellyfinSearch, telegramSearch, playTrack } from '../../lib/tauri';
import type { Track } from '../../types';

type SearchSource = 'all' | 'local' | 'jellyfin' | 'yt-music' | 'telegram';

const SOURCES: { id: SearchSource; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'local', label: 'local' },
  { id: 'jellyfin', label: 'jellyfin' },
  { id: 'yt-music', label: 'yt-music' },
  { id: 'telegram', label: 'telegram' },
];

export default function SearchView() {
  const { setPlayback } = usePlayerStore();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SearchSource>('all');
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const all: Track[] = [];

    try {
      if (source === 'all' || source === 'local') {
        const r = await searchLibrary(query);
        all.push(...r);
      }
      if (source === 'all' || source === 'yt-music') {
        const r = await ytmusicSearchAsTracks(query);
        all.push(...r);
      }
      if (source === 'all' || source === 'jellyfin') {
        const r = await jellyfinSearch(query);
        all.push(...(r as Track[]));
      }
      if (source === 'all' || source === 'telegram') {
        const r = await telegramSearch(query);
        all.push(...(r as Track[]));
      }
    } catch (e) {
      // ignore source-specific errors (unconfigured sources)
    }

    setResults(all);
    setSearching(false);
  };

  const handlePlay = async (track: Track) => {
    const st = await playTrack(track);
    setPlayback(st);
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

        {/* Source filter */}
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
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-surface-2">
        {results.map((track, i) => (
          <div
            key={`${track.source}-${track.id}-${i}`}
            onClick={() => handlePlay(track)}
            className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
          >
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
          </div>
        ))}
        {results.length === 0 && !searching && (
          <div className="p-12 text-center font-mono text-xs text-gray-600">
            {query ? 'no results' : 'type a query and press enter'}
          </div>
        )}
      </div>
    </div>
  );
}
