import { useState } from 'react';
import { updateTrackMeta } from '../../lib/tauri';
import type { Track } from '../../types';

interface Props {
  track: Track;
  onClose: () => void;
  onSave: (updated: Track) => void;
}

export default function TagEditorModal({ track, onClose, onSave }: Props) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist || '');
  const [album, setAlbum] = useState(track.album || '');
  const [genre, setGenre] = useState(track.genre || '');
  const [year, setYear] = useState(track.year?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTrackMeta(
        track.id, title, artist, album, genre,
        year ? parseInt(year, 10) : null,
      );
      onSave({ ...track, title, artist, album, genre, year: year ? parseInt(year, 10) : undefined });
      setMsg('saved');
      setTimeout(onClose, 800);
    } catch (e: any) {
      setMsg(String(e));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="bg-surface-1 border border-surface-3 w-[420px] shadow-2xl shadow-black"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-surface-2 flex items-center justify-between">
          <span className="font-mono text-[10px] tracking-widest uppercase text-gray-400">edit tags</span>
          <button onClick={onClose} className="text-gray-600 hover:text-white text-xs">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <Row label="title" value={title} onChange={setTitle} />
          <Row label="artist" value={artist} onChange={setArtist} />
          <Row label="album" value={album} onChange={setAlbum} />
          <Row label="genre" value={genre} onChange={setGenre} />
          <Row label="year" value={year} onChange={setYear} placeholder="2024" />
          {msg && <div className="font-mono text-[10px] text-[var(--accent)]">{'>'} {msg}</div>}
        </div>
        <div className="px-5 py-4 border-t border-surface-2 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-surface-3 font-mono text-[10px] text-gray-400 hover:text-white transition-colors">cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border border-[var(--accent)] font-mono text-[10px] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors disabled:opacity-50"
          >
            {saving ? 'saving...' : 'save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-3">
      <label className="font-mono text-[10px] text-gray-500 w-16">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-surface-2 text-gray-300 font-mono text-xs px-3 py-1.5 border border-surface-3 focus:border-[var(--accent)] outline-none"
      />
    </div>
  );
}
