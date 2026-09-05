use std::path::PathBuf;
use std::process::Command;

/// Configure a Command to not open a console window on Windows.
/// This prevents the "cmd flashes" when running python/yt-dlp.
pub fn no_console(cmd: &mut Command) -> &mut Command {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Find the Python executable on the current platform.
pub fn find_python() -> Option<String> {
    // On Windows: try py launcher, python, python3
    // On Linux/macOS: python3 first, then python
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["py", "python", "python3"]
    } else {
        &["python3", "python"]
    };

    for cmd in candidates {
        let mut test = Command::new(cmd);
        no_console(test.arg("--version"));
        if test.output().is_ok() {
            return Some(cmd.to_string());
        }
    }
    None
}

/// Check if yt-dlp is available in the found Python environment.
pub fn find_ytdlp_installed(python: &str) -> bool {
    let mut test = Command::new(python);
    no_console(
        test.arg("-c")
            .arg("import yt_dlp; print('ok')"),
    );
    test.output()
        .ok()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Resolve a script path relative to the app's resource directory.
pub fn resolve_resource_path(relative: &str) -> PathBuf {
    // 1. Tauri resource directory (bundled with app)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let candidates = [
                exe_dir.join("resources").join(relative),
                exe_dir.join(relative),
                exe_dir.join("../Resources").join(relative), // macOS
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
        dirs.push(home.join("Desktop"));

        #[cfg(target_os = "windows")]
        {
            if let Some(music) = dirs::audio_dir() {
                dirs.push(music);
            }
        }

        #[cfg(target_os = "macos")]
        {
            dirs.push(home.join("Music").join("iTunes"));
            dirs.push(home.join("Music").join("Music Application"));
        }
    }

    dirs.into_iter().filter(|d| d.exists() && d.is_dir()).collect()
}
