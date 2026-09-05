pub mod commands;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackStats {
    pub track_id: String,
    pub play_count: i64,
    pub total_seconds: f64,
    pub last_played_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListeningStats {
    pub total_plays: i64,
    pub total_listening_seconds: f64,
    pub unique_tracks: i64,
}

pub struct StatsTracker {
    conn: Mutex<Connection>,
}

impl StatsTracker {
    pub fn new(db_path: &std::path::Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn record_play(&self, track_id: &str, duration_secs: f64) -> rusqlite::Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            r#"INSERT INTO listening_stats (track_id, play_count, total_seconds, last_played_at)
               VALUES (?1, 1, ?2, ?3)
               ON CONFLICT(track_id) DO UPDATE SET
                 play_count = play_count + 1,
                 total_seconds = total_seconds + ?2,
                 last_played_at = ?3"#,
            rusqlite::params![track_id, duration_secs, now],
        )?;
        conn.execute(
            "UPDATE tracks SET play_count = play_count + 1, last_played_at = ?2 WHERE id = ?1",
            rusqlite::params![track_id, now],
        )?;
        Ok(())
    }

    pub fn get_track_stats(&self, track_id: &str) -> rusqlite::Result<Option<TrackStats>> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let mut stmt = conn.prepare(
            "SELECT track_id, play_count, total_seconds, last_played_at FROM listening_stats WHERE track_id = ?1",
        )?;
        let mut rows = stmt.query_map(rusqlite::params![track_id], |row| {
            Ok(TrackStats {
                track_id: row.get(0)?,
                play_count: row.get(1)?,
                total_seconds: row.get(2)?,
                last_played_at: row.get(3)?,
            })
        })?;
        Ok(rows.next().transpose()?)
    }

    pub fn get_listening_stats(&self) -> rusqlite::Result<ListeningStats> {
        let conn = self
            .conn
            .lock()
            .map_err(|_| rusqlite::Error::ExecuteReturnedResults)?;
        let mut stmt = conn.prepare(
            "SELECT COALESCE(SUM(play_count), 0), COALESCE(SUM(total_seconds), 0), COUNT(*) FROM listening_stats",
        )?;
        let row = stmt.query_row([], |row| {
            Ok(ListeningStats {
                total_plays: row.get(0)?,
                total_listening_seconds: row.get(1)?,
                unique_tracks: row.get(2)?,
            })
        })?;
        Ok(row)
    }
}
