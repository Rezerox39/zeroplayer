use super::{LyricsResult, LyricsService};
use crate::AppState;
use tauri::State;

#[tauri::command]
pub async fn fetch_lyrics(
    state: State<'_, AppState>,
    title: String,
    artist: String,
) -> Result<Option<LyricsResult>, String> {
    let config = state.config.read().await;
    let service = LyricsService::new();

    // Try configured provider first, then fallback
    let result = match config.lyrics.provider {
        crate::config::LyricsProvider::Genius => {
            let r = service.from_genius(&title, &artist).await?;
            if r.is_some() {
                r
            } else {
                service.from_lyrics_ovh(&title, &artist).await?
            }
        }
        crate::config::LyricsProvider::YTMusic => {
            // YTMusic lyrics are fetched via the ytmusic bridge (in ytmusic commands)
            // Fallback to Genius and lyrics.ovh
            let r = service.from_genius(&title, &artist).await?;
            if r.is_some() {
                r
            } else {
                service.from_lyrics_ovh(&title, &artist).await?
            }
        }
        _ => {
            let r = service.from_lyrics_ovh(&title, &artist).await?;
            if r.is_some() {
                r
            } else {
                service.from_genius(&title, &artist).await?
            }
        }
    };

    Ok(result)
}
