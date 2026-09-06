import { useEffect, useState } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import { useLibraryStore } from '../../stores/libraryStore';
import {
  cmdAddToQueue,
  cmdRemoveFromQueue,
  scanLocalFiles,
  fileUrl,
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  getPlaylistTracks,
  importSpotifyPlaylist,
  importYoutubePlaylist,
  removeFromPlaylist,
  likeTrack,
  unlikeTrack,
  exportPlaylist,
} from '../../lib/tauri';
import { playTrackAndSet } from '../../lib/player';
import TagEditorModal from '../common/TagEditorModal';
import type { Track, Album, Artist, Folder, LibraryTab, Playlist } from '../../types';

const TABS: LibraryTab[] = ['tracks', 'albums', 'artists', 'genres', 'folders', 'playlists', 'liked'];

function formatDuration(secs: number): string {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function LibraryView() {
  const { libraryView, setLibraryView } = usePlayerStore();
  const { tracks, albums, artists, genres, folders } = useLibraryStore();
  const { likedIds, toggleLike, setSelectionMode, selectionMode, selectedIds, toggleSelected } = usePlayerStore();
  const [scanDir, setScanDir] = useState('');
  const [scanning, setScanning] = useState(false);
  const [playError, setPlayError] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [playlistMsg, setPlaylistMsg] = useState('');
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  const refreshPlaylists = async () => {
    try {
      setPlaylists(await getPlaylists());
    } catch (e: any) {
      setPlaylistMsg(String(e));
    }
  };

  useEffect(() => {
    refreshPlaylists();
  }, []);

  const openPlaylist = async (id: string) => {
    setSelectedPlaylistId(id);
    try {
      setPlaylistTracks(await getPlaylistTracks(id));
    } catch (e: any) {
      setPlaylistMsg(String(e));
    }
  };

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    setPlaylistBusy(true);
    try {
      await createPlaylist(name);
      setNewPlaylistName('');
      await refreshPlaylists();
      setPlaylistMsg(`created "${name}"`);
    } catch (e: any) {
      setPlaylistMsg(String(e));
    }
    setPlaylistBusy(false);
  };

  const handleDeletePlaylist = async (id: string) => {
    setPlaylistBusy(true);
    try {
      await deletePlaylist(id);
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(null);
        setPlaylistTracks([]);
      }
      await refreshPlaylists();
    } catch (e: any) {
      setPlaylistMsg(String(e));
    }
    setPlaylistBusy(false);
  };

  const handleImport = async () => {
    const url = spotifyUrl.trim();
    if (!url) return;
    setPlaylistBusy(true);
    try {
      const isSpotify = /spotify\.com|spotify\.link|open\.spotify/.test(url);
      setPlaylistMsg(isSpotify
        ? 'importing spotify playlist… (matches each track on youtube)'
        : 'importing youtube playlist…');
      const result = isSpotify
        ? await importSpotifyPlaylist(url)
        : await importYoutubePlaylist(url);
      setSpotifyUrl('');
      setPlaylistMsg(`imported ${result.imported} of ${result.total} tracks → "${result.name}"`);
      if (result.imported) openPlaylist(await findPlaylistId(result.name));
      await refreshPlaylists();
    } catch (e: any) {
      setPlaylistMsg(String(e));
    }
    setPlaylistBusy(false);
  };

  const findPlaylistId = async (name: string): Promise<string | null> => {
    try {
      const pls = await getPlaylists();
      return pls.find((p) => p.name === name)?.id || pls[0]?.id || null;
    } catch { return null; }
  };

  const handleRemoveFromPlaylist = async (trackId: string) => {
    if (!selectedPlaylistId) return;
    try {
      await removeFromPlaylist(selectedPlaylistId, trackId);
      setPlaylistTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch (e: any) {
      setPlaylistMsg(String(e));
    }
  };

  const playPlaylistTracks = async (track: Track, list: Track[]) => {
    await playTrackFromLib(track, list);
  };

  const handleTagSave = (updated: Track) => {
    const { setTracks } = useLibraryStore.getState();
    const all = useLibraryStore.getState().tracks;
    setTracks(all.map((t) => t.id === updated.id ? updated : t));
    setEditingTrack(null);
  };

  const likedTracks = tracks.filter((t) => likedIds.has(t.id));

  const handleLike = async (track: Track) => {
    if (likedIds.has(track.id)) {
      await unlikeTrack(track.id); toggleLike(track.id);
    } else {
      await likeTrack(track.id); toggleLike(track.id);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await cmdRemoveFromQueue([...selectedIds].indexOf(id));
    }
    setSelectionMode(false);
  };

  const handleExportPlaylist = async (plId: string, fmt: string) => {
    try {
      const path = await exportPlaylist(plId, fmt);
      setPlaylistMsg(`exported to ${path}`);
    } catch (e: any) { setPlaylistMsg(String(e)); }
  };

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

  const playTrackFromLib = async (track: Track, contextTracks?: Track[]) => {
    setPlayError('');
    try {
      await playTrackAndSet(track, contextTracks);
    } catch (e: any) {
      console.error('Play error:', e);
      setPlayError(`Failed to play "${track.title}": ${e}`);
    }
  };

  const playAlbum = async (album: Album) => {
    const albumTracks = tracks.filter((t) => t.album === album.name);
    if (albumTracks.length > 0) {
      await playTrackFromLib(albumTracks[0], albumTracks);
    }
  };

  return (
    <>
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
                onClick={() => playTrackFromLib(track, tracks)}
                className="flex items-center gap-4 px-5 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
              >
                <span className="font-mono text-[10px] text-gray-600 w-6 text-right">
                  {i + 1}
                </span>
                {track.cover_path ? (
                  <img
                    src={fileUrl(track.cover_path)}
                    alt=""
                    className="w-10 h-10 rounded-sm object-cover border border-surface-3"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-sm bg-surface-2 border border-surface-3 flex items-center justify-center font-mono text-sm text-gray-700">
                    ♫
                  </div>
                )}
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
                <button
                  onClick={(e) => { e.stopPropagation(); handleLike(track); }}
                  className={`text-sm transition-colors ${likedIds.has(track.id) ? 'text-red-500' : 'text-gray-700 hover:text-red-400'}`}
                  title="Like"
                >
                  {likedIds.has(track.id) ? '♥' : '♡'}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingTrack(track); }}
                  className="font-mono text-[10px] text-gray-700 hover:text-gray-300 px-1.5"
                  title="Edit tags"
                >
                  ✎
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">
            {albums.map((album, i) => (
              <div
                key={i}
                onClick={() => playAlbum(album)}
                className="bg-surface-1 border border-surface-2 p-3 hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                <div className="w-full aspect-square bg-surface-2 mb-3 flex items-center justify-center overflow-hidden border border-surface-3">
                  {album.cover_path ? (
                    <img
                      src={fileUrl(album.cover_path)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-mono text-2xl text-gray-700">♫</span>
                  )}
                </div>
                <div className="font-mono text-xs text-gray-200 truncate">{album.name}</div>
                <div className="font-mono text-[10px] text-gray-500 mt-0.5 truncate">{album.artist || '—'}</div>
                <div className="font-mono text-[10px] text-gray-600 mt-0.5">{album.track_count} tracks</div>
              </div>
            ))}
          </div>
        )}

        {libraryView === 'artists' && (
          <div className="divide-y divide-surface-2">
            {artists.map((artist, i) => (
              <div
                key={i}
                onClick={() => {
                  const artistTracks = tracks.filter((t) => t.artist === artist.name);
                  if (artistTracks.length > 0) playTrackFromLib(artistTracks[0], artistTracks);
                }}
                className="px-5 py-3 hover:bg-surface-1 transition-colors cursor-pointer"
              >
                <div className="font-mono text-xs text-gray-200">{artist.name}</div>
                <div className="font-mono text-[10px] text-gray-600">
                  {artist.track_count} tracks · {artist.album_count} albums
                </div>
              </div>
            ))}
          </div>
        )}

        {libraryView === 'genres' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-4">
            {genres.map((genre, i) => (
              <div
                key={i}
                onClick={() => {
                  const gTracks = tracks.filter((t) => t.genre === genre.name);
                  if (gTracks.length > 0) playTrackFromLib(gTracks[0], gTracks);
                }}
                className="bg-surface-1 border border-surface-2 p-4 hover:border-[var(--accent)] transition-colors cursor-pointer"
              >
                <div className="font-mono text-sm text-gray-200 truncate">{genre.name}</div>
                <div className="font-mono text-[10px] text-gray-600 mt-1">{genre.track_count} tracks</div>
              </div>
            ))}
            {genres.length === 0 && (
              <div className="p-12 text-center font-mono text-xs text-gray-600 col-span-full">
                no genre metadata found in your tracks
              </div>
            )}
          </div>
        )}

        {libraryView === 'liked' && (
          <div className="divide-y divide-surface-2">
            {likedTracks.length === 0 && (
              <div className="p-12 text-center font-mono text-xs text-gray-600">
                no liked tracks — tap the ♥ on any song
              </div>
            )}
            {likedTracks.map((track, i) => (
              <div
                key={track.id || i}
                onClick={() => playTrackFromLib(track, likedTracks)}
                className="flex items-center gap-4 px-5 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
              >
                <span className="font-mono text-[10px] text-gray-600 w-6 text-right">{i + 1}</span>
                <span className="text-sm text-red-500">♥</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
                  <div className="font-mono text-[10px] text-gray-500 truncate">{track.artist || '—'}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleLike(track); }} className="text-sm text-gray-700 hover:text-red-400">♡</button>
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
          <div className="flex h-full">
            {/* Playlist list */}
            <div className="w-72 border-r border-surface-2 flex flex-col">
              <div className="p-3 border-b border-surface-2 space-y-2">
                <input
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreatePlaylist(); }}
                  placeholder="new playlist name"
                  className="w-full bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none"
                />
                <button
                  onClick={handleCreatePlaylist}
                  disabled={playlistBusy}
                  className="w-full font-mono text-[10px] px-3 py-1.5 border border-surface-3 text-gray-400 hover:text-white hover:border-[var(--accent)] disabled:opacity-50"
                >
                  + create
                </button>
                <input
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }}
                  placeholder="spotify / youtube playlist url…"
                  className="w-full bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none"
                />
                <button
                  onClick={handleImport}
                  disabled={playlistBusy}
                  className="w-full font-mono text-[10px] px-3 py-1.5 border border-surface-3 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black disabled:opacity-50"
                >
                  import playlist
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => openPlaylist(pl.id)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer border-l-2 transition-colors ${
                      selectedPlaylistId === pl.id
                        ? 'border-[var(--accent)] bg-surface-1'
                        : 'border-transparent hover:bg-surface-1'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-200 truncate">{pl.name}</div>
                      <div className="font-mono text-[10px] text-gray-600">{pl.created_at?.slice(0, 10) || ''}</div>
                    </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                        className="text-[10px] text-gray-600 hover:text-red-500 px-1.5"
                        title="delete playlist"
                      >
                        ✕
                      </button>
                      <button
                        onClick={async (e) => { e.stopPropagation(); await handleExportPlaylist(pl.id, 'json'); }}
                        className="text-[10px] text-gray-600 hover:text-[var(--accent)] px-1.5"
                        title="export playlist (JSON)"
                      >
                        ↓
                      </button>
                  </div>
                ))}
                {playlists.length === 0 && (
                  <div className="p-6 text-center font-mono text-[10px] text-gray-600">
                    no playlists yet
                  </div>
                )}
              </div>
            </div>

            {/* Playlist tracks */}
            <div className="flex-1 overflow-y-auto">
              {playlistMsg && (
                <div className="px-4 py-2 bg-surface-1 border-b border-surface-2 font-mono text-[10px] text-gray-400">
                  {playlistMsg}
                </div>
              )}
              {selectedPlaylistId ? (
                playlistTracks.length === 0 ? (
                  <div className="p-12 text-center font-mono text-xs text-gray-600">
                    playlist is empty
                  </div>
                ) : (
                  <div className="divide-y divide-surface-2">
                    {playlistTracks.map((track, i) => (
                      <div
                        key={track.id}
                        onClick={() => playPlaylistTracks(track, playlistTracks)}
                        className="flex items-center gap-4 px-5 py-2.5 cursor-pointer hover:bg-surface-1 transition-colors"
                      >
                        <span className="font-mono text-[10px] text-gray-600 w-6 text-right">{i + 1}</span>
                        {track.cover_path ? (
                          <img src={fileUrl(track.cover_path)} alt="" className="w-10 h-10 rounded-sm object-cover border border-surface-3" />
                        ) : (
                          <div className="w-10 h-10 rounded-sm bg-surface-2 border border-surface-3 flex items-center justify-center font-mono text-sm text-gray-700">♫</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
                          <div className="font-mono text-[10px] text-gray-500 truncate">{track.artist || '—'}</div>
                        </div>
                        <span className="font-mono text-[10px] text-gray-600">{track.source}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); cmdAddToQueue(track); }}
                          className="font-mono text-[10px] text-gray-600 hover:text-[var(--accent)] px-2 py-0.5 border border-surface-3"
                          title="Add to queue"
                        >
                          +
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(track.id); }}
                          className="font-mono text-[10px] text-gray-600 hover:text-red-500 px-2 py-0.5 border border-surface-3"
                          title="Remove from playlist"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="p-12 text-center font-mono text-xs text-gray-600">
                  select a playlist — or create / import one on the left
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    {editingTrack && (
      <TagEditorModal track={editingTrack} onClose={() => setEditingTrack(null)} onSave={handleTagSave} />
    )}
    </>
  );
}
