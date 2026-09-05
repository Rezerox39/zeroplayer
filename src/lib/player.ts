import { playTrack, fileUrl } from './tauri';
import { usePlayerStore } from '../stores/playerStore';
import type { Track } from '../types';

/**
 * Play a track (local, yt-music, telegram...).
 * Resolves the playable file URL, starts HTML5 Audio playback,
 * and updates the player store state.
 */
export async function playTrackAndSet(track: Track): Promise<void> {
  const { setPlayback, setCurrentSrc } = usePlayerStore.getState();
  const result = await playTrack(track);
  const fp = (result as any).file_path || track.file_path;
  const src = fp ? fileUrl(fp) : null;
  setCurrentSrc(src);
  setPlayback(result.state);
}
