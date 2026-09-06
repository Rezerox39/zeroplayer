import { create } from 'zustand';
import type { PlaybackState, Track, RepeatMode, ViewTab } from '../types';

interface PlayerStore {
  playback: PlaybackState;
  queue: Track[];
  repeatMode: RepeatMode;
  shuffled: boolean;
  lyrics: string | null;
  lyricsSynced: boolean;
  activeView: ViewTab;
  libraryView: 'tracks' | 'albums' | 'artists' | 'folders' | 'playlists';
  searchQuery: string;
  searchResults: Track[];
  /** Current playable src URL for HTML5 Audio */
  currentSrc: string | null;
  /** Context tracks from the view that initiated playback (search, library, etc.) */
  playContext: Track[];
  playContextIdx: number;
  /** Set of liked track ids (heart state) */
  likedIds: Set<string>;
  /** Home shelves */
  recentlyPlayed: Track[];
  topPlayed: Track[];
  /** Selection mode (ZMT selection-mode parity) */
  selectionMode: boolean;
  selectedIds: Set<string>;
  /** Download progress */
  downloadProgress: number; // -1 idle, 0-100, >100 done
  downloadError: string | null;
  setPlayContext: (tracks: Track[], idx: number) => void;
  setLikedIds: (ids: string[]) => void;
  toggleLike: (trackId: string) => void;
  setRecentlyPlayed: (tracks: Track[]) => void;
  setTopPlayed: (tracks: Track[]) => void;
  setSelectionMode: (v: boolean) => void;
  toggleSelected: (trackId: string) => void;
  clearSelected: () => void;
  setDownloadProgress: (p: number) => void;
  setDownloadError: (e: string | null) => void;

  // Player actions
  setPlayback: (state: PlaybackState) => void;
  setCurrentSrc: (src: string | null) => void;
  updatePosition: (pos: number) => void;
  setQueue: (tracks: Track[]) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearQueue: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  setShuffled: (v: boolean) => void;
  setLyrics: (text: string | null, synced: boolean) => void;
  setActiveView: (view: ViewTab) => void;
  setLibraryView: (view: 'tracks' | 'albums' | 'artists' | 'folders' | 'playlists') => void;
  setSearchQuery: (q: string) => void;
  setSearchResults: (r: Track[]) => void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  playback: {
    status: 'stopped',
    position_secs: 0,
    duration_secs: 0,
    volume: 0.8,
    speed: 1.0,
  },
  queue: [],
  repeatMode: 'off',
  shuffled: false,
  lyrics: null,
  lyricsSynced: false,
  activeView: 'home',
  libraryView: 'tracks',
  searchQuery: '',
  searchResults: [],
  currentSrc: null,
  playContext: [],
  playContextIdx: 0,
  likedIds: new Set(),
  recentlyPlayed: [],
  topPlayed: [],
  selectionMode: false,
  selectedIds: new Set(),
  downloadProgress: -1,
  downloadError: null,
  setLikedIds: (ids) => set({ likedIds: new Set(ids) }),
  toggleLike: (trackId) =>
    set((s) => {
      const next = new Set(s.likedIds);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return { likedIds: next };
    }),
  setRecentlyPlayed: (recentlyPlayed) => set({ recentlyPlayed }),
  setTopPlayed: (topPlayed) => set({ topPlayed }),
  setSelectionMode: (selectionMode) => set({ selectionMode, selectedIds: new Set() }),
  toggleSelected: (trackId) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
      return { selectedIds: next };
    }),
  clearSelected: () => set({ selectedIds: new Set() }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  setDownloadError: (downloadError) => set({ downloadError }),
  setPlayContext: (tracks, idx) => set({ playContext: tracks, playContextIdx: idx }),

  setPlayback: (state) => set({ playback: state }),
  setCurrentSrc: (src) => set({ currentSrc: src }),
  updatePosition: (pos) =>
    set((s) => ({ playback: { ...s.playback, position_secs: pos } })),
  setQueue: (tracks) => set({ queue: tracks }),
  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),
  removeFromQueue: (index) =>
    set((s) => ({ queue: s.queue.filter((_, i) => i !== index) })),
  reorderQueue: (from, to) =>
    set((s) => {
      const q = [...s.queue];
      const [item] = q.splice(from, 1);
      q.splice(to, 0, item);
      return { queue: q };
    }),
  clearQueue: () => set({ queue: [] }),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  setShuffled: (v) => set({ shuffled: v }),
  setLyrics: (text, synced) => set({ lyrics: text, lyricsSynced: synced }),
  setActiveView: (view) => set({ activeView: view }),
  setLibraryView: (view) => set({ libraryView: view }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchResults: (r) => set({ searchResults: r }),
}));
