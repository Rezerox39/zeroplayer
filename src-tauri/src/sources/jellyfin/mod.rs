pub mod commands;

use crate::library::Track;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub struct JellyfinClient {
    client: Client,
    server_url: String,
    api_key: String,
    user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JellyfinLibrary {
    pub id: String,
    pub name: String,
    pub lib_type: String,
}

impl JellyfinClient {
    pub fn new(server_url: &str, api_key: &str, user_id: &str) -> Self {
        Self {
            client: Client::new(),
            server_url: server_url.trim_end_matches('/').to_string(),
            api_key: api_key.to_string(),
            user_id: user_id.to_string(),
        }
    }

    async fn get(&self, endpoint: &str) -> Result<Value, String> {
        let url = format!("{}{}", self.server_url, endpoint);
        let resp = self
            .client
            .get(&url)
            .header("X-Emby-Token", &self.api_key)
            .header("X-Emby-Authorization",
                format!("MediaBrowser, Client=\"ZeroPlayer\", Device=\"desktop\", DeviceId=\"zeroplayer-desktop\", Version=\"1.0.0\""))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        resp.json::<Value>()
            .await
            .map_err(|e| format!("JSON parse error: {}", e))
    }

    pub async fn ping(&self) -> Result<String, String> {
        let val = self.get("/System/Info").await?;
        Ok(val["ServerName"].as_str().unwrap_or("Unknown").to_string())
    }

    pub async fn get_libraries(&self) -> Result<Vec<JellyfinLibrary>, String> {
        let val = self.get("/Users/{}/Views").await?;
        let items = val["Items"]
            .as_array()
            .ok_or("No items in response")?;

        let libs = items
            .iter()
            .filter(|i| i["CollectionType"].as_str() == Some("music"))
            .map(|i| JellyfinLibrary {
                id: i["Id"].as_str().unwrap_or("").to_string(),
                name: i["Name"].as_str().unwrap_or("Unknown").to_string(),
                lib_type: i["CollectionType"].as_str().unwrap_or("music").to_string(),
            })
            .collect();

        Ok(libs)
    }

    pub async fn get_audio_url(&self, item_id: &str) -> String {
        format!(
            "{}/Audio/{}/stream?api_key={}",
            self.server_url, item_id, self.api_key
        )
    }

    pub async fn get_tracks(&self, library_id: &str) -> Result<Vec<Track>, String> {
        let val = self
            .get(&format!(
                "/Users/{}/Items?ParentId={}&IncludeItemTypes=Audio&Recursive=true&Limit=5000&Fields=Path,Duration,MediaSources",
                self.user_id, library_id
            ))
            .await?;

        let items = val["Items"].as_array().ok_or("No items")?;
        let tracks = items
            .iter()
            .map(|i| Track {
                id: i["Id"].as_str().unwrap_or("").to_string(),
                title: i["Name"].as_str().unwrap_or("Unknown").to_string(),
                artist: i["Artists"]
                    .as_array()
                    .and_then(|a| a.first())
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                album: i["Album"].as_str().map(|s| s.to_string()),
                album_artist: i["AlbumArtist"].as_str().map(|s| s.to_string()),
                genre: i["Genres"]
                    .as_array()
                    .and_then(|a| a.first())
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                year: i["ProductionYear"].as_i64().map(|y| y as i32),
                track_number: i["IndexNumber"].as_i64().map(|n| n as i32),
                duration: i["RunTimeTicks"].as_f64().map(|t| t / 10_000_000.0),
                file_path: None,
                source: "jellyfin".to_string(),
                source_id: i["Id"].as_str().map(|s| s.to_string()),
                cover_path: None,
                play_count: Some(i["UserData"]["PlayCount"].as_i64().unwrap_or(0)),
                last_played_at: None,
                created_at: None,
                updated_at: None,
            })
            .collect();

        Ok(tracks)
    }

    pub async fn search(&self, query: &str) -> Result<Vec<Track>, String> {
        let val = self
            .get(&format!(
                "/Search/Hints?SearchTerm={}&IncludeItemTypes=Audio&Limit=50",
                urlencoding::encode(query)
            ))
            .await?;

        let items = val["SearchHints"].as_array().ok_or("No results")?;
        let tracks = items
            .iter()
            .map(|i| Track {
                id: i["ItemId"].as_str().unwrap_or("").to_string(),
                title: i["Name"].as_str().unwrap_or("Unknown").to_string(),
                artist: i["Artists"]
                    .as_array()
                    .and_then(|a| a.first())
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                album: i["Album"].as_str().map(|s| s.to_string()),
                album_artist: i["AlbumArtist"].as_str().map(|s| s.to_string()),
                genre: None,
                year: i["ProductionYear"].as_i64().map(|y| y as i32),
                track_number: i["IndexNumber"].as_i64().map(|n| n as i32),
                duration: i["RunTimeTicks"].as_f64().map(|t| t / 10_000_000.0),
                file_path: None,
                source: "jellyfin".to_string(),
                source_id: i["ItemId"].as_str().map(|s| s.to_string()),
                cover_path: None,
                play_count: Some(0),
                last_played_at: None,
                created_at: None,
                updated_at: None,
            })
            .collect();

        Ok(tracks)
    }
}
