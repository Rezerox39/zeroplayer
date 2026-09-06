pub mod commands;

use crate::config::paths;
use crate::library::Track;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAudioInfo {
    pub message_id: i64,
    pub file_id: String,
    pub title: String,
    pub artist: String,
    pub duration: i64,
    pub file_size: i64,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramChannel {
    pub id: i64,
    pub title: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAuthResult {
    pub status: Option<String>,
    pub error: Option<String>,
    pub user_id: Option<i64>,
    pub first_name: Option<String>,
    pub code_info: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramChannelsResult {
    pub channels: Option<Vec<TelegramChannel>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAudioResult {
    pub audio: Option<Vec<TelegramAudioInfo>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramDownloadResult {
    pub file_path: Option<String>,
    pub error: Option<String>,
}

pub struct TelegramClient;

impl TelegramClient {
    pub fn new() -> Self { Self }

    fn run_script(&self, args: &[&str]) -> Result<String, String> {
        let python = paths::find_python().ok_or_else(|| {
            let hint = if cfg!(target_os = "windows") {
                "Install Python from python.org and check 'Add to PATH'."
            } else {
                "Install python3 via your package manager."
            };
            format!("Python not found. {}", hint)
        })?;

        let script = paths::resolve_resource_path("python/telegram_login.py");
        if !script.exists() {
            return Err(format!("Telegram script not found: {}", script.display()));
        }

        let mut cmd = std::process::Command::new(&python);
        paths::no_console(&mut cmd);
        let output = cmd
            .arg(&script)
            .args(args)
            .env("PYTHONUNBUFFERED", "1")
            .output()
            .map_err(|e| format!("Failed to run Python: {}", e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        if !output.status.success() {
            return Err(format!(
                "Telegram bridge failed (exit {}): {}",
                output.status.code().unwrap_or(-1),
                stderr.chars().take(500).collect::<String>()
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        if stdout.trim().is_empty() {
            return Err("Telegram bridge returned empty output".into());
        }
        Ok(stdout)
    }

    /// Extract the JSON object from output, skipping any noise before it.
    fn extract_json(output: &str) -> Result<String, String> {
        let start = output.find('{');
        let end = output.rfind('}').ok_or_else(|| "No JSON object in output".to_string())?;
        match start {
            Some(s) if s < end => Ok(output[s..=end].to_string()),
            _ => Err(format!("No JSON object in output: {}", &output.chars().take(200).collect::<String>())),
        }
    }

    pub fn init(&self, api_id: i32, api_hash: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["init", &api_id.to_string(), api_hash])?;
        let json = Self::extract_json(&out)?;
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse output: {}", e))
    }

    /// Reset any stale/corrupt Pyrogram session file.
    pub fn reset_session(&self) -> Result<String, String> {
        let out = self.run_script(&["reset"])?;
        let json = Self::extract_json(&out)?;
        let parsed: serde_json::Value = serde_json::from_str(&json)
            .map_err(|e| format!("Failed to parse reset response: {}", e))?;
        Ok(parsed.get("message").and_then(|m| m.as_str()).unwrap_or("Session reset").to_string())
    }

    pub fn send_phone(&self, phone: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["phone", phone])?;
        serde_json::from_str(&out).map_err(|e| format!("Failed to parse output: {}", e))
    }

    pub fn submit_code(&self, code: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["code", code])?;
        serde_json::from_str(&out).map_err(|e| format!("Failed to parse output: {}", e))
    }

    pub fn submit_password(&self, password: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["password", password])?;
        serde_json::from_str(&out).map_err(|e| format!("Failed to parse output: {}", e))
    }

    pub fn get_channels(&self) -> Result<Vec<TelegramChannel>, String> {
        let out = self.run_script(&["channels"])?;
        let parsed: TelegramChannelsResult = serde_json::from_str(&out)
            .map_err(|e| format!("Failed to parse output: {}", e))?;
        if let Some(err) = parsed.error { return Err(err); }
        Ok(parsed.channels.unwrap_or_default())
    }

    pub fn get_audio(&self, channel_id: i64) -> Result<Vec<TelegramAudioInfo>, String> {
        let out = self.run_script(&["audio", &channel_id.to_string()])?;
        let parsed: TelegramAudioResult = serde_json::from_str(&out)
            .map_err(|e| format!("Failed to parse output: {}", e))?;
        if let Some(err) = parsed.error { return Err(err); }
        Ok(parsed.audio.unwrap_or_default())
    }

    pub fn download_audio(&self, message_id: i64, channel_id: i64) -> Result<String, String> {
        let out = self.run_script(&["download", &message_id.to_string(), &channel_id.to_string()])?;
        let parsed: TelegramDownloadResult = serde_json::from_str(&out)
            .map_err(|e| format!("Failed to parse output: {}", e))?;
        if let Some(err) = parsed.error { return Err(err); }
        parsed.file_path.ok_or_else(|| "No file path returned".to_string())
    }

    pub fn to_track(&self, audio: TelegramAudioInfo) -> Track {
        let id = format!("tg_{}", audio.message_id);
        Track {
            id,
            title: audio.title,
            artist: if audio.artist.is_empty() { None } else { Some(audio.artist) },
            album: None,
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            duration: Some(audio.duration as f64),
            file_path: None,
            source: "telegram".to_string(),
            source_id: Some(audio.file_id),
            cover_path: None,
            play_count: Some(0),
            last_played_at: None,
            created_at: None,
            updated_at: None,
        }
    }
}
