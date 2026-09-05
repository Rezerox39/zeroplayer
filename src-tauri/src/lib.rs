pub mod audio;
pub mod config;
pub mod library;
pub mod lyrics;
pub mod queue;
pub mod sources;
pub mod stats;

use audio::player::AudioState;
use config::AppConfig;
use library::LibraryManager;
use queue::QueueManager;
use stats::StatsTracker;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

pub struct AppState {
    pub config: RwLock<AppConfig>,
    pub library: Arc<LibraryManager>,
    pub queue: Arc<RwLock<QueueManager>>,
    pub stats: Arc<StatsTracker>,
    pub player: Arc<AudioState>,
}

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_dir = app
                .path()
                .app_config_dir()
                .expect("Failed to get app config dir");
            std::fs::create_dir_all(&app_dir).ok();
            std::env::set_var("APP_DIR", app_dir.display().to_string());

            let config = AppConfig::load(&app_dir);
            let db_path = app_dir.join("library.db");
            let library = Arc::new(
                LibraryManager::new(&db_path).expect("Failed to init library DB"),
            );
            let queue = Arc::new(RwLock::new(QueueManager::new()));
            let stats = Arc::new(StatsTracker::new(&db_path).expect("Failed to init stats DB"));
            let player = AudioState::new(); // returns Arc<AudioState>

            let state = AppState {
                config: RwLock::new(config),
                library,
                queue,
                stats,
                player,
            };

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Player commands
            audio::commands::play,
            audio::commands::pause,
            audio::commands::resume,
            audio::commands::stop,
            audio::commands::seek,
            audio::commands::set_volume,
            audio::commands::set_speed,
            audio::commands::get_playback_state,
            // Queue commands
            queue::commands::add_to_queue,
            queue::commands::remove_from_queue,
            queue::commands::reorder_queue,
            queue::commands::clear_queue,
            queue::commands::get_queue,
            queue::commands::next_track,
            queue::commands::previous_track,
            queue::commands::set_repeat_mode,
            queue::commands::toggle_shuffle,
            // Library commands
            library::commands::scan_local_files,
            library::commands::get_tracks,
            library::commands::get_albums,
            library::commands::get_artists,
            library::commands::get_folders,
            library::commands::get_playlists,
            library::commands::search_library,
            library::commands::auto_scan_music,
            library::commands::get_common_music_dirs,
            // Source commands
            sources::jellyfin::commands::jellyfin_connect,
            sources::jellyfin::commands::jellyfin_get_libraries,
            sources::jellyfin::commands::jellyfin_get_tracks,
            sources::jellyfin::commands::jellyfin_search,
            sources::ytmusic::commands::ytmusic_search,
            sources::ytmusic::commands::ytmusic_search_as_tracks,
            sources::ytmusic::commands::ytmusic_get_stream_url,
            sources::ytmusic::commands::ytmusic_get_lyrics,
            sources::telegram::commands::telegram_connect,
            sources::telegram::commands::telegram_send_phone,
            sources::telegram::commands::telegram_submit_code,
            sources::telegram::commands::telegram_submit_password,
            sources::telegram::commands::telegram_get_channels,
            sources::telegram::commands::telegram_get_audio,
            sources::telegram::commands::telegram_download_audio,
            // Lyrics commands
            lyrics::commands::fetch_lyrics,
            // Stats commands
            stats::commands::get_track_stats,
            stats::commands::get_listening_stats,
            // Config commands
            config::commands::get_config,
            config::commands::update_config,
            config::commands::get_available_accents,
            // Session commands
            config::commands::save_session,
            config::commands::restore_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ZeroPlayer");
}
