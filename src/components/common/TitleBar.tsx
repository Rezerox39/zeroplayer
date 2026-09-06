import { getCurrentWindow } from '@tauri-apps/api/window';

export default function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="h-9 w-full flex-shrink-0 flex items-center px-4 bg-black-pure border-b border-surface-2 select-none"
    >
      {/* Left: brand + credit */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="font-mono text-xs font-bold tracking-wide accent-text">
          ZeroPlayer
        </span>
        <span className="font-mono text-[10px] text-gray-600">·</span>
        <span className="font-mono text-[10px] text-gray-500 truncate">
          made by abhi ❤️✨
        </span>
      </div>

      {/* Center: drag region spacer */}
      <div className="flex-1 h-full" data-tauri-drag-region />

      {/* Right: macOS-style window controls */}
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <button
          onClick={() => appWindow.minimize()}
          title="Minimize"
          className="mac-dot mac-dot-yellow group"
          aria-label="Minimize"
        >
          <svg className="mac-dot-glyph" viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="5" x2="8" y2="5" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          title="Maximize"
          className="mac-dot mac-dot-green group"
          aria-label="Maximize"
        >
          <svg className="mac-dot-glyph" viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2.5" y="2.5" width="5" height="5" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          title="Close"
          className="mac-dot mac-dot-red group"
          aria-label="Close"
        >
          <svg className="mac-dot-glyph" viewBox="0 0 10 10" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2.5" y1="2.5" x2="7.5" y2="7.5" />
            <line x1="7.5" y1="2.5" x2="2.5" y2="7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
