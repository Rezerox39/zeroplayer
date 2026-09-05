pub mod commands;

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

/// Telegram client using Pyrogram (Python) for user login.
/// Mirrors ZMT's TDLib-based auth flow:
///   phone number → verification code → (2FA password) → logged in
///
/// Session is persisted in ~/.config/zeroplayer/telegram/
pub struct TelegramClient {
    python_script: String,
}

impl TelegramClient {
    pub fn new() -> Self {
        Self {
            python_script: "python/telegram_login.py".to_string(),
        }
    }

    fn run_script(&self, args: &[&str]) -> Result<String, String> {
        let output = std::process::Command::new("python3")
            .arg(&self.python_script)
            .args(args)
            .env("PYTHONUNBUFFERED", "1")
            .output()
            .map_err(|e| format!("Failed to run Telegram bridge: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Telegram bridge error: {}", stderr));
        }

        String::from_utf8(output.stdout).map_err(|e| e.to_string())
    }

    pub fn init(&self, api_id: i32, api_hash: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["init", &api_id.to_string(), api_hash])?;
        serde_json::from_str(&out).map_err(|e| e.to_string())
    }

    pub fn send_phone(&self, phone: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["phone", phone])?;
        serde_json::from_str(&out).map_err(|e| e.to_string())
    }

    pub fn submit_code(&self, code: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["code", code])?;
        serde_json::from_str(&out).map_err(|e| e.to_string())
    }

    pub fn submit_password(&self, password: &str) -> Result<TelegramAuthResult, String> {
        let out = self.run_script(&["password", password])?;
        serde_json::from_str(&out).map_err(|e| e.to_string())
    }

    pub fn get_channels(&self) -> Result<Vec<TelegramChannel>, String> {
        let out = self.run_script(&["channels"])?;
        let parsed: TelegramChannelsResult = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        Ok(parsed.channels.unwrap_or_default())
    }

    pub fn get_audio(&self, channel_id: i64) -> Result<Vec<TelegramAudioInfo>, String> {
        let out = self.run_script(&["audio", &channel_id.to_string()])?;
        let parsed: TelegramAudioResult = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        Ok(parsed.audio.unwrap_or_default())
    }

    pub fn download_audio(&self, message_id: i64, channel_id: i64) -> Result<String, String> {
        let out = self.run_script(&[
            "download",
            &message_id.to_string(),
            &channel_id.to_string(),
        ])?;
        let parsed: TelegramDownloadResult = serde_json::from_str(&out).map_err(|e| e.to_string())?;
        if let Some(err) = parsed.error {
            return Err(err);
        }
        parsed.file_path.ok_or_else(|| "No file path returned".to_string())
    }

    pub fn to_track(&self, audio: TelegramAudioInfo) -> Track {
        let id = format!("tg_{}", audio.message_id);
        Track {
            id: id.clone(),
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
