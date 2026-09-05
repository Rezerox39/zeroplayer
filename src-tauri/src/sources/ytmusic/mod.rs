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

pub struct YTMusicClient;

impl YTMusicClient {
    pub fn new() -> Self { Self }

    fn script_path() -> Result<String, String> {
        let path = paths::resolve_resource_path("python/download.py");
        if path.exists() {
            Ok(path.display().to_string())
        } else {
            Err(format!(
                "Script not found: {}. Make sure python/ folder is in the app directory.",
                path.display()
            ))
        }
    }

    fn run_script(&self, args: &[&str]) -> Result<String, String> {
        let python = paths::find_python().ok_or_else(|| {
            let hint = if cfg!(target_os = "windows") {
                "Install Python from python.org and check 'Add to PATH', or install via Microsoft Store."
            } else {
                "Install python3 via your package manager."
            };
            format!("Python not found. {}", hint)
        })?;

        // Warn if yt-dlp not installed
        if !paths::find_ytdlp_installed(&python) {
            return Err(format!(
                "yt-dlp not installed in {}.\nRun: {} -m pip install yt-dlp",
                python, python
            ));
        }

        let script = Self::script_path()?;
        log::info!("yt-dlp: {} {} {}", python, script, args.join(" "));

        let mut cmd = std::process::Command::new(&python);
        paths::no_console(&mut cmd);
        let output = cmd
            .arg(&script)
            .args(args)
            .env("PYTHONUNBUFFERED", "1")
            .output()
            .map_err(|e| format!("Failed to run {}: {}", python, e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        if !output.status.success() {
            let code = output.status.code().unwrap_or(-1);
            log::error!("yt-dlp exited {} stderr={}", code, stderr);
            return Err(format!(
                "yt-dlp failed (exit {}): {}",
                code,
                stderr.chars().take(500).collect::<String>()
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stdout.trim().is_empty() {
            return Err("yt-dlp returned empty output".into());
        }
        Ok(stdout)
    }

    pub fn search(&self, query: &str) -> Result<Vec<YTMusicSearchResult>, String> {
        let out = self.run_script(&["search", query])?;
        let parsed: YTSearchResponse = serde_json::from_str(&out)
            .map_err(|e| format!("Failed to parse response: {} (output was: {})", e, &out.chars().take(200).collect::<String>()))?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        Ok(parsed.entries)
    }

    pub fn resolve_stream(&self, video_id: &str) -> Result<YTStreamResponse, String> {
        let out = self.run_script(&["stream", video_id])?;
        let parsed: YTStreamResponse = serde_json::from_str(&out)
            .map_err(|e| format!("Failed to parse response: {}", e))?;
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
