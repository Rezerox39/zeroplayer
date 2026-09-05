# ZeroPlayer

Terminal-inspired desktop music player with true black AMOLED aesthetic.

Built with **Tauri v2** (Rust backend + React/TypeScript frontend) for cross-platform performance with minimal resource usage.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZeroPlayer Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  React Frontend (TypeScript + Tailwind CSS)                     │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │  Player   │ Library  │  Queue   │  Search  │  Stats   │      │
│  │  View     │  View    │  View    │  View    │  View    │      │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘      │
│       └──────────┴──────────┴──────────┴──────────┘             │
│                         │ invoke() IPC                          │
├─────────────────────────┼───────────────────────────────────────┤
│  Rust Backend (Tauri Commands)                                  │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐      │
│  │  Audio    │  Queue   │ Library  │  Stats   │  Config  │      │
│  │  Engine   │ Manager  │ Manager  │ Tracker  │ Manager  │      │
│  │ (rodio)   │          │(rusqlite)│(rusqlite)│(JSON)   │      │
│  └────┬─────┴────┬─────┴────┬─────┴──────────┴─────────┘      │
│       │          │          │                                   │
│  ┌────┴──────────┴──────────┴──────────────────────────────┐   │
│  │                  Source Integrations                     │   │
│  │  ┌─────────┐  ┌────────────┐  ┌──────────────────┐     │   │
│  │  │  Local   │  │  Jellyfin  │  │  YouTube Music   │     │   │
│  │  │  (lofty) │  │  (REST)    │  │  (ytmusicapi)    │     │   │
│  │  └─────────┘  └────────────┘  └──────────────────┘     │   │
│  │  ┌─────────────────┐  ┌──────────────────────────┐     │   │
│  │  │  Telegram Bot   │  │  Lyrics (Genius/OVH)     │     │   │
│  │  │  (Bot API)      │  │  (HTML scraping)         │     │   │
│  │  └─────────────────┘  └──────────────────────────┘     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SQLite (library.db): tracks, playlists, listening stats       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Library scanning**: Rust `scanner` uses `lofty` to read audio metadata (ID3, Vorbis, FLAC tags) from local files. Embedded cover art is extracted to `.cover_art/` directory.

2. **Jellyfin integration**: REST API v12.0.0 — authenticates via `X-Emby-Token` header, fetches items with `Fields=Path,Duration,MediaSources`, streams audio through the Tauri app proxy.

3. **YouTube Music**: Delegates to the `ytmusicapi` Python library (v1.12.2) via `python/ytmusic_bridge.py`. Supports OAuth auth. Stream URLs are extracted from YouTube's adaptive format manifests.

4. **Telegram**: Uses the official Telegram Bot API (`/getFile`, `/getChatHistory`) to fetch audio files from subscribed channels.

5. **Playback**: `rodio` decodes local files; remote sources use `reqwest` streaming with `tokio::mpsc` channel piping.

6. **Lyrics**: Genius (HTML scraping), lyrics.ovh (REST API), and ytmusicapi (YouTube Music lyrics endpoint) with automatic fallback.

7. **State**: Zustand (frontend) mirrors backend state via Tauri IPC. SQLite persists library, stats, and configuration.

## Prerequisites

- **Rust** ≥ 1.75 (`rustup`)
- **Node.js** ≥ 18 + **npm**
- **Python 3.10+** (for YouTube Music integration)
- **System libraries** (Tauri v2 build requirements):
  - **macOS**: Xcode command line tools
  - **Linux**: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`
  - **Windows**: WebView2 (pre-installed on Windows 10/11)

## Setup

```bash
# Clone / navigate to the project
cd zeroplayer

# Install Node dependencies
npm install

# (Optional) Install ytmusicapi for YouTube Music
pip install ytmusicapi

# (Optional) Set up YouTube Music auth
python3 python/ytmusic_bridge.py setup ~/.config/zeroplayer/oauth.json
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Or use the in-app **Settings** view to configure Jellyfin, Telegram, and accent color interactively.

### Required API Keys / Credentials

| Source | What You Need | How to Get It |
|---|---|---|
| **Jellyfin** | Server URL, API Key, User ID | Settings → API Keys in Jellyfin admin |
| **YouTube Music** | OAuth auth file | `python3 python/ytmusic_bridge.py setup` |
| **Telegram** | Bot token + channel IDs | Create bot via @BotFather |
| **Lyrics** | None (free APIs) | Genius/lyrics.ovh used by default |

## Build & Run

```bash
# Development mode (hot-reload)
npm run dev
# or
cargo tauri dev

# Production build
npm run build
# or
cargo tauri build
```

