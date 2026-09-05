import { usePlayerStore } from '../../stores/playerStore';
import type { ViewTab } from '../../types';

const NAV_ITEMS: { id: ViewTab; label: string; icon: string }[] = [
  { id: 'player', label: 'Player', icon: '♫' },
  { id: 'library', label: 'Library', icon: '≡' },
  { id: 'search', label: 'Search', icon: '/' },
  { id: 'queue', label: 'Queue', icon: '↻' },
  { id: 'stats', label: 'Stats', icon: '◈' },
  { id: 'settings', label: 'Config', icon: '⚙' },
];

export default function Sidebar() {
  const { activeView, setActiveView } = usePlayerStore();

  return (
    <aside className="w-48 flex-shrink-0 flex flex-col bg-black-pure border-r border-surface-2">
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full text-left px-5 py-2.5 font-mono text-xs tracking-wide flex items-center gap-3 transition-colors duration-100
              ${activeView === item.id
                ? 'accent-text bg-surface-2'
                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-1'
              }`}
          >
            <span className="text-sm w-4 text-center">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Source indicators */}
      <div className="px-5 py-4 border-t border-surface-2">
        <div className="font-mono text-[9px] tracking-widest text-gray-600 uppercase mb-3">sources</div>
        <div className="space-y-1.5">
          {['local', 'jellyfin', 'yt-music', 'telegram'].map((src) => (
            <div key={src} className="flex items-center gap-2 font-mono text-[10px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-700" />
              <span>{src}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
