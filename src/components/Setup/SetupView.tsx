import { useEffect, useState } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { updateConfig, getCommonMusicDirs, scanLocalFiles } from '../../lib/tauri';
import type { AccentColor } from '../../types';

const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'red', label: 'crimson red', color: '#DC143C' },
  { id: 'green', label: 'deep green', color: '#00ff88' },
  { id: 'cyan', label: 'cyan', color: '#00e5ff' },
  { id: 'purple', label: 'purple', color: '#b366ff' },
];

const STEPS = ['hello', 'access', 'source', 'look', 'ready'] as const;
type Step = (typeof STEPS)[number];

export default function SetupView() {
  const { config, setConfig } = useLibraryStore();
  const [stepIdx, setStepIdx] = useState(0);
  const [commonDirs, setCommonDirs] = useState<string[]>([]);
  const [selectedDirs, setSelectedDirs] = useState<string[]>([]);
  const [customDir, setCustomDir] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState('');
  const [showArt, setShowArt] = useState(config.theme.show_album_art);
  const [fontSize, setFontSize] = useState(config.theme.font_size || 14);

  const step = STEPS[stepIdx];
  const progressCells = Math.round(((stepIdx + 1) / STEPS.length) * 24);

  useEffect(() => {
    getCommonMusicDirs().then((dirs) => {
      setCommonDirs(dirs);
      const already = dirs.filter((d) => config.local_dirs.includes(d));
      if (already.length) setSelectedDirs(already);
    }).catch(() => {});
  }, []);

  const accent = ACCENT_COLORS.find((c) => c.id === config.theme.accent_color) || ACCENT_COLORS[0];

  const applyLook = (accentColor: AccentColor) => {
    const c = ACCENT_COLORS.find((x) => x.id === accentColor)?.color || '#DC143C';
    document.documentElement.style.setProperty('--accent', c);
    document.documentElement.style.setProperty('--font-size', `${fontSize}px`);
    const newConfig = { ...config, theme: { ...config.theme, accent_color: accentColor, show_album_art: showArt, font_size: fontSize } };
    setConfig(newConfig);
  };

  const toggleDir = (dir: string) => {
    setSelectedDirs((prev) => prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]);
  };

  const addCustomDir = () => {
    const d = customDir.trim();
    if (!d) return;
    if (!selectedDirs.includes(d)) setSelectedDirs((prev) => [...prev, d]);
    setCustomDir('');
  };

  const saveConfig = () => {
    const newConfig = { ...config, setup_done: true, local_dirs: selectedDirs };
    setConfig(newConfig);
    return updateConfig(newConfig);
  };

  const finishSetup = async () => {
    setScanning(true);
    setScanMsg('scanning music folders…');
    const newConfig = { ...config, setup_done: true, local_dirs: selectedDirs };
    setConfig(newConfig);
    await updateConfig(newConfig);
    let scanned = 0;
    for (const dir of selectedDirs) {
      try {
        scanned += await scanLocalFiles(dir);
      } catch { /* skip unreadable */ }
    }
    setScanMsg(`found ${scanned} tracks`);
    setScanning(false);
    // After config saves with setup_done=true, App re-renders into the main UI
    window.location.reload();
  };

  return (
    <div className="h-screen w-screen bg-black-pure flex flex-col font-mono">
      {/* Title */}
      <div className="h-8 w-full flex items-center px-4 border-b border-surface-2" data-tauri-drag-region>
        <span className="accent-bg w-2 h-2 mr-2" />
        <span className="text-[10px] tracking-widest text-gray-300 uppercase">zeroplayer · setup</span>
        <span className="ml-auto text-[10px] text-gray-600">{STEPS[stepIdx]}</span>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-surface-2">
        <div className="text-[10px] text-gray-500">
          {String(stepIdx + 1).padStart(2, '0')}/{STEPS.length} · {step}
        </div>
        <div className="mt-1 text-xs leading-none">
          <span className="text-[var(--accent)]">{'█'.repeat(progressCells)}</span>
          <span className="text-gray-700">{'░'.repeat(24 - progressCells)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {step === 'hello' && (
          <div className="max-w-xl">
            <div className="w-24 h-24 bg-surface-2 border border-surface-3 flex items-center justify-center mb-6">
              <span className="text-4xl text-[var(--accent)]">♫</span>
            </div>
            <h1 className="text-lg text-gray-100">welcome to zeroplayer</h1>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed max-w-md">
              a terminal-inspired music player. play local files, stream from
              youtube music (yt-dlp), and pull audio from telegram channels.
              let's get you set up.
            </p>
          </div>
        )}

        {step === 'access' && (
          <div className="max-w-xl">
            <h2 className="text-sm text-gray-300 mb-1">music folders</h2>
            <p className="text-[10px] text-gray-500 mb-4">
              pick where your music lives. common folders are detected automatically.
            </p>
            {commonDirs.map((dir) => (
              <button
                key={dir}
                onClick={() => toggleDir(dir)}
                className={`w-full text-left px-4 py-2.5 border mb-2 transition-colors font-mono text-xs ${
                  selectedDirs.includes(dir)
                    ? 'border-[var(--accent)] text-gray-200'
                    : 'border-surface-3 text-gray-500 hover:text-gray-300'
                }`}
              >
                <span className={selectedDirs.includes(dir) ? 'text-[var(--accent)]' : 'text-gray-700'}>
                  {selectedDirs.includes(dir) ? '(*) ' : '( ) '}
                </span>
                <span className="truncate">{dir}</span>
              </button>
            ))}
            <div className="flex gap-2 mt-3">
              <input
                value={customDir}
                onChange={(e) => setCustomDir(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addCustomDir(); }}
                placeholder="C:\\Users\\you\\Downloads"
                className="flex-1 bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none"
              />
              <button onClick={addCustomDir} className="px-4 py-1.5 border border-surface-3 text-gray-400 hover:text-white hover:border-[var(--accent)] text-[10px]">
                add
              </button>
            </div>
            <div className="mt-3 text-[10px] text-gray-600">
              {selectedDirs.length} folder{selectedDirs.length === 1 ? '' : 's'} selected
            </div>
          </div>
        )}

        {step === 'source' && (
          <div className="max-w-xl">
            <h2 className="text-sm text-gray-300 mb-1">sources</h2>
            <p className="text-[10px] text-gray-500 mb-4">
              zeroplayer is multi-source — all of these stay enabled.
            </p>
            {[
              { name: 'local files', why: 'mp3/flac/wav/m4a/ogg from your folders', on: true },
              { name: 'youtube music', why: 'search + stream any song via yt-dlp (pip install yt-dlp)', on: true },
              { name: 'telegram', why: 'signed-in user session via pyrogram (pip install pyrogram)', on: true },
            ].map((src) => (
              <div key={src.name} className="py-3 border-b border-surface-2">
                <div className="text-xs text-gray-200">
                  <span className="text-[var(--accent)]">(*) </span>
                  {src.name}
                </div>
                <div className="text-[10px] text-gray-600 pl-4 mt-0.5">{src.why}</div>
              </div>
            ))}
          </div>
        )}

        {step === 'look' && (
          <div className="max-w-xl">
            <h2 className="text-sm text-gray-300 mb-1">look & feel</h2>
            <p className="text-[10px] text-gray-500 mb-4">match your vibe.</p>

            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">accent theme</div>
            <div className="flex gap-3 mb-5">
              {ACCENT_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => applyLook(c.id)}
                  className={`px-4 py-2 border font-mono text-[10px] transition-colors ${
                    config.theme.accent_color === c.id ? 'border-current' : 'border-surface-3 hover:border-gray-500'
                  }`}
                  style={{ color: c.color }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-gray-500 mb-2 uppercase tracking-widest">album art</div>
            <button
              onClick={() => {
                setShowArt(!showArt);
                applyLook(config.theme.accent_color);
              }}
              className="px-4 py-2 border border-surface-3 font-mono text-[10px] text-gray-300 hover:border-[var(--accent)] transition-colors"
            >
              {showArt ? '(*) shown' : '( ) hidden'}
            </button>

            <div className="text-[10px] text-gray-500 mt-5 mb-2 uppercase tracking-widest">font size · {fontSize}px</div>
            <div className="flex gap-2 items-center">
              <button onClick={() => { setFontSize(Math.max(10, fontSize - 1)); document.documentElement.style.setProperty('--font-size', `${Math.max(10, fontSize - 1)}px`); }} className="px-3 py-1.5 border border-surface-3 text-gray-400 hover:text-white text-[10px]">−</button>
              <input
                type="range" min={10} max={20} value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFontSize(v);
                  document.documentElement.style.setProperty('--font-size', `${v}px`);
                }}
                className="flex-1 accent-[var(--accent)]"
              />
              <button onClick={() => { setFontSize(Math.min(20, fontSize + 1)); document.documentElement.style.setProperty('--font-size', `${Math.min(20, fontSize + 1)}px`); }} className="px-3 py-1.5 border border-surface-3 text-gray-400 hover:text-white text-[10px]">+</button>
            </div>

            <div className="mt-6 p-4 bg-surface-2 border border-surface-3">
              <div className="text-xs text-gray-200">
                <span className="accent-bg w-2 h-2 inline-block mr-2" />
                zeroplayer · <span className="text-[var(--accent)]">preview</span>
              </div>
              <div className="mt-2 h-10 flex items-end gap-1">
                {[6, 9, 4, 12, 8, 15, 5, 10, 7, 13, 4, 9].map((h, i) => (
                  <span key={i} className="w-1.5 eq-bar" style={{ height: `${h * 5}%` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'ready' && (
          <div className="max-w-xl">
            <h2 className="text-lg text-gray-100">all set.</h2>
            <div className="mt-4 text-xs text-gray-400 space-y-2">
              <div><span className="text-[var(--accent)]">▸</span> theme: <span className="text-gray-200">{accent.label}</span></div>
              <div><span className="text-[var(--accent)]">▸</span> album art: <span className="text-gray-200">{showArt ? 'shown' : 'hidden'}</span></div>
              <div><span className="text-[var(--accent)]">▸</span> folders: <span className="text-gray-200">{selectedDirs.length ? selectedDirs.join(', ') : 'auto-scan'}</span></div>
              <div><span className="text-[var(--accent)]">▸</span> sources: local · youtube music · telegram</div>
            </div>
            {scanMsg && (
              <div className="mt-4 font-mono text-[10px] text-[var(--accent)]">{'>'} {scanMsg}</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-surface-2 flex items-center justify-between">
        <button
          onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0}
          className="px-4 py-2 border border-surface-3 text-gray-400 hover:text-white text-[10px] disabled:opacity-30"
        >
          ← back
        </button>
        {stepIdx < STEPS.length - 1 ? (
          <button
            onClick={() => setStepIdx(stepIdx + 1)}
            className="px-6 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black text-[10px] transition-colors"
          >
            next →
          </button>
        ) : (
          <button
            onClick={finishSetup}
            disabled={scanning}
            className="px-6 py-2 border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black text-[10px] transition-colors disabled:opacity-50"
          >
            {scanning ? 'scanning…' : 'launch ⏎'}
          </button>
        )}
      </div>
    </div>
  );
}
