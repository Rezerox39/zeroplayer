use super::{Album, Artist, Folder, Genre, Playlist, Track};
use crate::AppState;
use serde::{Deserialize, Serialize};
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
pub async fn get_genres(state: State<'_, AppState>) -> Result<Vec<Genre>, String> {
    state.library.get_genres().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_folders(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    state.library.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlists(state: State<'_, AppState>) -> Result<Vec<Playlist>, String> {
    state.library.get_playlists().map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotifyImportResult {
    pub name: String,
    pub imported: usize,
    pub total: usize,
}

#[tauri::command]
pub async fn create_playlist(state: State<'_, AppState>, name: String) -> Result<Playlist, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }
    state.library.create_playlist(&trimmed).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, AppState>, playlist_id: String) -> Result<(), String> {
    state.library.delete_playlist(&playlist_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_to_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track: Track,
) -> Result<(), String> {
    state.library.add_to_playlist(&playlist_id, &track).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_from_playlist(
    state: State<'_, AppState>,
    playlist_id: String,
    track_id: String,
) -> Result<(), String> {
    state.library.remove_from_playlist(&playlist_id, &track_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_playlist_tracks(
    state: State<'_, AppState>,
    playlist_id: String,
) -> Result<Vec<Track>, String> {
    state.library.get_playlist_tracks(&playlist_id).map_err(|e| e.to_string())
}

/// Import a Spotify playlist URL: scrape the public embed page for its
/// track list (mirrors ZMT's UrlPlaylistResolver), then search YouTube Music
/// for each track via yt-dlp and store everything in a new playlist.
#[tauri::command]
pub async fn import_spotify_playlist(
    state: State<'_, AppState>,
    url: String,
) -> Result<SpotifyImportResult, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let playlist_id = resolve_spotify_id(&client, url.trim()).await?;
    let page_url = format!("https://open.spotify.com/embed/playlist/{}", playlist_id);
    let html = client
        .get(&page_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Spotify page: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Failed to read Spotify page: {}", e))?;

    let (name, entries) = parse_spotify_next_data(&html);
    if entries.is_empty() {
        return Err("Could not fetch tracks from Spotify playlist (is it public?)".to_string());
    }

    let safe_name = format!("spotify-{}", name.trim());
    let playlist = state.library.create_playlist(&safe_name).map_err(|e| e.to_string())?;

    let yt = crate::sources::ytmusic::YTMusicClient::new();
    let mut imported = 0usize;
    for (i, (title, artist)) in entries.iter().enumerate() {
        let query = if artist.trim().is_empty() {
            title.clone()
        } else {
            format!("{} {}", title, artist)
        };
        let results = match yt.search(&query) {
            Ok(r) => r,
            Err(_) => continue,
        };
        if let Some(result) = results.into_iter().find(|r| !r.id.is_empty()) {
            let mut track = yt.to_track(result);
            track.track_number = Some((i + 1) as i32);
            if state.library.add_to_playlist(&playlist.id, &track).is_ok() {
                imported += 1;
            }
        }
    }

    if imported == 0 {
        let _ = state.library.delete_playlist(&playlist.id);
        return Err("Could not find any songs on YouTube".to_string());
    }

    Ok(SpotifyImportResult {
        name: playlist.name,
        imported,
        total: entries.len(),
    })
}

/// Download a track to the app's downloads folder (YouTube → yt-dlp,
/// local → file copy). Returns the destination path.
#[tauri::command]
pub async fn download_track(state: State<'_, AppState>, track: Track) -> Result<String, String> {
    let app_dir = std::env::var("APP_DIR").unwrap_or_else(|_| ".".to_string());
    let dl_dir = std::path::PathBuf::from(&app_dir).join("downloads");
    std::fs::create_dir_all(&dl_dir).map_err(|e| e.to_string())?;

    match track.source.as_str() {
        "youtube_music" => {
            let video_id = track
                .source_id
                .as_deref()
                .ok_or_else(|| "YouTube track has no video id".to_string())?;
            let client = crate::sources::ytmusic::YTMusicClient::new();
            let path = client.download_to_dir(video_id, &dl_dir.display().to_string())?;
            let mut t = track;
            t.file_path = Some(path.clone());
            t.source = "local".to_string();
            let _ = state.library.upsert_track(&t);
            Ok(path)
        }
        "local" => {
            let src = track
                .file_path
                .as_deref()
                .ok_or_else(|| "Local track has no file path".to_string())?;
            let src_path = std::path::Path::new(src);
            if !src_path.exists() {
                return Err(format!("File not found: {}", src));
            }
            let file_name = src_path
                .file_name()
                .ok_or_else(|| "Invalid file name".to_string())?;
            let dest = dl_dir.join(file_name);
            std::fs::copy(src_path, &dest).map_err(|e| e.to_string())?;
            Ok(dest.display().to_string())
        }
        "telegram" => Err(
            "Telegram audio is cached automatically when played; use the channel list to download specific files"
                .to_string(),
        ),
        other => Err(format!("Download not supported for source: {}", other)),
    }
}

fn extract_spotify_id_from_url(url: &str) -> Option<String> {
    const MARKER: &str = "spotify.com/playlist/";
    let idx = url.find(MARKER)?;
    let rest = &url[idx + MARKER.len()..];
    let id: String = rest
        .chars()
        .take_while(|c| c.is_ascii_alphanumeric())
        .collect();
    if id.is_empty() {
        None
    } else {
        Some(id)
    }
}

async fn resolve_spotify_id(client: &reqwest::Client, url: &str) -> Result<String, String> {
    if let Some(id) = extract_spotify_id_from_url(url) {
        return Ok(id);
    }
    // spotify.link short links: follow the redirect and read the final URL
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to resolve Spotify link: {}", e))?;
    let final_url = resp.url().to_string();
    extract_spotify_id_from_url(&final_url)
        .ok_or_else(|| "Could not extract Spotify playlist ID".to_string())
}

fn parse_spotify_next_data(html: &str) -> (String, Vec<(String, String)>) {
    let fallback = "spotify-playlist".to_string();
    let start_marker = r#"<script id="__NEXT_DATA__""#;
    let start = match html.find(start_marker) {
        Some(s) => s,
        None => return (fallback, vec![]),
    };
    let json_start = match html[start..].find('>') {
        Some(o) => start + o + 1,
        None => return (fallback, vec![]),
    };
    let json_end = match html[json_start..].find("</script>") {
        Some(o) => json_start + o,
        None => html.len(),
    };
    let blob = &html[json_start..json_end];
    let parsed: serde_json::Value = match serde_json::from_str(blob) {
        Ok(v) => v,
        Err(_) => return (fallback, vec![]),
    };

    let entity = parsed
        .get("props")
        .and_then(|p| p.get("pageProps"))
        .and_then(|p| p.get("state"))
        .and_then(|s| s.get("data"))
        .and_then(|d| d.get("entity"));
    let Some(entity) = entity else {
        return (fallback, vec![]);
    };

    let name = entity
        .get("name")
        .and_then(|n| n.as_str())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| fallback.clone());
    let mut entries = Vec::new();
    if let Some(track_list) = entity.get("trackList").and_then(|t| t.as_array()) {
        for item in track_list {
            let title = item.get("title").and_then(|t| t.as_str());
            if let Some(title) = title {
                let subtitle = item
                    .get("subtitle")
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_string();
                entries.push((title.trim().to_string(), subtitle.trim().to_string()));
            }
        }
    }
    (name, entries)
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
/// Import a YouTube Music / YouTube playlist URL: fetch all entries via yt-dlp,
/// store as a playlist with youtube_music source tracks (no re-search needed).
#[tauri::command]
pub async fn import_youtube_playlist(
    state: State<'_, AppState>,
    url: String,
) -> Result<SpotifyImportResult, String> {
    let yt = crate::sources::ytmusic::YTMusicClient::new();
    let entries = yt.list_playlist(&url)?;
    if entries.is_empty() {
        return Err("No tracks found in playlist".to_string());
    }

    let playlist_name = format!("yt-{} tracks", entries.len());
    let playlist = state.library.create_playlist(&playlist_name).map_err(|e| e.to_string())?;
    let mut imported = 0usize;
    for (i, entry) in entries.iter().enumerate() {
        let id = entry.id.clone();
        if id.is_empty() { continue; }
        let track = Track {
            id: id.clone(),
            title: entry.title.clone(),
            artist: if entry.artist.is_empty() { None } else { Some(entry.artist.clone()) },
            album: None,
            album_artist: None,
            genre: None,
            year: None,
            track_number: Some((i + 1) as i32),
            duration: None,
            file_path: None,
            source: "youtube_music".to_string(),
            source_id: Some(id),
            cover_path: None,
            play_count: Some(0),
            last_played_at: None,
            created_at: None,
            updated_at: None,
        };
        if state.library.add_to_playlist(&playlist.id, &track).is_ok() {
            imported += 1;
        }
    }

    if imported == 0 {
        let _ = state.library.delete_playlist(&playlist.id);
        return Err("Could not add any tracks from playlist".to_string());
    }

    Ok(SpotifyImportResult {
        name: playlist.name,
        imported,
        total: entries.len(),
    })
}
