pub mod commands;

use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricsResult {
    pub text: String,
    pub synced: bool,
    pub source: String,
}

pub struct LyricsService {
    client: Client,
}

impl LyricsService {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    pub async fn from_genius(&self, track_title: &str, artist: &str) -> Result<Option<LyricsResult>, String> {
        let query = format!("{} {}", track_title, artist);
        let search_url = format!(
            "https://genius.com/api/search?q={}",
            urlencoding::encode(&query)
        );

        let search_resp = self
            .client
            .get(&search_url)
            .send()
            .await
            .map_err(|e| format!("Genius search failed: {}", e))?;

        let search_json: serde_json::Value = search_resp
            .json()
            .await
            .map_err(|e| format!("Genius JSON parse error: {}", e))?;

        let hits = search_json["response"]["hits"]
            .as_array()
            .ok_or("No hits")?;

        if hits.is_empty() {
            return Ok(None);
        }

        let url = hits[0]["result"]["url"]
            .as_str()
            .ok_or("No URL")?;

        // Scrape the lyrics page (Genius doesn't have a lyrics API, so we parse HTML)
        let page_resp = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("Genius page fetch failed: {}", e))?;

        let html = page_resp
            .text()
            .await
            .map_err(|e| format!("Genius page read failed: {}", e))?;

        // Extract lyrics from the Genius HTML
        let lyrics = extract_genius_lyrics(&html);

        Ok(lyrics.map(|l| LyricsResult {
            text: l,
            synced: false,
            source: "Genius".to_string(),
        }))
    }

    pub async fn from_lyrics_ovh(&self, track_title: &str, artist: &str) -> Result<Option<LyricsResult>, String> {
        let url = format!(
            "https://api.lyrics.ovh/v1/{}/{}",
            urlencoding::encode(artist),
            urlencoding::encode(track_title)
        );

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("lyrics.ovh request failed: {}", e))?;

        if !resp.status().is_success() {
            return Ok(None);
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        if let Some(text) = json["lyrics"].as_str() {
            Ok(Some(LyricsResult {
                text: text.to_string(),
                synced: false,
                source: "lyrics.ovh".to_string(),
            }))
        } else {
            Ok(None)
        }
    }
}

fn extract_genius_lyrics(html: &str) -> Option<String> {
    // Genius lyrics are in <div data-lyrics-container="true"> tags
    let mut lyrics = Vec::new();
    let marker = r#"data-lyrics-container="true""#;
    let mut search_in = html;

    while let Some(pos) = search_in.find(marker) {
        search_in = &search_in[pos..];
        // Find the opening tag's >
        if let Some(tag_end) = search_in.find('>') {
            search_in = &search_in[tag_end + 1..];
            // Find closing div
            if let Some(close) = search_in.find("</div>") {
                let raw = &search_in[..close];
                // Strip HTML tags and convert <br> to newlines
                let cleaned = raw
                    .replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n");
                let cleaned = strip_html_tags(&cleaned);
                lyrics.push(cleaned);
                search_in = &search_in[close + 6..];
            }
        }
    }

    if lyrics.is_empty() {
        None
    } else {
        Some(lyrics.join("\n"))
    }
}

fn strip_html_tags(html: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }
    result
}
