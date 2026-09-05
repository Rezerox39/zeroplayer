use super::AppConfig;
use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub current_track_id: Option<String>,
    pub queue: Vec<String>,
    pub position_secs: f64,
}

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.read().await;
    Ok(config.clone())
}

#[tauri::command]
pub async fn update_config(state: State<'_, AppState>, config: AppConfig) -> Result<(), String> {
    let mut cfg = state.config.write().await;
    *cfg = config;
    Ok(())
}

#[tauri::command]
pub async fn get_available_accents() -> Result<Vec<String>, String> {
    Ok(vec![
        "green".to_string(),
        "cyan".to_string(),
        "purple".to_string(),
    ])
}

#[tauri::command]
pub async fn save_session(_state: State<'_, AppState>, session: SessionState) -> Result<(), String> {
    let app_dir = std::env::var("APP_DIR").unwrap_or_else(|_| ".".to_string());
    let path = std::path::PathBuf::from(&app_dir).join("session.json");
    let data = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_session() -> Result<Option<SessionState>, String> {
    let app_dir = std::env::var("APP_DIR").unwrap_or_else(|_| ".".to_string());
    let path = std::path::PathBuf::from(&app_dir).join("session.json");
    if path.exists() {
        let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let session: SessionState =
            serde_json::from_str(&data).map_err(|e| e.to_string())?;
        Ok(Some(session))
    } else {
        Ok(None)
    }
}
