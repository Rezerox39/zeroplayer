import { usePlayerStore } from '../../stores/playerStore';
import { cmdRemoveFromQueue, cmdReorderQueue, cmdClearQueue } from '../../lib/tauri';

function formatDuration(secs: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function QueueView() {
  const { queue, removeFromQueue, reorderQueue, clearQueue } = usePlayerStore();
  const playback = usePlayerStore((s) => s.playback);

  const handleClear = async () => {
    await cmdClearQueue();
    clearQueue();
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-2">
        <span className="font-mono text-[10px] tracking-widest text-gray-600 uppercase">
          queue · {queue.length} tracks
        </span>
        <button
          onClick={handleClear}
          className="font-mono text-[10px] px-3 py-1 border border-surface-3 text-gray-500 hover:text-red-400 hover:border-red-400 transition-colors"
        >
          clear
        </button>
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
