pub mod commands;

use crate::library::Track;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum RepeatMode {
    Off,
    One,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Queue {
    pub tracks: Vec<Track>,
    pub current_index: usize,
    pub shuffled: bool,
    pub repeat: RepeatMode,
    pub original_order: Vec<String>,
}

impl Queue {
    pub fn new() -> Self {
        Self {
            tracks: vec![],
            current_index: 0,
            shuffled: false,
            repeat: RepeatMode::Off,
            original_order: vec![],
        }
    }

    pub fn add(&mut self, track: Track) {
        self.tracks.push(track);
    }

    pub fn add_many(&mut self, tracks: Vec<Track>) {
        self.tracks.extend(tracks);
    }

    pub fn remove(&mut self, index: usize) {
        if index < self.tracks.len() {
            self.tracks.remove(index);
            if self.current_index > index && self.current_index > 0 {
                self.current_index -= 1;
            }
        }
    }

    pub fn reorder(&mut self, from: usize, to: usize) {
        if from < self.tracks.len() && to < self.tracks.len() {
            let item = self.tracks.remove(from);
            self.tracks.insert(to, item);
        }
    }

    pub fn clear(&mut self) {
        self.tracks.clear();
        self.current_index = 0;
    }

    pub fn current(&self) -> Option<&Track> {
        if self.tracks.is_empty() || self.current_index >= self.tracks.len() {
            return None;
        }
        self.tracks.get(self.current_index)
    }

    pub fn next(&mut self) -> Option<Track> {
        if self.tracks.is_empty() {
            return None;
        }
        if self.current_index + 1 < self.tracks.len() {
            self.current_index += 1;
            return self.tracks.get(self.current_index).cloned();
        }
        match self.repeat {
            RepeatMode::All => {
                self.current_index = 0;
                self.tracks.get(0).cloned()
            }
            _ => None,
        }
    }

    pub fn previous(&mut self) -> Option<Track> {
        if self.tracks.is_empty() {
            return None;
        }
        if self.current_index > 0 {
            self.current_index -= 1;
            return self.tracks.get(self.current_index).cloned();
        }
        None
    }

    pub fn replay(&mut self) -> Option<Track> {
        self.tracks.get(self.current_index).cloned()
    }

    pub fn shuffle_toggle(&mut self) -> bool {
        self.shuffled = !self.shuffled;
        if self.shuffled {
            self.original_order = self.tracks.iter().map(|t| t.id.clone()).collect();
            self.shuffle_rows();
        } else {
            // Restore original order
            let orig: Vec<Track> = self
                .original_order
                .iter()
                .filter_map(|id| {
                    self.tracks
                        .iter()
                        .find(|t| &t.id == id)
                        .cloned()
                })
                .collect();
            self.tracks = orig;
            if self.current_index >= self.tracks.len() {
                self.current_index = 0;
            }
        }
        self.shuffled
    }

    fn shuffle_rows(&mut self) {
        // Fisher-Yates shuffle keeping the current track at its position
        let keep_index = if self.current_index < self.tracks.len() {
            self.current_index
        } else {
            0
        };
        let keep = if !self.tracks.is_empty() {
            Some(self.tracks.remove(keep_index))
        } else {
            None
        };
        let n = self.tracks.len();
        if n > 1 {
            // Simple pseudo-random using a fixed seed based on time
            use std::time::{SystemTime, UNIX_EPOCH};
            let seed = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0);
            let mut state = seed as u64;
            for i in (1..n).rev() {
                state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
                let j = (state as usize) % (i + 1);
                self.tracks.swap(i, j);
            }
        }
        if let Some(k) = keep {
            self.tracks.insert(keep_index.min(self.tracks.len()), k);
        }
        self.current_index = keep_index;
    }
}

pub struct QueueManager {
    pub queue: Queue,
}

impl QueueManager {
    pub fn new() -> Self {
        Self {
            queue: Queue::new(),
        }
    }
}
