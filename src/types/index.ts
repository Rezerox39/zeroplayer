export interface Track {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  album_artist?: string;
  genre?: string;
  year?: number;
  track_number?: number;
  duration?: number;
  file_path?: string;
  source: 'local' | 'jellyfin' | 'youtube_music' | 'telegram';
  source_id?: string;
  cover_path?: string;
  play_count?: number;
  last_played_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Album {
  name: string;
  artist?: string;
  track_count: number;
  total_duration?: number;
  cover_path?: string;
}

export interface Artist {
  name: string;
  track_count: number;
  album_count: number;
}

export interface Folder {
  path: string;
  track_count: number;
}

export interface Playlist {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export type PlayerStatus = 'stopped' | 'playing' | 'paused';

export interface PlaybackState {
  status: PlayerStatus;
  current_track?: Track;
  position_secs: number;
  duration_secs: number;
  volume: number;
  speed: number;
}

export type RepeatMode = 'off' | 'one' | 'all';

export interface LyricsResult {
  text: string;
  synced: boolean;
  source: string;
}

export interface TrackStats {
  track_id: string;
  play_count: number;
  total_seconds: number;
  last_played_at?: string;
}

export interface ListeningStats {
  total_plays: number;
  total_listening_seconds: number;
  unique_tracks: number;
}

export type AccentColor = 'green' | 'cyan' | 'purple' | 'red';

export interface ThemeConfig {
  accent_color: AccentColor;
  font_size: number;
  show_album_art: boolean;
}

export interface PlaybackConfig {
  volume: number;
  speed: number;
  gapless: boolean;
  crossfade_secs: number;
}

export interface AppConfig {
  theme: ThemeConfig;
  playback: PlaybackConfig;
  jellyfin?: { server_url: string; api_key: string; user_id: string };
  youtube_music?: { auth_file: string; language: string; region: string };
  telegram?: { bot_token: string; channels: string[] };
  lyrics: { provider: string; genius_token?: string };
  local_dirs: string[];
  setup_done?: boolean;
}

export type ViewTab = 'player' | 'library' | 'search' | 'queue' | 'stats' | 'settings';

export type LibraryTab = 'tracks' | 'albums' | 'artists' | 'folders' | 'playlists';
