use super::{ListeningStats, TrackStats};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn get_track_stats(
    state: State<'_, AppState>,
    track_id: String,
) -> Result<Option<TrackStats>, String> {
    state.stats.get_track_stats(&track_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_listening_stats(
    state: State<'_, AppState>,
) -> Result<ListeningStats, String> {
    state.stats.get_listening_stats().map_err(|e| e.to_string())
}
