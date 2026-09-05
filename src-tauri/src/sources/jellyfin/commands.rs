use super::{JellyfinClient, JellyfinLibrary};
use crate::library::Track;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn jellyfin_connect(
    state: State<'_, AppState>,
    server_url: String,
    api_key: String,
    user_id: String,
) -> Result<String, String> {
    let client = JellyfinClient::new(&server_url, &api_key, &user_id);
    let name = client.ping().await?;
    // Save config
    let mut config = state.config.write().await;
    config.jellyfin = Some(crate::config::JellyfinConfig {
        server_url,
        api_key,
        user_id,
    });
    Ok(format!("Connected to {}", name))
}

#[tauri::command]
pub async fn jellyfin_get_libraries(
    state: State<'_, AppState>,
) -> Result<Vec<JellyfinLibrary>, String> {
    let config = state.config.read().await;
    let jc = config.jellyfin.as_ref().ok_or("Jellyfin not configured")?;
    let client = JellyfinClient::new(&jc.server_url, &jc.api_key, &jc.user_id);
    client.get_libraries().await
}

#[tauri::command]
pub async fn jellyfin_get_tracks(
    state: State<'_, AppState>,
    library_id: String,
) -> Result<Vec<Track>, String> {
    let config = state.config.read().await;
    let jc = config.jellyfin.as_ref().ok_or("Jellyfin not configured")?;
    let client = JellyfinClient::new(&jc.server_url, &jc.api_key, &jc.user_id);
    let tracks = client.get_tracks(&library_id).await?;
    // Index tracks in local DB
    for track in &tracks {
        state.library.upsert_track(track).map_err(|e| e.to_string())?;
    }
    Ok(tracks)
}

#[tauri::command]
pub async fn jellyfin_search(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Track>, String> {
    let config = state.config.read().await;
    let jc = config.jellyfin.as_ref().ok_or("Jellyfin not configured")?;
    let client = JellyfinClient::new(&jc.server_url, &jc.api_key, &jc.user_id);
    client.search(&query).await
}
