import { invoke } from '@tauri-apps/api/core';
import type {
  PlaybackState,
  Track,
  Album,
  Artist,
  Folder,
  Playlist,
  AppConfig,
  LyricsResult,
  TrackStats,
  ListeningStats,
  RepeatMode,
} from '../types';

// Player
export const playTrack = (track: Track): Promise<PlaybackState> => invoke('play', { track });
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
export const getFolders = (): Promise<Folder[]> => invoke('get_folders');
export const getPlaylists = (): Promise<Playlist[]> => invoke('get_playlists');
export const searchLibrary = (query: string): Promise<Track[]> => invoke('search_library', { query });

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
export const getTrackStats = (trackId: string): Promise<TrackStats | null> =>
  invoke('get_track_stats', { trackId });
export const getListeningStats = (): Promise<ListeningStats> => invoke('get_listening_stats');

// Config
export const getConfig = (): Promise<AppConfig> => invoke('get_config');
export const updateConfig = (config: AppConfig): Promise<void> => invoke('update_config', { config });
