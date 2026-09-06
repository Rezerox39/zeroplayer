/// Embed the Python bridge scripts directly into the binary.
/// At startup the app writes these to the app config dir so they always exist
/// regardless of how the Tauri resource bundler lays out files.
pub const DOWNLOAD_PY: &str = include_str!("../../../python/download.py");
pub const TELEGRAM_LOGIN_PY: &str = include_str!("../../../python/telegram_login.py");
pub const YTMUSIC_BRIDGE_PY: &str = include_str!("../../../python/ytmusic_bridge.py");

use std::path::{Path, PathBuf};

/// Ensure the python scripts exist next to the app data.
/// Returns the directory containing the scripts.
pub fn ensure_scripts(app_dir: &Path) -> PathBuf {
    let scripts_dir = app_dir.join("python");
    std::fs::create_dir_all(&scripts_dir).ok();

    let files: [(&str, &str); 3] = [
        ("download.py", DOWNLOAD_PY),
        ("telegram_login.py", TELEGRAM_LOGIN_PY),
        ("ytmusic_bridge.py", YTMUSIC_BRIDGE_PY),
    ];

    for (name, content) in files {
        let path = scripts_dir.join(name);
        match std::fs::write(&path, content) {
            Ok(_) => {}
            Err(e) => log::error!("Failed to write {}: {}", path.display(), e),
        }
    }

    scripts_dir
}
