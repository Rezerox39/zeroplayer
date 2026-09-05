use super::Track;
use lofty::picture::{MimeType, PictureType};
use lofty::prelude::*;
use lofty::tag::Tag;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "wav", "ogg", "opus", "m4a", "aac", "wma", "aiff", "ape", "alac",
];

pub fn scan_directory(dir: &Path) -> Vec<Track> {
    let mut tracks = Vec::new();
    let files: Vec<PathBuf> = walkdir::WalkDir::new(dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .map(|e| e.into_path())
        .filter(|p| is_supported(p.as_path()))
        .collect();
    for path in files {
        if let Some(track) = read_track_metadata(&path) {
            tracks.push(track);
        }
    }
    tracks
}

fn read_track_metadata(path: &Path) -> Option<Track> {
    let tagged_file = lofty::read_from_path(path).ok()?;
    let properties = tagged_file.properties();
    let tags = tagged_file.tags();

    let (title, artist, album, album_artist, genre, year, track_number) =
        if let Some(tag) = tags.first() {
            (
                tag.title().map(|s| s.into_owned()),
                tag.artist().map(|s| s.into_owned()),
                tag.album().map(|s| s.into_owned()),
                None,
                tag.genre().map(|s| s.into_owned()),
                tag.year().map(|y| y as i32),
                tag.track().map(|n| n as i32),
            )
        } else {
            (None, None, None, None, None, None, None)
        };

    let duration_secs = properties.duration().as_secs_f64();
    let title = title.unwrap_or_else(|| {
        path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string()
    });
    let cover_path = extract_cover_art(path, tags);
    let now = chrono::Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();

    Some(Track {
        id,
        title,
        artist,
        album,
        album_artist,
        genre,
        year,
        track_number,
        duration: Some(duration_secs),
        file_path: Some(path.display().to_string()),
        source: "local".to_string(),
        source_id: None,
        cover_path,
        play_count: Some(0),
        last_played_at: None,
        created_at: Some(now.clone()),
        updated_at: Some(now),
    })
}

fn extract_cover_art(path: &Path, tags: &[Tag]) -> Option<String> {
    for tag in tags {
        for picture in tag.pictures() {
            if picture.pic_type() == PictureType::CoverFront
                || picture.pic_type() == PictureType::Other
            {
                let data = picture.data();
                let ext = match picture.mime_type() {
                    Some(MimeType::Jpeg) => "jpg",
                    Some(MimeType::Png) => "png",
                    _ => "jpg",
                };
                let cover_dir = path.parent()?.join(".cover_art");
                std::fs::create_dir_all(&cover_dir).ok()?;
                let stem = path.file_stem()?.to_str()?;
                let cover_name = format!("{}.{}", hex::encode(stem.as_bytes()), ext);
                let cover_path = cover_dir.join(&cover_name);
                if !cover_path.exists() {
                    std::fs::write(&cover_path, data).ok()?;
                }
                return Some(cover_path.display().to_string());
            }
        }
    }
    None
}

pub fn is_supported(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}