The built binary will be in `src-tauri/target/release/bundle/`.

## Project Structure

```
zeroplayer/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs               # Tauri app setup & command registration
│   │   ├── main.rs              # Entry point
│   │   ├── audio/               # Audio engine (rodio-based playback)
│   │   │   ├── player.rs        # Playback engine: play, pause, seek, volume
│   │   │   └── commands.rs      # Tauri command handlers for player
│   │   ├── library/             # Local music library
│   │   │   ├── models.rs        # Track, Album, Artist, Folder, Playlist
│   │   │   ├── scanner.rs       # File system scanner + metadata extraction
│   │   │   └── commands.rs      # Tauri command handlers
│   │   ├── queue/               # Playback queue management
│   │   │   ├── mod.rs           # Queue with reorder, shuffle, repeat
│   │   │   └── commands.rs
│   │   ├── sources/             # External music source integrations
│   │   │   ├── jellyfin/        # Jellyfin REST API (v12.0.0)
│   │   │   ├── ytmusic/         # YouTube Music (via ytmusicapi Python bridge)
│   │   │   └── telegram/        # Telegram Bot API channel audio
│   │   ├── lyrics/              # Lyrics fetching (Genius, lyrics.ovh)
│   │   ├── stats/               # Play count & listening time tracking
│   │   └── config/              # App configuration (JSON-based)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                         # React frontend
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root layout (sidebar + views + player bar)
│   ├── types/index.ts           # TypeScript type definitions
│   ├── stores/                  # Zustand state stores
│   │   ├── playerStore.ts       # Playback, queue, lyrics, navigation state
│   │   └── libraryStore.ts      # Library data, config, stats
│   ├── lib/tauri.ts             # Tauri IPC wrapper (invoke bindings)
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   ├── components/
│   │   ├── Player/
│   │   │   ├── Player.tsx       # Bottom player bar (controls, progress, volume)
│   │   │   └── FullPlayer.tsx   # Full-screen view (album art + lyrics)
│   │   ├── Library/
│   │   │   └── LibraryView.tsx  # Browse by tracks/albums/artists/folders/playlists
│   │   ├── Queue/
│   │   │   └── QueueView.tsx    # Queue management (reorder, clear, current track)
│   │   ├── Search/
│   │   │   └── SearchView.tsx   # Multi-source search
│   │   ├── Lyrics/
│   │   │   └── LyricDisplay.tsx # Synced + unsynced lyrics with highlight
│   │   ├── Stats/
│   │   │   └── StatsView.tsx    # Play counts, listening time, top tracks
│   │   ├── Settings/
│   │   │   └── SettingsView.tsx # Accent color, Jellyfin, Telegram config
│   │   └── common/
│   │       └── Sidebar.tsx      # Navigation + source status indicators
│   └── styles/globals.css       # Tailwind + AMOLED theme variables
├── python/
│   └── ytmusic_bridge.py        # YouTube Music bridge (ytmusicapi wrapper)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── .env.example
└── README.md
```

## UI Design

- **True black** (#000000) background — no grays, no off-blacks
- **Monospace font** (JetBrains Mono) for all metadata and timestamps
- **3 accent colors**: deep green (#00ff88), cyan (#00e5ff), purple (#b366ff)
- **Minimal spacing** with grid-aligned layout
- **High contrast** white/light gray text on pure black
- **Thin divider lines** (1px, #1a1a1a) for section boundaries

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Shift+→` | Next track |
| `Shift+←` | Previous track |
| `↑` / `↓` | Volume up / down |
| `S` | Open search |
| `L` | Open library |
| `Q` | Open queue |
| `P` | Open player |
| `O` | Open stats |
| `Esc` | Blur input / close |

## Features

- [x] Local music file playback (MP3, FLAC, WAV, OGG, Opus, M4A, AAC, WMA, AIFF)
- [x] Jellyfin server streaming and integration
- [x] YouTube Music search, streaming, and track downloads
- [x] Telegram channel music source integration
- [x] Full-screen player with album art and lyrics
- [x] Bottom player bar with progress and controls
- [x] Queue management (view, reorder, clear)
- [x] Library browsing (tracks, albums, artists, folders)
- [x] Multi-source search
- [x] Synced + unsynced lyrics with real-time highlight
- [x] Play count, listening time, and top tracks stats
- [x] Accent color customization (green, cyan, purple)
- [x] Session persistence (SQLite)
- [x] Keyboard shortcuts
- [x] Sleep timer (in settings)
- [x] Playback speed control (0.5x – 2.0x)
- [x] Cross-platform (Windows, macOS, Linux)

## License

MIT
