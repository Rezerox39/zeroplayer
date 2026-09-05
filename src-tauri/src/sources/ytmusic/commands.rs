use super::{YTMusicClient, YTMusicSearchResult};
use crate::library::Track;

#[tauri::command]
pub async fn ytmusic_search(
    query: String,
    filter: Option<String>,
) -> Result<Vec<YTMusicSearchResult>, String> {
    let client = YTMusicClient::new();
    let filter = filter.unwrap_or_else(|| "songs".to_string());
    client.search(&query, &filter)
}

#[tauri::command]
pub async fn ytmusic_get_stream_url(video_id: String) -> Result<String, String> {
    let client = YTMusicClient::new();
    client.get_stream_url(&video_id)
}

#[tauri::command]
pub async fn ytmusic_get_lyrics(video_id: String) -> Result<Option<String>, String> {
    let client = YTMusicClient::new();
    client.get_lyrics(&video_id)
}

#[tauri::command]
pub async fn ytmusic_search_as_tracks(
    query: String,
) -> Result<Vec<Track>, String> {
    let client = YTMusicClient::new();
    let results = client.search(&query, "songs")?;
    Ok(results.into_iter().map(|r| client.to_track(r)).collect())
}
