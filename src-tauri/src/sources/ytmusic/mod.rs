pub mod commands;

use crate::config::paths;
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTSearchResponse {
    pub entries: Vec<YTMusicSearchResult>,
    pub error: Option<String>,
}

pub struct YTMusicClient {
    python_script: String,
}

impl YTMusicClient {
    pub fn new() -> Self {
        Self {
            python_script: String::new(),
        }
    }

    fn script_path(&self) -> String {
        if self.python_script.is_empty() {
            let path = paths::resolve_resource_path("python/download.py");
            path.display().to_string()
        } else {
            self.python_script.clone()
        }
    }

    fn run_script(&self, args: &[&str]) -> Result<String, String> {
        let python = paths::find_python()
            .ok_or_else(|| "Python not found. Install Python 3.8+ and add to PATH.".to_string())?;

        let script = self.script_path();

        log::info!("Running: {} {} {}", python, script, args.join(" "));

        let output = std::process::Command::new(&python)
            .arg(&script)
            .args(args)
            .env("PYTHONUNBUFFERED", "1")
            .output()
            .map_err(|e| format!("Failed to run Python ({}): {}", python, e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.is_empty() {
            log::warn!("yt-dlp stderr: {}", stderr);
        }

        if !output.status.success() {
            return Err(format!(
                "yt-dlp bridge exited with code {}: {}",
                output.status.code().unwrap_or(-1),
                stderr.chars().take(500).collect::<String>()
            ));
        }

        let stdout = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
        if stdout.trim().is_empty() {
            return Err("yt-dlp bridge returned empty output".to_string());
        }

        Ok(stdout)
    }

    pub fn search(&self, query: &str) -> Result<Vec<YTMusicSearchResult>, String> {
        let out = self.run_script(&["search", query])?;
        let parsed: YTSearchResponse = serde_json::from_str(&out).map_err(|e| {
            log::error!("Failed to parse search output: {}", &out.chars().take(200).collect::<String>());
            format!("Failed to parse yt-dlp output: {}", e)
        })?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        Ok(parsed.entries)
    }

    pub fn resolve_stream(&self, video_id: &str) -> Result<YTStreamResponse, String> {
        let out = self.run_script(&["stream", video_id])?;
        let parsed: YTStreamResponse = serde_json::from_str(&out).map_err(|e| {
            log::error!("Failed to parse stream output: {}", &out.chars().take(200).collect::<String>());
            format!("Failed to parse yt-dlp output: {}", e)
        })?;
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
