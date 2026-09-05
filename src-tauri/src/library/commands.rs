use super::{Album, Artist, Folder, Playlist, Track};
use crate::AppState;
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
pub async fn scan_local_files(state: State<'_, AppState>, directory: String) -> Result<usize, String> {
    let path = PathBuf::from(&directory);
    let dir_err = format!("Directory not found: {}", directory);
    if !path.exists() {
        return Err(dir_err);
    }

    let tracks = super::scanner::scan_directory(&path);
    let count = tracks.len();

    for track in &tracks {
        state.library.upsert_track(track).map_err(|e| e.to_string())?;
    }

    // Register the directory
    let mut config = state.config.write().await;
    if !config.local_dirs.contains(&directory) {
        config.local_dirs.push(directory);
    }

    Ok(count)
}

#[tauri::command]
pub async fn get_tracks(
    state: State<'_, AppState>,
    source: Option<String>,
) -> Result<Vec<Track>, String> {
    state
        .library
        .get_tracks(source.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_albums(state: State<'_, AppState>) -> Result<Vec<Album>, String> {
    state.library.get_albums().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_artists(state: State<'_, AppState>) -> Result<Vec<Artist>, String> {
    state.library.get_artists().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_folders(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    state.library.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    state.library.get_playlists().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_library(state: State<'_, AppState>, query: String) -> Result<Vec<Track>, String> {
    state.library.search(&query).map_err(|e| e.to_string())
}
