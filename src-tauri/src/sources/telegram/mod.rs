pub mod commands;

use crate::library::Track;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramAudio {
    pub file_id: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub duration_secs: Option<f64>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
}

pub struct TelegramClient {
    client: Client,
    bot_token: String,
    #[allow(dead_code)]
    channels: Vec<String>,
}

impl TelegramClient {
    pub fn new(bot_token: &str, channels: Vec<String>) -> Self {
        Self {
            client: Client::new(),
            bot_token: bot_token.to_string(),
            channels,
        }
    }

    async fn api(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value, String> {
        let url = format!("https://api.telegram.org/bot{}/{}", self.bot_token, method);
        let resp = self
            .client
            .post(&url)
            .json(&params)
            .send()
            .await
            .map_err(|e| format!("Telegram API request failed: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if json["ok"].as_bool().unwrap_or(false) {
            Ok(json["result"].clone())
        } else {
            Err(json["description"].as_str().unwrap_or("Unknown error").to_string())
        }
    }

    /// Utility to send a plain GET to a bot API method (e.g. getMe)
    async fn api_get(&self, method: &str) -> Result<serde_json::Value, String> {
        let url = format!("https://api.telegram.org/bot{}/{}", self.bot_token, method);
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Telegram API request failed: {}", e))?;
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if json["ok"].as_bool().unwrap_or(false) {
            Ok(json["result"].clone())
        } else {
            Err(json["description"].as_str().unwrap_or("Unknown error").to_string())
        }
    }

    pub async fn test_connection(&self) -> Result<String, String> {
        let result = self.api_get("getMe").await?;
        Ok(result["username"].as_str().unwrap_or("unknown").to_string())
    }

    /// Fetch all audio/media files from a public channel using getChatHistory
    /// (Bot API `getChat` won't work for arbitrary non-bot channels unless
    /// subscribed; directs user to use getUpdates or a user token.)
    pub async fn get_channel_audio(&self, channel_id: &str) -> Result<Vec<TelegramAudio>, String> {
        let mut audio_items = Vec::new();
        let mut offset: Option<i64> = None;
        const LIMIT: i64 = 100;

        loop {
            let mut params = serde_json::json!({
                "chat_id": channel_id,
                "limit": LIMIT,
            });
            if let Some(off) = offset {
                params["offset"] = serde_json::json!(off);
            }

            let result = self.api("getChatHistory", params).await?;

            let messages = result["result"]
                .as_array()
                .ok_or("Missing result array")?;

            if messages.is_empty() {
                break;
            }

            for msg in messages {
                for field in ["audio", "document", "video"] {
                    if let Some(file) = msg.get(field) {
                        let (file_id, title, artist, duration, fsize, mime) = if field == "audio" {
                            (
                                file["file_id"].as_str().unwrap_or("").to_string(),
                                file["title"].as_str().map(|s| s.to_string()),
                                file["performer"].as_str().map(|s| s.to_string()),
                                file["duration"].as_f64(),
                                file["file_size"].as_i64(),
                                file["mime_type"].as_str().map(|s| s.to_string()),
                            )
                        } else {
                            (
                                file["file_id"].as_str().unwrap_or("").to_string(),
                                msg["caption"].as_str().map(|s| s.to_string()).or_else(|| Some("Untitled".to_string())),
                                None,
                                file["duration"].as_f64(),
                                file["file_size"].as_i64(),
                                file["mime_type"].as_str().map(|s| s.to_string()),
                            )
                        };
                        audio_items.push(TelegramAudio {
                            file_id,
                            title,
                            artist,
                            duration_secs: duration,
                            file_size: fsize,
                            mime_type: mime,
                        });
                    }
                }
            }

            // Pagination: the last message's telegram id
            if let Some(last) = messages.last() {
                let last_id = last["message_id"].as_i64();
                // pagination handled via offset
                // Simplest: request offset after last
                match last_id {
                    Some(id) => offset = Some(id + 1),
                    None => break,
                };
                // Safety cap
                if audio_items.len() > 10000 {
                    break;
                }
            } else {
                break;
            }
        }

        Ok(audio_items)
    }

    pub fn to_track(&self, audio: TelegramAudio) -> Track {
        let id = audio.file_id.clone();
        Track {
            id: id.clone(),
            title: audio.title.unwrap_or_else(|| "Unknown Track".to_string()),
            artist: audio.artist,
            album: None,
            album_artist: None,
            genre: None,
            year: None,
            track_number: None,
            duration: audio.duration_secs,
            file_path: None,
            source: "telegram".to_string(),
            source_id: Some(id),
            cover_path: None,
            play_count: Some(0),
            last_played_at: None,
            created_at: None,
            updated_at: None,
        }
    }

    pub async fn get_download_url(&self, file_id: &str) -> Result<String, String> {
        let result = self.api_get(&format!("getFile?file_id={}", file_id)).await?;
        let file_path = result["file_path"].as_str().ok_or("No file_path")?;
        Ok(format!(
            "https://api.telegram.org/file/bot{}/{}",
            self.bot_token, file_path
        ))
    }
}
