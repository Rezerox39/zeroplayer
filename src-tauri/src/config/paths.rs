use std::path::PathBuf;

/// Find the Python executable on the current platform.
pub fn find_python() -> Option<String> {
    for cmd in &["python3", "python"] {
        if std::process::Command::new(cmd)
            .arg("--version")
            .output()
            .is_ok()
        {
            return Some(cmd.to_string());
        }
    }
    None
}

/// Resolve a script path relative to the app's resource directory.
/// Checks multiple locations in order:
/// 1. Resource dir (Tauri bundled resources)
/// 2. Next to the executable
/// 3. Current working directory
/// 4. User config dir
pub fn resolve_resource_path(relative: &str) -> PathBuf {
    // 1. Tauri resource directory (bundled with app)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // On macOS: Contents/Resources/
            // On Windows/Linux: same dir as exe or resources/ subfolder
            let candidates = [
                exe_dir.join("resources").join(relative),
                exe_dir.join(relative),
                exe_dir.join("../Resources").join(relative),  // macOS
            ];
            for candidate in &candidates {
                if candidate.exists() {
                    return candidate.clone();
                }
            }
        }
    }

    // 2. Current working directory (dev mode)
    if let Ok(cwd) = std::env::current_dir() {
        let full = cwd.join(relative);
        if full.exists() {
            return full;
        }
    }

    // 3. User's home directory
    if let Some(home) = dirs::home_dir() {
        let full = home.join(relative);
        if full.exists() {
            return full;
        }
    }

    // Fallback: return as-is
    PathBuf::from(relative)
}

/// Get the common music directories on the current platform.
pub fn get_common_music_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join("Downloads"));
        dirs.push(home.join("Music"));
        dirs.push(home.join("Documents"));

        // Windows-specific: use known_folder
        #[cfg(target_os = "windows")]
        {
            if let Some(music) = dirs::audio_dir() {
                dirs.push(music);
            }
        }

        // macOS
        #[cfg(target_os = "macos")]
        {
            dirs.push(home.join("Music").join("iTunes"));
            dirs.push(home.join("Music").join("Music Application"));
        }

        // Linux
        #[cfg(target_os = "linux")]
        {
            if let Ok(user) = std::env::var("USER") {
                dirs.push(PathBuf::from("/home").join(user).join("Music"));
            }
        }
    }

    dirs.into_iter().filter(|d| d.exists() && d.is_dir()).collect()
}
