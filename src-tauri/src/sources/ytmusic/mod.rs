pub mod commands;

use crate::library::Track;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTMusicSearchResult {
    pub video_id: Option<String>,
    pub title: String,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration_secs: Option<f64>,
}

/// Wraps the `ytmusicapi` Python library via a small helper script.
/// This avoids reimplementing YouTube internals in Rust and stays
/// up-to-date with ytmusicapi's maintained codebase.
pub struct YTMusicClient {
    python_script: String,
}

impl YTMusicClient {
    pub fn new() -> Self {
        // The helper script is bundled with the app under python/ytmusic_bridge.py
        Self {
            python_script: "python/ytmusic_bridge.py".to_string(),
        }
    }

    fn run_script(&self, args: &[&str]) -> Result<String, String> {
        let output = std::process::Command::new("python3")
            .arg(&self.python_script)
            .args(args)
            .env("PYTHONUNBUFFERED", "1")
            .output()
            .map_err(|e| format!("Failed to run ytmusicapi: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "ytmusicapi error: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        String::from_utf8(output.stdout).map_err(|e| e.to_string())
    }

    pub fn search(&self, query: &str, filter: &str) -> Result<Vec<YTMusicSearchResult>, String> {
        let out = self.run_script(&["search", query, filter])?;
        let results: Vec<YTMusicSearchResult> = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        Ok(results)
    }

    pub fn get_stream_url(&self, video_id: &str) -> Result<String, String> {
        let out = self.run_script(&["stream_url", video_id])?;
        Ok(out.trim().to_string())
    }

    pub fn get_lyrics(&self, video_id: &str) -> Result<Option<String>, String> {
        let out = self.run_script(&["lyrics", video_id])?;
        let trimmed = out.trim();
        if trimmed.is_empty() || trimmed == "null" {
            Ok(None)
        } else {
            Ok(Some(trimmed.to_string()))
        }
    }

    pub fn to_track(&self, result: YTMusicSearchResult) -> Track {
        Track {
            id: result.video_id.clone().unwrap_or_default(),
            title: result.title,
            artist: result.artist,
            album: result.album,
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            duration: result.duration_secs,
            file_path: None,
            source: "youtube_music".to_string(),
            source_id: result.video_id,
            cover_path: None,
            play_count: Some(0),
            last_played_at: None,
            created_at: None,
            updated_at: None,
        }
    }
}
