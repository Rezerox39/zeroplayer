import { create } from 'zustand';
import type { Track, Album, Artist, Folder, Genre, AppConfig, ListeningStats } from '../types';

interface LibraryStore {
  config: AppConfig;
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  folders: Folder[];
  genres: Genre[];
  listeningStats: ListeningStats | null;
  loading: boolean;
  error: string | null;

  setConfig: (config: AppConfig) => void;
  setTracks: (tracks: Track[]) => void;
  setAlbums: (albums: Album[]) => void;
  setArtists: (artists: Artist[]) => void;
  setFolders: (folders: Folder[]) => void;
  setGenres: (genres: Genre[]) => void;
  setListeningStats: (s: ListeningStats) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  config: {
    theme: { accent_color: 'cyan', font_size: 14, show_album_art: true },
    playback: { volume: 0.8, speed: 1.0, gapless: false, crossfade_secs: 0 },
    lyrics: { provider: 'ytmusic' },
    local_dirs: [],
  },
  tracks: [],
  albums: [],
  artists: [],
  folders: [],
  genres: [],
  listeningStats: null,
  loading: false,
  error: null,

  setConfig: (config) => set({ config }),
  setTracks: (tracks) => set({ tracks }),
  setAlbums: (albums) => set({ albums }),
  setArtists: (artists) => set({ artists }),
  setFolders: (folders) => set({ folders }),
  setGenres: (genres) => set({ genres }),
  setListeningStats: (listeningStats) => set({ listeningStats }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
