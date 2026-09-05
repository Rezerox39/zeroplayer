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

/// Auto-scan common music directories (Downloads, Music, etc.)
#[tauri::command]
pub async fn auto_scan_music(state: State<'_, AppState>) -> Result<usize, String> {
    let common_dirs = crate::config::paths::get_common_music_dirs();
    let mut total = 0;
    for dir in &common_dirs {
        if !dir.exists() || !dir.is_dir() {
            continue;
        }
        let dir_str = dir.display().to_string();
        // Skip if already scanned
        {
            let config = state.config.read().await;
            if config.local_dirs.contains(&dir_str) {
                continue;
            }
        }
        let tracks = super::scanner::scan_directory(dir);
        let count = tracks.len();
        if count > 0 {
            for track in &tracks {
                if let Err(e) = state.library.upsert_track(track) {
                    log::warn!("Failed to insert track {}: {}", track.title, e);
                }
            }
            total += count;
            // Register the directory
            let mut config = state.config.write().await;
            if !config.local_dirs.contains(&dir_str) {
                config.local_dirs.push(dir_str);
            }
        }
    }
    Ok(total)
}

/// Get common music directories on this system
#[tauri::command]
pub async fn get_common_music_dirs() -> Result<Vec<String>, String> {
    let dirs = crate::config::paths::get_common_music_dirs();
    Ok(dirs.into_iter().map(|d| d.display().to_string()).collect())
}
