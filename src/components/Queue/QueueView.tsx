import { usePlayerStore } from '../../stores/playerStore';
import {
  cmdRemoveFromQueue,
  cmdReorderQueue,
  cmdClearQueue,
  cmdToggleShuffle,
  cmdSetRepeatMode,
} from '../../lib/tauri';
import type { RepeatMode } from '../../types';

function formatDuration(secs: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QueueView() {
  const { queue, removeFromQueue, reorderQueue, clearQueue, shuffled, setShuffled, repeatMode, setRepeatMode } = usePlayerStore();
  const { selectionMode, setSelectionMode, selectedIds, toggleSelected, clearSelected } = usePlayerStore();
  const playback = usePlayerStore((s) => s.playback);

  const handleClear = async () => {
    await cmdClearQueue();
    clearQueue();
  };

  const handleBulkRemove = async () => {
    const indices = [...selectedIds].map(Number).sort((a, b) => b - a);
    for (const idx of indices) {
      await cmdRemoveFromQueue(idx);
      removeFromQueue(idx);
    }
    clearSelected();
    setSelectionMode(false);
  };

  const moveUp = async (idx: number) => {
    if (idx === 0) return;
    await cmdReorderQueue(idx, idx - 1);
    reorderQueue(idx, idx - 1);
  };

  const moveDown = async (idx: number) => {
    if (idx >= queue.length - 1) return;
    await cmdReorderQueue(idx, idx + 1);
    reorderQueue(idx, idx + 1);
  };

  const remove = async (idx: number) => {
    await cmdRemoveFromQueue(idx);
    removeFromQueue(idx);
  };

  const handleShuffle = async () => {
    const on = await cmdToggleShuffle();
    setShuffled(on);
  };

  const cycleRepeat = async () => {
    const next: Record<RepeatMode, RepeatMode> = { off: 'one', one: 'all', all: 'off' };
    const mode = next[repeatMode];
    await cmdSetRepeatMode(mode);
    setRepeatMode(mode);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-2">
        <span className="font-mono text-[10px] tracking-widest text-gray-600 uppercase">
          queue · {queue.length} tracks
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectionMode(!selectionMode)}
            className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
              selectionMode
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-surface-3 text-gray-500 hover:text-white'
            }`}
          >
            {selectionMode ? `selected ${selectedIds.size}` : 'select'}
          </button>
          {selectionMode && selectedIds.size > 0 && (
            <button
              onClick={handleBulkRemove}
              className="font-mono text-[10px] px-3 py-1 border border-red-600 text-red-400 hover:bg-red-900/30 transition-colors"
            >
              remove ({selectedIds.size})
            </button>
          )}
          <button
            onClick={handleShuffle}
            className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
              shuffled
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-surface-3 text-gray-500 hover:text-white'
            }`}
            title="Toggle shuffle"
          >
            ⤨ shuffle
          </button>
          <button
            onClick={cycleRepeat}
            className={`font-mono text-[10px] px-3 py-1 border transition-colors ${
              repeatMode !== 'off'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-surface-3 text-gray-500 hover:text-white'
            }`}
            title={`Repeat: ${repeatMode}`}
          >
            ↻ {repeatMode}
          </button>
          <button
            onClick={handleClear}
            className="font-mono text-[10px] px-3 py-1 border border-surface-3 text-gray-500 hover:text-red-400 hover:border-red-400 transition-colors"
          >
            clear
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-surface-2">
        {queue.map((track, i) => {
          const isCurrent = playback.current_track?.id === track.id;
          return (
            <div
              key={`${track.id}-${i}`}
              className={`flex items-center gap-3 px-5 py-2.5 transition-colors
                ${isCurrent ? 'bg-surface-2 border-l-2' : 'border-l-2 border-transparent hover:bg-surface-1'}`}
              style={isCurrent ? { borderLeftColor: 'var(--accent)' } : undefined}
            >
              {selectionMode && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(String(i))}
                  onChange={() => toggleSelected(String(i))}
                  className="accent-[var(--accent)]"
                />
              )}
              <span className="font-mono text-[10px] text-gray-600 w-6 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
                <div className="font-mono text-[10px] text-gray-500 truncate">
                  {track.artist || '—'}
                  {track.duration ? ` · ${formatDuration(track.duration)}` : ''}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => moveUp(i)} className="font-mono text-[9px] text-gray-600 hover:text-white px-1">▲</button>
                <button onClick={() => moveDown(i)} className="font-mono text-[9px] text-gray-600 hover:text-white px-1">▼</button>
                <button onClick={() => remove(i)} className="font-mono text-[9px] text-gray-600 hover:text-red-400 px-1">✕</button>
              </div>
            </div>
          );
        })}
        {queue.length === 0 && (
          <div className="p-12 text-center font-mono text-xs text-gray-600">
            queue is empty
          </div>
        )}
      </div>
    </div>
  );
}
