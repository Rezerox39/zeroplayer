import { playTrack, fileUrl } from './tauri';
import { usePlayerStore } from '../stores/playerStore';
import type { Track } from '../types';

/**
 * Play a track (local, yt-music, telegram...).
 * Resolves the playable file URL, starts HTML5 Audio playback,
 * and updates the player store state.
 */
export async function playTrackAndSet(track: Track, context?: Track[]): Promise<void> {
  const { setPlayback, setCurrentSrc, setPlayContext } = usePlayerStore.getState();
  const result: any = await playTrack(track);
  const fp: string | undefined = result?.file_path || track.file_path;
  const src = fp ? fileUrl(fp) : null;
  setCurrentSrc(src);

  // Remember the surrounding list so next/prev have somewhere to go.
  if (context && context.length > 0) {
    const idx = context.findIndex((t) => t.id === track.id);
    setPlayContext(context, idx >= 0 ? idx : 0);
  } else if (track) {
    setPlayContext([track], 0);
  }

  // Backend returns { state: PlaybackState, file_path } — handle both shapes defensively.
  if (result?.state && 'status' in result.state) {
    setPlayback(result.state);
  } else if (result && 'status' in result) {
    setPlayback(result as any);
  }
}
