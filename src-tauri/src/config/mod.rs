pub mod commands;
pub mod paths;

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub theme: ThemeConfig,
    pub playback: PlaybackConfig,
    pub jellyfin: Option<JellyfinConfig>,
    pub youtube_music: Option<YTMusicConfig>,
    pub telegram: Option<TelegramConfig>,
    pub lyrics: LyricsConfig,
    pub local_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeConfig {
    pub accent_color: AccentColor,
    pub font_size: u32,
    pub show_album_art: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AccentColor {
    Green,
    Cyan,
    Purple,
    Red,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackConfig {
    pub volume: f32,
    pub speed: f32,
    pub gapless: bool,
    pub crossfade_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JellyfinConfig {
    pub server_url: String,
    pub api_key: String,
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YTMusicConfig {
    pub auth_file: String,
    pub language: String,
    pub region: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    pub bot_token: String,
    pub channels: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsConfig {
    pub provider: LyricsProvider,
    pub genius_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LyricsProvider {
    Genius,
    YTMusic,
    Musixmatch,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            theme: ThemeConfig {
                accent_color: AccentColor::Red,
                font_size: 14,
                show_album_art: true,
            },
            playback: PlaybackConfig {
                volume: 0.8,
                speed: 1.0,
                gapless: false,
                crossfade_secs: 0.0,
            },
            jellyfin: None,
            youtube_music: None,
            telegram: None,
            lyrics: LyricsConfig {
                provider: LyricsProvider::YTMusic,
                genius_token: None,
            },
            local_dirs: vec![],
        }
    }
}

impl AppConfig {
    pub fn load(app_dir: &Path) -> Self {
        let config_path = app_dir.join("config.json");
        if config_path.exists() {
            if let Ok(data) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str(&data) {
                    return config;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self, app_dir: &Path) -> Result<(), String> {
        let config_path = app_dir.join("config.json");
        let data = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        std::fs::write(&config_path, data).map_err(|e| e.to_string())
    }

    pub fn accent_hex(&self) -> &str {
        match self.theme.accent_color {
            AccentColor::Green => "#00ff88",
            AccentColor::Cyan => "#00e5ff",
            AccentColor::Purple => "#b366ff",
            AccentColor::Red => "#DC143C",
        }
    }
}
