use super::{TelegramClient, TelegramAuthResult, TelegramChannel};
use crate::library::Track;
use crate::AppState;
use tauri::State;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    pub api_id: i32,
    pub api_hash: String,
}

/// Initialize Telegram session (save API credentials and check login status)
#[tauri::command]
pub async fn telegram_connect(
    state: State<'_, AppState>,
    api_id: i32,
    api_hash: String,
) -> Result<TelegramAuthResult, String> {
    let config_dir = std::env::var("APP_DIR").unwrap_or_else(|_| ".".to_string());
    let config_path = std::path::PathBuf::from(&config_dir).join("telegram_config.json");
    let config = TelegramConfig { api_id, api_hash: api_hash.clone() };
    let data = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&config_path, data).map_err(|e| e.to_string())?;

    let client = TelegramClient::new();
    let result = client.init(api_id, &api_hash)?;

    let mut cfg = state.config.write().await;
    cfg.telegram = Some(crate::config::TelegramConfig {
        bot_token: String::new(),
        channels: vec![],
    });

    Ok(result)
}

/// Reset any stale/corrupt Pyrogram session (fixes "row / column" errors).
#[tauri::command]
pub async fn telegram_reset_session() -> Result<String, String> {
    let client = TelegramClient::new();
    client.reset_session()
}

/// Send phone number for verification (step 1 of login)
#[tauri::command]
pub async fn telegram_send_phone(phone_number: String) -> Result<TelegramAuthResult, String> {
    let client = TelegramClient::new();
    client.send_phone(&phone_number)
}

/// Submit verification code (step 2 of login)
#[tauri::command]
pub async fn telegram_submit_code(code: String) -> Result<TelegramAuthResult, String> {
    let client = TelegramClient::new();
    client.submit_code(&code)
}

/// Submit 2FA password (step 3 of login, if needed)
#[tauri::command]
pub async fn telegram_submit_password(password: String) -> Result<TelegramAuthResult, String> {
    let client = TelegramClient::new();
    client.submit_password(&password)
}

/// Get list of channels the user has joined
#[tauri::command]
pub async fn telegram_get_channels() -> Result<Vec<TelegramChannel>, String> {
    let client = TelegramClient::new();
    client.get_channels()
}

/// Get audio files from a channel
#[tauri::command]
pub async fn telegram_get_audio(channel_id: i64) -> Result<Vec<Track>, String> {
    let client = TelegramClient::new();
    let audio_items = client.get_audio(channel_id)?;
    Ok(audio_items.into_iter().map(|a| client.to_track(a)).collect())
}

/// Download a specific audio file from Telegram
#[tauri::command]
pub async fn telegram_download_audio(
    _state: State<'_, AppState>,
    message_id: i64,
    channel_id: i64,
) -> Result<String, String> {
    let client = TelegramClient::new();
    let file_path = client.download_audio(message_id, channel_id)?;
    Ok(file_path)
}
