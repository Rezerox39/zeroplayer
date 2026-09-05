import { useEffect, useState } from 'react';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import { usePlayerStore } from './stores/playerStore';
import { useLibraryStore } from './stores/libraryStore';
import { getConfig, getTracks, getAlbums, getArtists, getListeningStats, autoScanMusic } from './lib/tauri';
import Sidebar from './components/common/Sidebar';
import Player from './components/Player/Player';
import FullPlayer from './components/Player/FullPlayer';
import LibraryView from './components/Library/LibraryView';
import QueueView from './components/Queue/QueueView';
import SearchView from './components/Search/SearchView';
import StatsView from './components/Stats/StatsView';
import SettingsView from './components/Settings/SettingsView';

export default function App() {
  const { activeView } = usePlayerStore();
  const { config, setConfig, setTracks, setAlbums, setArtists, setListeningStats } = useLibraryStore();
  const [ready, setReady] = useState(false);
  useKeyboardShortcuts();

  useEffect(() => {
    (async () => {
      try {
        const [cfg, tracks, albums, artists, stats] = await Promise.allSettled([
          getConfig(),
          getTracks(),
          getAlbums(),
          getArtists(),
          getListeningStats(),
        ]);
        if (cfg.status === 'fulfilled') setConfig(cfg.value);
        if (tracks.status === 'fulfilled') setTracks(tracks.value);
        if (albums.status === 'fulfilled') setAlbums(albums.value);
        if (artists.status === 'fulfilled') setArtists(artists.value);
        if (stats.status === 'fulfilled') setListeningStats(stats.value);

        // Auto-scan common music folders
        try {
          const scanned = await autoScanMusic();
          if (scanned > 0) {
            // Re-fetch library after auto-scan
            const [t2, a2, ar2] = await Promise.allSettled([getTracks(), getAlbums(), getArtists()]);
            if (t2.status === 'fulfilled') setTracks(t2.value);
            if (a2.status === 'fulfilled') setAlbums(a2.value);
            if (ar2.status === 'fulfilled') setArtists(ar2.value);
          }
        } catch (e) { /* auto-scan best effort */ }

        // Apply accent color to CSS variable
        const accentMap: Record<string, string> = { green: '#00ff88', cyan: '#00e5ff', purple: '#b366ff', red: '#DC143C' };
        const color = accentMap[cfg.status === 'fulfilled' ? cfg.value.theme.accent_color : 'cyan'];
        document.documentElement.style.setProperty('--accent', color);
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <div className="h-screen w-screen bg-black-pure flex items-center justify-center">
        <div className="font-mono text-sm text-gray-500">
          <span className="accent-text">{'>'}</span> initializing zeroplayer...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-black-pure overflow-hidden">
      {/* Top bar - 32px title bar space */}
      <div data-tauri-drag-region className="h-8 w-full flex-shrink-0 flex items-center px-4 bg-black-pure border-b border-surface-2">
        <span className="font-mono text-[10px] tracking-widest text-gray-600 uppercase">
          zeroplayer
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main content area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-black-pure">
          <div className="flex-1 overflow-y-auto">
            {activeView === 'player' && <FullPlayer />}
            {activeView === 'library' && <LibraryView />}
            {activeView === 'search' && <SearchView />}
            {activeView === 'queue' && <QueueView />}
            {activeView === 'stats' && <StatsView />}
            {activeView === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Bottom player bar */}
      <Player />
    </div>
  );
}
