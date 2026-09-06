import { useEffect } from 'react';
import { usePlayerStore } from '../stores/playerStore';
import { pausePlayback, resumePlayback, cmdNextTrack, cmdPreviousTrack, setVolume } from '../lib/tauri';

export default function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const state = usePlayerStore.getState();

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') (target as HTMLInputElement).blur();
        return;
      }

      const ctx = state.playContext;
      const idx = state.playContextIdx;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (state.playback.status === 'playing') {
            pausePlayback();
            state.setPlayback({ ...state.playback, status: 'paused' });
          } else {
            resumePlayback();
            state.setPlayback({ ...state.playback, status: 'playing' });
          }
          break;

        case 'ArrowRight':
          if (e.shiftKey) {
            e.preventDefault();
            if (ctx.length > 0 && idx < ctx.length - 1) {
              import('../lib/player').then(({ playTrackAndSet }) =>
                playTrackAndSet(ctx[idx + 1], ctx)
              );
            } else if (ctx.length > 0 && idx >= ctx.length - 1 && state.repeatMode === 'all') {
              import('../lib/player').then(({ playTrackAndSet }) =>
                playTrackAndSet(ctx[0], ctx)
              );
            } else {
              cmdNextTrack().then((track) => {
                if (track) {
                  import('../lib/player').then(({ playTrackAndSet }) =>
                    playTrackAndSet(track)
                  );
                }
              });
            }
          }
          break;

        case 'ArrowLeft':
          if (e.shiftKey) {
            e.preventDefault();
            if (ctx.length > 0 && idx > 0) {
              import('../lib/player').then(({ playTrackAndSet }) =>
                playTrackAndSet(ctx[idx - 1], ctx)
              );
            } else {
              cmdPreviousTrack().then((track) => {
                if (track) {
                  import('../lib/player').then(({ playTrackAndSet }) =>
                    playTrackAndSet(track)
                  );
                }
              });
            }
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          const newVol = Math.min(1, state.playback.volume + 0.05);
          setVolume(newVol);
          state.setPlayback({ ...state.playback, volume: newVol });
          break;

        case 'ArrowDown':
          e.preventDefault();
          const vol = Math.max(0, state.playback.volume - 0.05);
          setVolume(vol);
          state.setPlayback({ ...state.playback, volume: vol });
          break;

        case 's':
        case 'S':
          state.setActiveView('search');
          break;

        case 'l':
        case 'L':
          state.setActiveView('library');
          break;

        case 'q':
        case 'Q':
          state.setActiveView('queue');
          break;

        case 'p':
        case 'P':
          state.setActiveView('player');
          break;

        case 'o':
        case 'O':
          state.setActiveView('stats');
          break;
        case 'h':
        case 'H':
          state.setActiveView('home');
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
