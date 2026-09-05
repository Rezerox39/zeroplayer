use super::player::PlaybackState;
use crate::library::Track;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn play(state: State<'_, AppState>, track: Track) -> Result<PlaybackState, String> {
    // For YouTube Music tracks, resolve and download audio via yt-dlp to a temp file
    // before handing it to the rodio-based audio thread.
    let effective_track = if track.source == "youtube_music" {
        let video_id = track
            .source_id
            .as_ref()
            .ok_or_else(|| "No video ID for YouTube Music track")?;
        let client = crate::sources::ytmusic::YTMusicClient::new();
        let file_path = client
            .download_to_temp(video_id)
            .map_err(|e| format!("Failed to download YouTube audio: {}", e))?;
        let mut t = track;
        t.file_path = Some(file_path);
        t
    } else {
        track
    };

    state.player.play_file(&effective_track)?;
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
    let _ = speed;
    Ok(())
}

#[tauri::command]
pub async fn get_playback_state(state: State<'_, AppState>) -> Result<PlaybackState, String> {
    Ok(state.player.state())
}
