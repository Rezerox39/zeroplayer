import { useState } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { updateConfig, jellyfinConnect, telegramConnect } from '../../lib/tauri';
import type { AccentColor } from '../../types';

const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'green', label: 'deep green', color: '#00ff88' },
  { id: 'cyan', label: 'cyan', color: '#00e5ff' },
  { id: 'purple', label: 'purple', color: '#b366ff' },
];

export default function SettingsView() {
  const { config, setConfig } = useLibraryStore();
  const [jellyfinUrl, setJellyfinUrl] = useState(config.jellyfin?.server_url || '');
  const [jellyfinKey, setJellyfinKey] = useState(config.jellyfin?.api_key || '');
  const [jellyfinUser, setJellyfinUser] = useState(config.jellyfin?.user_id || '');
  const [tgToken, setTgToken] = useState(config.telegram?.bot_token || '');
  const [tgChannels, setTgChannels] = useState(config.telegram?.channels.join(', ') || '');
  const [msg, setMsg] = useState('');

  const saveTheme = async (color: AccentColor) => {
    const newConfig = { ...config, theme: { ...config.theme, accent_color: color } };
    await updateConfig(newConfig);
    setConfig(newConfig);
    document.documentElement.style.setProperty(
      '--accent',
      ACCENT_COLORS.find((c) => c.id === color)?.color || '#00e5ff',
    );
  };

  const saveJellyfin = async () => {
    try {
      const resp = await jellyfinConnect(jellyfinUrl, jellyfinKey, jellyfinUser);
      setMsg(resp);
    } catch (e: any) {
      setMsg(e.toString());
    }
  };

  const saveTelegram = async () => {
    const channels = tgChannels.split(',').map((c) => c.trim()).filter(Boolean);
    try {
      const resp = await telegramConnect(tgToken, channels);
      setMsg(resp);
    } catch (e: any) {
      setMsg(e.toString());
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-6">settings</h2>

      {msg && (
        <div className="mb-4 px-3 py-2 bg-surface-2 border border-[var(--accent)] font-mono text-xs text-[var(--accent)]">
          {msg}
        </div>
      )}

      {/* Accent color */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">accent color</h3>
        <div className="flex gap-3">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => saveTheme(c.id)}
              className={`px-4 py-2 border font-mono text-xs transition-colors ${
                config.theme.accent_color === c.id
                  ? 'border-current'
                  : 'border-surface-3 hover:border-gray-500'
              }`}
              style={{ color: c.color }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Jellyfin */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">jellyfin server</h3>
        <div className="space-y-2">
          <Input label="server url" value={jellyfinUrl} onChange={setJellyfinUrl} placeholder="http://192.168.1.x:8096" />
          <Input label="api key" value={jellyfinKey} onChange={setJellyfinKey} placeholder="your API key" />
          <Input label="user id" value={jellyfinUser} onChange={setJellyfinUser} placeholder="UUID or user ID" />
          <button onClick={saveJellyfin} className="settings-btn">
            connect
          </button>
        </div>
      </section>

      {/* YouTube Music */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">youtube music</h3>
        <p className="font-mono text-[10px] text-gray-500 mb-2">
          requires ytmusicapi auth setup. run: <code className="text-[var(--accent)]">python3 python/ytmusic_bridge.py setup</code>
        </p>
      </section>

      {/* Telegram */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">telegram channel source</h3>
        <div className="space-y-2">
          <Input label="bot token" value={tgToken} onChange={setTgToken} placeholder="123456:ABC-DEF..." />
          <Input label="channel IDs" value={tgChannels} onChange={setTgChannels} placeholder="@channel1, @channel2" />
          <button onClick={saveTelegram} className="settings-btn">
            connect
          </button>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section>
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">keyboard shortcuts</h3>
        <div className="font-mono text-[10px] text-gray-500 space-y-1">
          <div><kbd className="border border-surface-3 px-1.5">Space</kbd> play / pause</div>
          <div><kbd className="border border-surface-3 px-1.5">→</kbd> next track</div>
          <div><kbd className="border border-surface-3 px-1.5">←</kbd> previous track</div>
          <div><kbd className="border border-surface-3 px-1.5">↑↓</kbd> volume</div>
          <div><kbd className="border border-surface-3 px-1.5">⌘K</kbd> search</div>
        </div>
      </section>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="font-mono text-[10px] text-gray-500 w-24">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none"
      />
    </div>
  );
}
