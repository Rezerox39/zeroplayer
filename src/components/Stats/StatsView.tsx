import { useEffect } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { getListeningStats } from '../../lib/tauri';

function formatDuration(secs: number): string {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function StatsView() {
  const { listeningStats, setListeningStats, tracks } = useLibraryStore();

  useEffect(() => {
    getListeningStats()
      .then(setListeningStats)
      .catch(() => {});
  }, []);

  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);

  return (
    <div className="p-6">
      <h2 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mb-6">statistics</h2>

      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <StatCard label="Total Plays" value={listeningStats?.total_plays?.toString() || '0'} />
        <StatCard label="Listening Time" value={formatDuration(listeningStats?.total_listening_seconds || 0)} />
        <StatCard label="Unique Tracks" value={listeningStats?.unique_tracks?.toString() || '0'} />
        <StatCard label="Library Size" value={`${tracks.length} tracks`} />
        <StatCard label="Total Duration" value={formatDuration(totalDuration)} />
        <StatCard label="Sources" value={`${new Set(tracks.map((t) => t.source)).size} active`} />
      </div>

      <h3 className="font-mono text-[10px] tracking-widest uppercase text-gray-600 mt-8 mb-4">top tracks</h3>
      <div className="divide-y divide-surface-2 max-w-xl">
        {tracks
          .slice()
          .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
          .slice(0, 10)
          .map((track, i) => (
            <div key={track.id} className="flex items-center gap-3 py-2">
              <span className="font-mono text-[10px] text-gray-600 w-4 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs text-gray-200 truncate">{track.title}</div>
                <div className="font-mono text-[10px] text-gray-500">{track.artist || '—'}</div>
              </div>
              <span className="font-mono text-[10px] text-gray-600">
                ×{track.play_count || 0}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 border border-surface-2 p-4">
      <div className="font-mono text-[9px] tracking-widest uppercase text-gray-600">{label}</div>
      <div className="font-mono text-lg text-gray-200 mt-1">{value}</div>
    </div>
  );
}
