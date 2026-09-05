pub mod commands;

use crate::library::Track;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTMusicSearchResult {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub duration: Option<i64>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTStreamResponse {
    pub id: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub url: Option<String>,
    pub ext: Option<String>,
    pub filesize: Option<u64>,
    pub duration: Option<u64>,
    pub error: Option<String>,
    #[serde(default)]
    pub formats: Vec<YTFormat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTFormat {
    pub format_id: Option<String>,
    pub url: Option<String>,
    pub ext: Option<String>,
    pub acodec: Option<String>,
    pub vcodec: Option<String>,
    pub abr: Option<f64>,
    pub filesize: Option<u64>,
    #[serde(default)]
    pub http_headers: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTSearchResponse {
    pub entries: Vec<YTMusicSearchResult>,
    pub error: Option<String>,
}

/// Wraps the yt-dlp Python bridge (python/download.py).
/// yt-dlp is the primary resolver for stream URLs — it handles
/// signature deobfuscation, n-transform, PO tokens, client rotation.
pub struct YTMusicClient {
    python_script: String,
}

impl YTMusicClient {
    pub fn new() -> Self {
        Self {
            python_script: "python/download.py".to_string(),
        }
    }

    fn run_script(&self, args: &[&str]) -> Result<String, String> {
        let output = std::process::Command::new("python3")
            .arg(&self.python_script)
            .args(args)
            .env("PYTHONUNBUFFERED", "1")
            .output()
            .map_err(|e| format!("Failed to run yt-dlp bridge: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "yt-dlp bridge error: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }

        String::from_utf8(output.stdout).map_err(|e| e.to_string())
    }

    pub fn search(&self, query: &str) -> Result<Vec<YTMusicSearchResult>, String> {
        let out = self.run_script(&["search", query])?;
        let parsed: YTSearchResponse = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        Ok(parsed.entries)
    }

    pub fn resolve_stream(&self, video_id: &str) -> Result<YTStreamResponse, String> {
        let out = self.run_script(&["stream", video_id])?;
        let parsed: YTStreamResponse = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        Ok(parsed)
    }

    pub fn to_track(&self, result: YTMusicSearchResult) -> Track {
        Track {
            id: result.id.clone(),
            title: result.title,
            artist: result.artist,
            album: None,
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            duration: result.duration.map(|d| d as f64),
            file_path: None,
            source: "youtube_music".to_string(),
            source_id: Some(result.id),
            cover_path: result.thumbnail,
            play_count: Some(0),
            last_played_at: None,
            created_at: None,
            updated_at: None,
        }
    }
}
