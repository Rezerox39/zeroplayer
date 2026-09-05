import { useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import { cmdAddToQueue, playTrack, scanLocalFiles } from '../../lib/tauri';
import type { Track, Album, Artist, Folder, LibraryTab } from '../../types';

const TABS: LibraryTab[] = ['tracks', 'albums', 'artists', 'folders', 'playlists'];

function formatDuration(secs: number): string {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LibraryView() {
  const { libraryView, setLibraryView, setPlayback } = usePlayerStore();
  const { tracks, albums, artists, folders } = useLibraryStore();
  const [scanDir, setScanDir] = useState('');
  const [scanning, setScanning] = useState(false);
  const [playError, setPlayError] = useState('');

  const handleScan = async () => {
    if (!scanDir) return;
    setScanning(true);
    try {
      await scanLocalFiles(scanDir);
    } catch (e: any) {
      setPlayError(e.toString());
    }
    setScanning(false);
  };

  const playTrackFromLib = async (track: Track) => {
    setPlayError('');
    try {
      const st = await playTrack(track);
      setPlayback(st);
    } catch (e: any) {
      console.error('Play error:', e);
      setPlayError(`Failed to play "${track.title}": ${e}`);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-surface-2 px-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setLibraryView(tab)}
            className={`px-4 py-3 font-mono text-[10px] tracking-widest uppercase transition-colors
              ${libraryView === tab ? 'accent-text border-b border-[var(--accent)]' : 'text-gray-600 hover:text-gray-400'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Scan directory */}
      <div className="px-4 py-3 border-b border-surface-2 flex items-center gap-3">
        <input
          type="text"
          value={scanDir}
          onChange={(e) => setScanDir(e.target.value)}
          placeholder="/path/to/music"
          className="bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none flex-1"
        />
        <button
          onClick={handleScan}
          disabled={scanning}
          className="font-mono text-[10px] px-3 py-1.5 border border-surface-3 text-gray-400 hover:text-white hover:border-[var(--accent)] transition-colors disabled:opacity-50"
        >
          {scanning ? 'scanning...' : 'scan'}
        </button>
        <span className="font-mono text-[10px] text-gray-600">{tracks.length} tracks</span>
      </div>

      {/* Error banner */}
      {playError && (
        <div className="px-4 py-2 bg-red-900/30 border-b border-red-800 font-mono text-[10px] text-red-400">
          {playError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {libraryView === 'tracks' && (
          <div className="divide-y divide-surface-2">
            {tracks.map((track, i) => (
              <div
                key={track.id || i}
                onClick={() => playTrackFromLib(track)}
                className="flex items-center gap-4 px-5 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
              >
                <span className="font-mono text-[10px] text-gray-600 w-6 text-right">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
                  <div className="font-mono text-[10px] text-gray-500 truncate">{track.artist || '—'}</div>
                </div>
                <span className="font-mono text-[10px] text-gray-600 w-20 text-right">
                  {track.album || ''}
                </span>
                <span className="font-mono text-[10px] text-gray-600 w-10 text-right">
                  {formatDuration(track.duration || 0)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); cmdAddToQueue(track); }}
                  className="font-mono text-[10px] text-gray-600 hover:text-[var(--accent)] px-2 py-0.5 border border-surface-3 hover:border-[var(--accent)]"
                  title="Add to queue"
                >
                  +
                </button>
              </div>
            ))}
            {tracks.length === 0 && (
              <div className="p-12 text-center font-mono text-xs text-gray-600">
                no tracks — scan a directory above
              </div>
            )}
          </div>
        )}

        {libraryView === 'albums' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 p-4">
            {albums.map((album, i) => (
              <div key={i} className="bg-surface-1 border border-surface-2 p-4 hover:border-[var(--accent)] transition-colors cursor-pointer">
                <div className="w-full aspect-square bg-surface-2 mb-3 flex items-center justify-center">
                  <span className="font-mono text-2xl text-gray-700">♫</span>
                </div>
                <div className="font-mono text-xs text-gray-200 truncate">{album.name}</div>
                <div className="font-mono text-[10px] text-gray-500 mt-0.5">{album.artist || '—'}</div>
                <div className="font-mono text-[10px] text-gray-600 mt-0.5">{album.track_count} tracks</div>
              </div>
            ))}
          </div>
        )}

        {libraryView === 'artists' && (
          <div className="divide-y divide-surface-2">
            {artists.map((artist, i) => (
              <div key={i} className="px-5 py-3 hover:bg-surface-1 transition-colors cursor-pointer">
                <div className="font-mono text-xs text-gray-200">{artist.name}</div>
                <div className="font-mono text-[10px] text-gray-600">
                  {artist.track_count} tracks · {artist.album_count} albums
                </div>
              </div>
            ))}
          </div>
        )}

        {libraryView === 'folders' && (
          <div className="divide-y divide-surface-2">
            {folders.map((folder, i) => (
              <div key={i} className="px-5 py-3 hover:bg-surface-1 transition-colors cursor-pointer">
                <div className="font-mono text-[10px] text-gray-300 truncate">{folder.path}</div>
                <div className="font-mono text-[10px] text-gray-600 mt-0.5">{folder.track_count} tracks</div>
              </div>
            ))}
          </div>
        )}

        {libraryView === 'playlists' && (
          <div className="p-12 text-center font-mono text-xs text-gray-600">
            playlist support coming soon
          </div>
        )}
      </div>
    </div>
  );
}
