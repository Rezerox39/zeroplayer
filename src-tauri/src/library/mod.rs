pub mod commands;
pub mod models;
pub mod scanner;

pub use models::*;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

#[allow(dead_code)]
pub struct LibraryManager {
    conn: Mutex<Connection>,
    base_paths: Vec<PathBuf>,
}

impl LibraryManager {
    pub fn new(db_path: &std::path::Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artist TEXT,
                album TEXT,
                album_artist TEXT,
                genre TEXT,
                year INTEGER,
                track_number INTEGER,
                duration REAL,
                file_path TEXT UNIQUE,
                source TEXT NOT NULL DEFAULT 'local',
                source_id TEXT,
                cover_path TEXT,
                play_count INTEGER DEFAULT 0,
                last_played_at TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                position INTEGER,
                PRIMARY KEY (playlist_id, track_id)
            );
            CREATE TABLE IF NOT EXISTS listening_stats (
                track_id TEXT PRIMARY KEY,
                play_count INTEGER DEFAULT 0,
                total_seconds REAL DEFAULT 0,
                last_played_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
            "#,
        )?;
        Ok(Self {
            conn: Mutex::new(conn),
            base_paths: vec![],
        })
    }

    pub fn upsert_track(&self, track: &Track) -> rusqlite::Result<()> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        conn.execute(
            r#"INSERT OR REPLACE INTO tracks
               (id, title, artist, album, album_artist, genre, year, track_number, duration, file_path, source, source_id, cover_path, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)"#,
            rusqlite::params![
                track.id,
                track.title,
                track.artist,
                track.album,
                track.album_artist,
                track.genre,
                track.year,
                track.track_number,
                track.duration,
                track.file_path,
                track.source,
                track.source_id,
                track.cover_path,
                track.created_at,
                track.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn get_tracks(&self, source: Option<&str>) -> rusqlite::Result<Vec<Track>> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let mut stmt = if let Some(src) = source {
            conn.prepare(&format!(
                "SELECT id, title, artist, album, album_artist, genre, year, track_number, duration, file_path, source, source_id, cover_path, play_count, last_played_at, created_at, updated_at FROM tracks WHERE source = '{}' ORDER BY artist, album, track_number",
                src
            ))?
        } else {
            conn.prepare(
                "SELECT id, title, artist, album, album_artist, genre, year, track_number, duration, file_path, source, source_id, cover_path, play_count, last_played_at, created_at, updated_at FROM tracks ORDER BY artist, album, track_number",
            )?
        };
        let rows = stmt.query_map([], |row| {
            Ok(Track {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                album_artist: row.get(4)?,
                genre: row.get(5)?,
                year: row.get(6)?,
                track_number: row.get(7)?,
                duration: row.get(8)?,
                file_path: row.get(9)?,
                source: row.get(10)?,
                source_id: row.get(11)?,
                cover_path: row.get(12)?,
                play_count: row.get(13)?,
                last_played_at: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_albums(&self) -> rusqlite::Result<Vec<Album>> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let mut stmt = conn.prepare(
            r#"SELECT album, album_artist, COUNT(*) as track_count, SUM(duration) as total_duration, MAX(cover_path) as cover
               FROM tracks
               WHERE album IS NOT NULL AND album != ''
               GROUP BY album, album_artist
               ORDER BY album_artist, album"#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Album {
                name: row.get(0)?,
                artist: row.get(1)?,
                track_count: row.get(2)?,
                total_duration: row.get(3)?,
                cover_path: row.get(4)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_artists(&self) -> rusqlite::Result<Vec<Artist>> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let mut stmt = conn.prepare(
            r#"SELECT artist, COUNT(*) as track_count, COUNT(DISTINCT album) as album_count
               FROM tracks
               WHERE artist IS NOT NULL AND artist != ''
               GROUP BY artist
               ORDER BY artist"#,
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Artist {
                name: row.get(0)?,
                track_count: row.get(1)?,
                album_count: row.get(2)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_folders(&self) -> rusqlite::Result<Vec<Folder>> {
        let tracks = self.get_tracks(Some("local"))?;
        use std::collections::HashMap;
        let mut folders: HashMap<String, usize> = HashMap::new();
        for t in &tracks {
            if let Some(parent) = std::path::Path::new(t.file_path.as_deref().unwrap_or("")).parent() {
                let p = parent.display().to_string();
                *folders.entry(p).or_insert(0) += 1;
            }
        }
        let mut result: Vec<Folder> = folders
            .into_iter()
            .map(|(path, count)| Folder {
                path,
                track_count: count,
            })
            .collect();
        result.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(result)
    }

    pub fn get_playlists(&self) -> rusqlite::Result<Vec<Playlist>> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let mut stmt = conn.prepare(
            "SELECT id, name, created_at, updated_at FROM playlists ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn search(&self, query: &str) -> rusqlite::Result<Vec<Track>> {
        let conn = self.conn.lock().map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            r#"SELECT id, title, artist, album, album_artist, genre, year, track_number, duration, file_path, source, source_id, cover_path, play_count, last_played_at, created_at, updated_at
               FROM tracks
               WHERE title LIKE ?1 OR artist LIKE ?1 OR album LIKE ?1 OR genre LIKE ?1
               ORDER BY artist, album, track_number
               LIMIT 200"#,
        )?;
        let rows = stmt.query_map(rusqlite::params![pattern], |row| {
            Ok(Track {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                album_artist: row.get(4)?,
                genre: row.get(5)?,
                year: row.get(6)?,
                track_number: row.get(7)?,
                duration: row.get(8)?,
                file_path: row.get(9)?,
                source: row.get(10)?,
                source_id: row.get(11)?,
                cover_path: row.get(12)?,
                play_count: row.get(13)?,
                last_played_at: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}
