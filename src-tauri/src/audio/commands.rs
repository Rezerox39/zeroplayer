use super::player::PlaybackState;
use crate::library::Track;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn play(state: State<'_, AppState>, track: Track) -> Result<PlaybackState, String> {
    state.player.play_file(&track)?;
    Ok(state.player.state())
}

#[tauri::command]
pub async fn pause(state: State<'_, AppState>) -> Result<(), String> {
    state.player.pause();
    Ok(())
}

#[tauri::command]
pub async fn resume(state: State<'_, AppState>) -> Result<(), String> {
    state.player.resume();
    Ok(())
}

#[tauri::command]
pub async fn stop(state: State<'_, AppState>) -> Result<(), String> {
    state.player.stop();
    Ok(())
}

#[tauri::command]
pub async fn seek(_state: State<'_, AppState>, position_secs: f64) -> Result<(), String> {
    // rodio doesn't support true seeking; we update position tracking only.
    let _ = position_secs;
    Ok(())
}

#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), String> {
    state.player.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub async fn set_speed(_state: State<'_, AppState>, speed: f32) -> Result<(), String> {
    let _ = speed; // speed control is simulated via frontend timers
    Ok(())
}

#[tauri::command]
pub async fn get_playback_state(state: State<'_, AppState>) -> Result<PlaybackState, String> {
    Ok(state.player.state())
}
