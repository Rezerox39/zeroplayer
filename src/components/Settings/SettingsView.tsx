import { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { updateConfig, jellyfinConnect, telegramConnect, telegramResetSession, telegramSendPhone, telegramSubmitCode, telegramSubmitPassword, telegramGetChannels, getBlocklist, blockTrack, unblockTrack } from '../../lib/tauri';
import type { AccentColor } from '../../types';
import type { BlockEntry } from '../../types';

const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'red', label: 'crimson red', color: '#DC143C' },
  { id: 'green', label: 'deep green', color: '#00ff88' },
  { id: 'cyan', label: 'cyan', color: '#00e5ff' },
  { id: 'purple', label: 'purple', color: '#b366ff' },
];

type TgStep = 'setup' | 'phone' | 'code' | 'password' | 'done';

export default function SettingsView() {
  const { config, setConfig } = useLibraryStore();
  const [jellyfinUrl, setJellyfinUrl] = useState(config.jellyfin?.server_url || '');
  const [jellyfinKey, setJellyfinKey] = useState(config.jellyfin?.api_key || '');
  const [jellyfinUser, setJellyfinUser] = useState(config.jellyfin?.user_id || '');
  const [msg, setMsg] = useState('');

  // Telegram login state
  const [tgStep, setTgStep] = useState<TgStep>('setup');
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [tgChannels, setTgChannels] = useState<string[]>([]);
  const [tgError, setTgError] = useState('');
  const [tgLoading, setTgLoading] = useState(false);
  const [blocklist, setBlocklist] = useState<BlockEntry[]>([]);
  const [blockInput, setBlockInput] = useState('');
  const [eqPreset, setEqPreset] = useState(config.playback.equalizer_preset ?? -1);

  // Check if Telegram auth is already set up
  useEffect(() => {
    telegramGetChannels()
      .then((channels) => {
        if (channels.length > 0) {
          setTgChannels(channels.map((c: any) => c.title));
        }
      })
      .catch(() => {});
  }, []);

  const EQ_PRESETS = ['flat', 'bass boost', 'treble boost', 'vocal', 'loud', 'custom'];

  const saveTheme = async (color: AccentColor) => {
    const newConfig = { ...config, theme: { ...config.theme, accent_color: color } };
    await updateConfig(newConfig);
    setConfig(newConfig);
    document.documentElement.style.setProperty(
      '--accent',
      ACCENT_COLORS.find((c) => c.id === color)?.color || '#DC143C',
    );
  };

  const loadBlocklist = async () => {
    try { setBlocklist(await getBlocklist()); } catch {}
  };
  useEffect(() => { loadBlocklist(); }, []);

  const toggleBlock = async (path: string) => {
    const existing = blocklist.find((b) => b.path === path);
    if (existing) {
      await unblockTrack(path);
    } else {
      await blockTrack(path);
    }
    await loadBlocklist();
  };

  const handleBlockInput = async () => {
    const p = blockInput.trim();
    if (!p) return;
    await blockTrack(p);
    setBlockInput('');
    await loadBlocklist();
  };

  const savePlayback = async (patch: Record<string, any>) => {
    const newConfig = { ...config, playback: { ...config.playback, ...patch } };
    await updateConfig(newConfig);
    setConfig(newConfig);
  };

  const saveJellyfin = async () => {
    try {
      const resp = await jellyfinConnect(jellyfinUrl, jellyfinKey, jellyfinUser);
      setMsg(resp);
    } catch (e: any) {
      setMsg(e.toString());
    }
  };

  // ── Telegram login flow ──────────────────────────────────────────

  const handleTgInit = async () => {
    setTgLoading(true);
    setTgError('');
    try {
      const result = await telegramConnect(parseInt(apiId, 10), apiHash);
      if (result?.status === 'logged_in') {
        setTgStep('done');
        setMsg(`Telegram connected as ${result.first_name}`);
      } else if (result?.status === 'need_phone') {
        setTgStep('phone');
      } else if (result?.error) {
        setTgError(result.error);
      }
    } catch (e: any) {
      setTgError(e.toString());
    }
    setTgLoading(false);
  };

  const handleSendPhone = async () => {
    setTgLoading(true);
    setTgError('');
    try {
      const result = await telegramSendPhone(phoneNumber.trim());
      if (result?.status === 'need_code') {
        setTgStep('code');
      } else if (result?.status === 'need_password') {
        setTgStep('password');
      } else if (result?.error) {
        setTgError(result.error);
      }
    } catch (e: any) {
      setTgError(e.toString());
    }
    setTgLoading(false);
  };

  const handleSubmitCode = async () => {
    setTgLoading(true);
    setTgError('');
    try {
      const result = await telegramSubmitCode(code.trim());
      if (result?.status === 'logged_in') {
        setTgStep('done');
        setMsg(`Telegram connected as ${result.first_name}`);
      } else if (result?.error) {
        setTgError(result.error);
      }
    } catch (e: any) {
      setTgError(e.toString());
    }
    setTgLoading(false);
  };

  const handleSubmitPassword = async () => {
    setTgLoading(true);
    setTgError('');
    try {
      const result = await telegramSubmitPassword(password);
      if (result?.status === 'logged_in') {
        setTgStep('done');
        setMsg(`Telegram connected as ${result.first_name}`);
      } else if (result?.error) {
        setTgError(result.error);
      }
    } catch (e: any) {
      setTgError(e.toString());
    }
    setTgLoading(false);
  };

  const loadChannels = async () => {
    try {
      const channels = await telegramGetChannels();
      setTgChannels((channels as any[]).map((c) => c.title));
      setMsg(`Found ${channels.length} channels`);
    } catch (e: any) {
      setTgError(e.toString());
    }
  };

  const handleTgReset = async () => {
    setTgLoading(true);
    setTgError('');
    try {
      const msg = await telegramResetSession();
      setMsg(msg);
      setTgStep('phone');
      setTgChannels([]);
    } catch (e: any) {
      setTgError(e.toString());
    }
    setTgLoading(false);
  };

  const handleRerunSetup = async () => {
    const newConfig = { ...config, setup_done: false };
    await updateConfig(newConfig);
    setConfig(newConfig);
    window.location.reload();
  };

  // ── Render ───────────────────────────────────────────────────────

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
          uses yt-dlp for stream resolution. requires: <code className="text-[var(--accent)]">pip install yt-dlp</code>
        </p>
      </section>

      {/* Playback */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">playback</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-400">gapless playback</span>
            <button
              onClick={() => savePlayback({ gapless: !config.playback.gapless })}
              className={`px-3 py-1 border font-mono text-[10px] transition-colors ${config.playback.gapless ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-surface-3 text-gray-500'}`}
            >
              {config.playback.gapless ? 'on' : 'off'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-400">normalize volume</span>
            <button
              onClick={() => savePlayback({ normalize_volume: !config.playback.normalize_volume })}
              className={`px-3 py-1 border font-mono text-[10px] transition-colors ${config.playback.normalize_volume ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-surface-3 text-gray-500'}`}
            >
              {config.playback.normalize_volume ? 'on' : 'off'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-400">crossfade</span>
            <button
              onClick={() => savePlayback({ crossfade_secs: config.playback.crossfade_secs > 0 ? 0 : 4 })}
              className={`px-3 py-1 border font-mono text-[10px] transition-colors ${config.playback.crossfade_secs > 0 ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-surface-3 text-gray-500'}`}
            >
              {config.playback.crossfade_secs > 0 ? `${config.playback.crossfade_secs}s` : 'off'}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-gray-400">equalizer</span>
            <button
              onClick={() => {
                const next = (eqPreset + 1) % EQ_PRESETS.length;
                setEqPreset(next);
                savePlayback({ equalizer_preset: next });
              }}
              className="px-3 py-1 border border-surface-3 font-mono text-[10px] text-gray-300 hover:border-[var(--accent)] transition-colors"
            >
              {EQ_PRESETS[(eqPreset + EQ_PRESETS.length) % EQ_PRESETS.length]}
            </button>
          </div>
        </div>
      </section>

      {/* Library sort */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">library</h3>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-gray-400">show album art</span>
          <button
            onClick={() => saveTheme(config.theme.accent_color)}
            className="px-3 py-1 border border-surface-3 font-mono text-[10px] text-gray-300 hover:border-[var(--accent)] transition-colors"
          >
            managed in setup
          </button>
        </div>
      </section>

      {/* Blocklist */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">blocklist</h3>
        <p className="font-mono text-[10px] text-gray-500 mb-3">
          blocked folders/files are excluded from the library and playback.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            value={blockInput}
            onChange={(e) => setBlockInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleBlockInput(); }}
            placeholder="C:\\path\\to\\block"
            className="flex-1 bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none"
          />
          <button onClick={handleBlockInput} className="px-4 py-1.5 border border-surface-3 text-gray-400 hover:text-white hover:border-[var(--accent)] text-[10px]">
            block
          </button>
        </div>
        <div className="divide-y divide-surface-2 border border-surface-2">
          {blocklist.map((b) => (
            <div key={b.path} className="flex items-center justify-between px-3 py-2">
              <span className="font-mono text-[10px] text-gray-400 truncate">{b.path}</span>
              <button
                onClick={() => toggleBlock(b.path)}
                className="text-[10px] text-gray-600 hover:text-red-400"
              >
                unblock
              </button>
            </div>
          ))}
          {blocklist.length === 0 && (
            <div className="px-3 py-3 font-mono text-[10px] text-gray-600">nothing blocked</div>
          )}
        </div>
      </section>

      {/* Telegram - login flow */}
      <section className="mb-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">
          telegram · user login
        </h3>
        <p className="font-mono text-[10px] text-gray-500 mb-3">
          login with your Telegram account to access channel music. requires:
          <code className="text-[var(--accent)]"> pip install pyrogram</code>
        </p>

        {tgError && (
          <div className="mb-3 px-3 py-2 bg-surface-2 border border-red-600 font-mono text-xs text-red-400">
            {tgError}
          </div>
        )}

        {/* Step: setup - API credentials */}
        {tgStep === 'setup' && (
          <div className="space-y-2">
            <Input label="api_id" value={apiId} onChange={setApiId} placeholder="123456" />
            <Input label="api_hash" value={apiHash} onChange={setApiHash} placeholder="your_api_hash" />
            <button onClick={handleTgInit} disabled={tgLoading} className="settings-btn">
              {tgLoading ? 'connecting...' : 'start login'}
            </button>
            <button onClick={handleTgReset} disabled={tgLoading} className="settings-btn">
              reset session
            </button>
          </div>
        )}

        {/* Step: phone number */}
        {tgStep === 'phone' && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-gray-500">
              step 1/3 · enter your phone number
            </div>
            <Input label="phone" value={phoneNumber} onChange={setPhoneNumber} placeholder="+1234567890" />
            <button onClick={handleSendPhone} disabled={tgLoading} className="settings-btn">
              send code
            </button>
          </div>
        )}

        {/* Step: verification code */}
        {tgStep === 'code' && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-gray-500">
              step 2/3 · enter the code sent to your phone
            </div>
            <Input label="code" value={code} onChange={setCode} placeholder="12345" />
            <button onClick={handleSubmitCode} disabled={tgLoading} className="settings-btn">
              verify
            </button>
          </div>
        )}

        {/* Step: 2FA password */}
        {tgStep === 'password' && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] text-gray-500">
              step 3/3 · two-factor auth enabled on this account
            </div>
            <Input label="password" value={password} onChange={setPassword} placeholder="your account password" />
            <button onClick={handleSubmitPassword} disabled={tgLoading} className="settings-btn">
              unlock
            </button>
          </div>
        )}

        {/* Step: done / logged in */}
        {tgStep === 'done' && (
          <div className="space-y-3">
            <div className="font-mono text-xs text-[var(--accent)]">
              ✓ logged in
            </div>
            <div className="font-mono text-[10px] text-gray-500 mb-2">subscribed channels:</div>
            {tgChannels.map((c, i) => (
              <div key={i} className="font-mono text-[10px] text-gray-400 py-1 border-b border-surface-2">
                {c}
              </div>
            ))}
            <button onClick={loadChannels} className="settings-btn">
              refresh channels
            </button>
          </div>
        )}
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

      {/* Setup */}
      <section className="mt-8">
        <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-3">setup</h3>
        <button onClick={handleRerunSetup} className="settings-btn">
          re-run startup setup
        </button>
      </section>

      {/* Credit */}
      <div className="mt-8 text-center pb-4">
        <span className="font-mono text-[10px] text-gray-500">
          made by <a href="https://github.com/Rezerox39/zeroplayer" target="_blank" rel="noreferrer" className="accent-text hover:underline">Abhi ❤️✨</a>
        </span>
      </div>
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
