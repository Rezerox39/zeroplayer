use super::{YTMusicClient, YTMusicSearchResult};
use crate::library::Track;

#[tauri::command]
pub async fn ytmusic_search(query: String) -> Result<Vec<YTMusicSearchResult>, String> {
    let client = YTMusicClient::new();
    client.search(&query)
}

#[tauri::command]
pub async fn ytmusic_get_stream_url(video_id: String) -> Result<String, String> {
    let client = YTMusicClient::new();
    let resp = client.resolve_stream(&video_id)?;
    resp.url.ok_or_else(|| "No stream URL found".to_string())
}

#[tauri::command]
pub async fn ytmusic_get_lyrics(video_id: String) -> Result<Option<String>, String> {
    // Use a dedicated script call for lyrics
    let output = std::process::Command::new("python3")
        .arg("python/download.py")
        .args(["lyrics", &video_id])
        .env("PYTHONUNBUFFERED", "1")
        .output()
        .map_err(|e| format!("Failed to run yt-dlp bridge: {}", e))?;

    let out = String::from_utf8_lossy(&output.stdout);
    let trimmed = out.trim();
    if trimmed.is_empty() || trimmed == "null" || trimmed.contains("error") {
        Ok(None)
    } else {
        Ok(Some(trimmed.to_string()))
    }
}

#[tauri::command]
pub async fn ytmusic_search_as_tracks(query: String) -> Result<Vec<Track>, String> {
    let client = YTMusicClient::new();
    let results = client.search(&query)?;
    Ok(results.into_iter().map(|r| client.to_track(r)).collect())
}
