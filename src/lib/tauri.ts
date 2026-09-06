import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type {
  PlaybackState,
  Track,
  Album,
  Artist,
  Folder,
  Genre,
  Playlist,
  AppConfig,
  LyricsResult,
  TrackStats,
  ListeningStats,
  RepeatMode,
} from '../types';

export { convertFileSrc };

/**
 * Convert a path to a URL the webview can play/display.
 * Remote http(s) URLs (e.g. YouTube thumbnails) pass through unchanged;
 * local file paths are converted via Tauri's asset protocol.
 */
export function fileUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return convertFileSrc(path);
}

// Player — returns PlayResult with state + file_path for frontend audio
export const playTrack = (track: Track): Promise<{ state: PlaybackState; file_path?: string }> =>
  invoke('play', { track }) as any;
export const pausePlayback = (): Promise<void> => invoke('pause');
export const resumePlayback = (): Promise<void> => invoke('resume');
export const stopPlayback = (): Promise<void> => invoke('stop');
export const seekPlayback = (positionSecs: number): Promise<void> => invoke('seek', { positionSecs });
export const setVolume = (volume: number): Promise<void> => invoke('set_volume', { volume });
export const setSpeed = (speed: number): Promise<void> => invoke('set_speed', { speed });
export const getPlaybackState = (): Promise<PlaybackState> => invoke('get_playback_state');

// Queue
export const cmdAddToQueue = (track: Track): Promise<void> => invoke('add_to_queue', { track });
export const cmdRemoveFromQueue = (index: number): Promise<void> => invoke('remove_from_queue', { index });
export const cmdReorderQueue = (from: number, to: number): Promise<void> => invoke('reorder_queue', { from, to });
export const cmdClearQueue = (): Promise<void> => invoke('clear_queue');
export const cmdGetQueue = (): Promise<Track[]> => invoke('get_queue');
export const cmdNextTrack = (): Promise<Track | null> => invoke('next_track');
export const cmdPreviousTrack = (): Promise<Track | null> => invoke('previous_track');
export const cmdSetRepeatMode = (mode: RepeatMode): Promise<void> => invoke('set_repeat_mode', { mode });
export const cmdToggleShuffle = (): Promise<boolean> => invoke('toggle_shuffle');

// Library
export const scanLocalFiles = (directory: string): Promise<number> => invoke('scan_local_files', { directory });
export const getTracks = (source?: string): Promise<Track[]> => invoke('get_tracks', { source });
export const getAlbums = (): Promise<Album[]> => invoke('get_albums');
export const getArtists = (): Promise<Artist[]> => invoke('get_artists');
export const getGenres = (): Promise<Genre[]> => invoke('get_genres');
export const getFolders = (): Promise<Folder[]> => invoke('get_folders');
export const getPlaylists = (): Promise<Playlist[]> => invoke('get_playlists');
export const createPlaylist = (name: string): Promise<Playlist> => invoke('create_playlist', { name });
export const deletePlaylist = (playlistId: string): Promise<void> => invoke('delete_playlist', { playlistId });
export const addToPlaylist = (playlistId: string, track: Track): Promise<void> =>
  invoke('add_to_playlist', { playlistId, track });
export const removeFromPlaylist = (playlistId: string, trackId: string): Promise<void> =>
  invoke('remove_from_playlist', { playlistId, trackId });
export const getPlaylistTracks = (playlistId: string): Promise<Track[]> =>
  invoke('get_playlist_tracks', { playlistId });
export const importSpotifyPlaylist = (url: string): Promise<{ name: string; imported: number; total: number }> =>
  invoke('import_spotify_playlist', { url });
export const importYoutubePlaylist = (url: string): Promise<{ name: string; imported: number; total: number }> =>
  invoke('import_youtube_playlist', { url });
export const downloadTrack = (track: Track): Promise<string> => invoke('download_track', { track });
export const searchLibrary = (query: string): Promise<Track[]> => invoke('search_library', { query });
export const autoScanMusic = (): Promise<number> => invoke('auto_scan_music');
export const getCommonMusicDirs = (): Promise<string[]> => invoke('get_common_music_dirs');

// Jellyfin
export const jellyfinConnect = (serverUrl: string, apiKey: string, userId: string) =>
  invoke('jellyfin_connect', { serverUrl, apiKey, userId });
export const jellyfinGetLibraries = () => invoke('jellyfin_get_libraries');
export const jellyfinGetTracks = (libraryId: string) => invoke('jellyfin_get_tracks', { libraryId });
export const jellyfinSearch = (query: string) => invoke('jellyfin_search', { query });

// YouTube Music
export const ytmusicSearch = (query: string, filter?: string) =>
  invoke('ytmusic_search', { query, filter });
export const ytmusicSearchAsTracks = (query: string) =>
  invoke('ytmusic_search_as_tracks', { query });
export const ytmusicGetStreamUrl = (videoId: string) =>
  invoke('ytmusic_get_stream_url', { videoId });

// Telegram (login-based via Pyrogram)
export const telegramConnect = (apiId: number, apiHash: string) =>
  invoke('telegram_connect', { apiId, apiHash });
export const telegramResetSession = () =>
  invoke('telegram_reset_session');
export const telegramSendPhone = (phoneNumber: string) =>
  invoke('telegram_send_phone', { phoneNumber });
export const telegramSubmitCode = (code: string) =>
  invoke('telegram_submit_code', { code });
export const telegramSubmitPassword = (password: string) =>
  invoke('telegram_submit_password', { password });
export const telegramGetChannels = () => invoke('telegram_get_channels');
export const telegramGetAudio = (channelId: number) =>
  invoke('telegram_get_audio', { channelId });
export const telegramDownloadAudio = (messageId: number, channelId: number) =>
  invoke('telegram_download_audio', { messageId, channelId });

// Lyrics
export const fetchLyrics = (title: string, artist: string): Promise<LyricsResult | null> =>
  invoke('fetch_lyrics', { title, artist });

// Stats
export const getTrackStats = (trackId: string): Promise<TrackStats | null> => invoke('get_track_stats', { trackId });
export const getListeningStats = (): Promise<ListeningStats> => invoke('get_listening_stats');

// Config
export const getConfig = (): Promise<AppConfig> => invoke('get_config');
export const updateConfig = (config: AppConfig): Promise<void> => invoke('update_config', { config });
