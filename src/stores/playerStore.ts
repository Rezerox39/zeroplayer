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

  // Player actions
  setPlayback: (state: PlaybackState) => void;
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
  activeView: 'player',
  libraryView: 'tracks',
  searchQuery: '',
  searchResults: [],

  setPlayback: (state) => set({ playback: state }),
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
