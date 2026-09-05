use super::TelegramClient;
use crate::library::Track;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn telegram_connect(
    state: State<'_, AppState>,
    bot_token: String,
    channels: Vec<String>,
) -> Result<String, String> {
    let client = TelegramClient::new(&bot_token, channels.clone());
    let username = client.test_connection().await?;

    let mut config = state.config.write().await;
    config.telegram = Some(crate::config::TelegramConfig {
        bot_token,
        channels,
    });

    Ok(format!("Connected as @{}", username))
}

#[tauri::command]
pub async fn telegram_get_channels(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let config = state.config.read().await;
    Ok(config
        .telegram
        .as_ref()
        .map(|tc| tc.channels.clone())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn telegram_get_audio(
    state: State<'_, AppState>,
    channel_id: String,
) -> Result<Vec<Track>, String> {
    let config = state.config.read().await;
    let tc = config.telegram.as_ref().ok_or("Telegram not configured")?;
    let client = TelegramClient::new(&tc.bot_token, tc.channels.clone());
    let audio_items = client.get_channel_audio(&channel_id).await?;
    let tracks: Vec<Track> = audio_items.into_iter().map(|a| client.to_track(a)).collect();

    for track in &tracks {
        state.library.upsert_track(track).map_err(|e| e.to_string())?;
    }

    Ok(tracks)
}

#[tauri::command]
pub async fn telegram_search(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<Track>, String> {
    let config = state.config.read().await;
    let tc = config.telegram.as_ref().ok_or("Telegram not configured")?;
    let _ = &state;

    let mut results = Vec::new();
    for channel_id in &tc.channels {
        let client = TelegramClient::new(&tc.bot_token, tc.channels.clone());
        let audio_items = client.get_channel_audio(channel_id).await?;
        for a in audio_items {
            let track = client.to_track(a);
            let matches = track
                .title
                .to_lowercase()
                .contains(&query.to_lowercase())
                || track
                    .artist
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&query.to_lowercase());
            if matches {
                results.push(track);
            }
        }
    }

    Ok(results)
}
