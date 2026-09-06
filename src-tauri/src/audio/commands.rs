use super::player::PlaybackState;
use crate::library::Track;
use crate::AppState;
use tauri::State;

/// Return value for the play command — includes the resolved file URL
/// so the frontend HTML5 Audio can play it directly.
#[derive(serde::Serialize)]
pub struct PlayResult {
    pub state: PlaybackState,
    /// Resolved local file path (for frontend HTML5 Audio playback)
    pub file_path: Option<String>,
}

#[tauri::command]
pub async fn play(state: State<'_, AppState>, track: Track) -> Result<PlayResult, String> {
    let effective_track = if track.source == "youtube_music" {
        let video_id = track
            .source_id
            .as_ref()
            .ok_or_else(|| "No video ID for YouTube Music track")?;
        let app_dir = std::env::var("APP_DIR").unwrap_or_else(|_| ".".to_string());
        let dl_dir = std::path::PathBuf::from(&app_dir).join("downloads");
        std::fs::create_dir_all(&dl_dir).ok();
        let client = crate::sources::ytmusic::YTMusicClient::new();
        let path = match client.find_cached(video_id, &dl_dir.display().to_string()) {
            Some(cached) => cached,
            None => client
                .download_to_dir(video_id, &dl_dir.display().to_string())
                .map_err(|e| format!("Failed to download YouTube audio: {}", e))?,
        };
        let mut t = track;
        t.file_path = Some(path.clone());
        t
    } else {
        track
    };

    state.player.play_file(&effective_track)?;
    let player_state = state.player.state();

    Ok(PlayResult {
        state: player_state,
        file_path: effective_track.file_path.clone(),
    })
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
pub async fn seek(state: State<'_, AppState>, position_secs: f64) -> Result<(), String> {
    state.player.seek(position_secs);
    Ok(())
}

#[tauri::command]
pub async fn set_volume(state: State<'_, AppState>, volume: f32) -> Result<(), String> {
    state.player.set_volume(volume);
    Ok(())
}

#[tauri::command]
pub async fn set_speed(state: State<'_, AppState>, speed: f32) -> Result<(), String> {
    state.player.set_speed(speed);
    Ok(())
}

#[tauri::command]
pub async fn get_playback_state(state: State<'_, AppState>) -> Result<PlaybackState, String> {
    Ok(state.player.state())
}
