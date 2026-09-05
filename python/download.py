"""ZeroPlayer - YouTube stream resolver via yt-dlp.

Mirrors ZMT's download.py pattern: yt-dlp is the PRIMARY resolver
for signature deobfuscation, n-transform, PO tokens, client rotation.

Usage:
    python3 python/download.py stream <video_id>
    python3 python/download.py search <query>
    python3 python/download.py playlist <url>

Requires: yt-dlp (pip install yt-dlp)
"""
import json
import sys
import os

def resolve_stream(video_id: str) -> str:
    """Resolve a YouTube video ID to a playable stream URL using yt-dlp."""
    try:
        import yt_dlp
    except ImportError:
        return json.dumps({"error": "yt-dlp not installed. Run: pip install yt-dlp"})

    opts = {
        "format": "bestaudio[acodec!=none]/bestaudio/best",
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "geo_bypass": True,
        "no_check_certificates": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["web", "android", "ios", "tv"],
                "player_skip": ["webpage"],
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "*/*",
        },
        "source_address": "0.0.0.0",
        "socket_timeout": 30,
    }

    try:
        ydl = yt_dlp.YoutubeDL(opts)
        info = ydl.extract_info(video_id, download=False)
        if info is None:
            return json.dumps({"error": "extract_info returned None", "id": video_id})

        result = {
            "id": info.get("id", video_id),
            "title": info.get("title", ""),
            "artist": info.get("uploader") or info.get("artist") or "",
            "url": info.get("url"),
            "ext": info.get("ext", "mp4"),
            "filesize": info.get("filesize") or info.get("filesize_approx") or 0,
            "format_id": info.get("format_id", ""),
            "acodec": info.get("acodec", ""),
            "abr": info.get("abr", 0),
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail", ""),
            "formats": [],
        }

        for fmt in info.get("formats", []):
            fmt_entry = {
                "format_id": fmt.get("format_id", ""),
                "url": fmt.get("url"),
                "ext": fmt.get("ext", ""),
                "acodec": fmt.get("acodec", ""),
                "vcodec": fmt.get("vcodec", "none"),
                "abr": fmt.get("abr", 0),
                "filesize": fmt.get("filesize") or 0,
                "http_headers": fmt.get("http_headers", {}),
            }
            result["formats"].append(fmt_entry)

        # If top-level URL missing, find best audio format
        if not result["url"]:
            audio_formats = [f for f in result["formats"] if f["vcodec"] == "none" and f["url"]]
            if audio_formats:
                best = max(audio_formats, key=lambda f: f["abr"] or 0)
                result["url"] = best["url"]
                result["format_id"] = best["format_id"]
                result["filesize"] = best["filesize"]
            elif result["formats"]:
                for fmt in result["formats"]:
                    if fmt["url"]:
                        result["url"] = fmt["url"]
                        result["format_id"] = fmt["format_id"]
                        result["filesize"] = fmt["filesize"]
                        break

        return json.dumps(result)
    except Exception as e:
        return json.dumps({"error": f"{type(e).__name__}: {e}", "id": video_id})


def search_youtube(query: str) -> str:
    """Search YouTube Music and return track results."""
    try:
        import yt_dlp
    except ImportError:
        return json.dumps({"error": "yt-dlp not installed. Run: pip install yt-dlp"})

    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "default_search": "ytsearch10",
    }

    try:
        ydl = yt_dlp.YoutubeDL(opts)
        info = ydl.extract_info(f"ytsearch10:{query}", download=False)
        if info is None:
            return json.dumps({"entries": []})

        entries = []
        for entry in info.get("entries", []):
            if entry is None:
                continue
            entries.append({
                "id": entry.get("id", ""),
                "title": entry.get("title", "Unknown"),
                "artist": entry.get("uploader") or entry.get("channel") or "",
                "duration": entry.get("duration") or 0,
                "thumbnail": entry.get("thumbnails", [{}])[0].get("url", "") if entry.get("thumbnails") else "",
                "url": entry.get("url") or entry.get("webpage_url") or "",
            })
        return json.dumps({"entries": entries})
    except Exception as e:
        return json.dumps({"error": f"{type(e).__name__}: {e}"})


def download_to_file(video_id: str, out_dir: str = "") -> str:
    """Download a YouTube video audio to a local file and return the file path."""
    try:
        import yt_dlp
    except ImportError:
        return json.dumps({"error": "yt-dlp not installed. Run: pip install yt-dlp"})

    import tempfile
    if not out_dir:
        out_dir = os.path.join(tempfile.gettempdir(), "zeroplayer")
    os.makedirs(out_dir, exist_ok=True)

    outtmpl = os.path.join(out_dir, "%(id)s.%(ext)s")
    opts = {
        "format": "bestaudio[acodec!=none]/bestaudio/best",
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "geo_bypass": True,
        "no_check_certificates": True,
        "extractor_args": {
            "youtube": {
                "player_client": ["web", "android", "ios", "tv"],
                "player_skip": ["webpage"],
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "*/*",
        },
        "source_address": "0.0.0.0",
        "socket_timeout": 30,
    }

    try:
        ydl = yt_dlp.YoutubeDL(opts)
        info = ydl.extract_info(video_id, download=True)
        if info is None:
            return json.dumps({"error": "extract_info returned None", "id": video_id})

        # Find the downloaded file
        filename = ydl.prepare_filename(info)
        if os.path.exists(filename):
            return json.dumps({
                "id": info.get("id", video_id),
                "title": info.get("title", ""),
                "file_path": filename,
                "ext": info.get("ext", "mp4"),
            })
        else:
            # Try alternate extensions
            for ext in ["webm", "m4a", "opus", "mp3", "mp4", "ogg"]:
                alt = os.path.join(out_dir, f"{video_id}.{ext}")
                if os.path.exists(alt):
                    return json.dumps({
                        "id": info.get("id", video_id),
                        "title": info.get("title", ""),
                        "file_path": alt,
                        "ext": ext,
                    })
            return json.dumps({"error": f"Downloaded file not found at {filename}", "id": video_id})

    except Exception as e:
        return json.dumps({"error": f"{type(e).__name__}: {e}", "id": video_id})


def list_playlist(url: str) -> str:
    """List tracks in a YouTube Music / YouTube playlist."""
    try:
        import yt_dlp
    except ImportError:
        return json.dumps({"error": "yt-dlp not installed. Run: pip install yt-dlp"})

    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "skip_download": True,
        "ignoreerrors": True,
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info is None:
                return json.dumps({"entries": []})
            entries = info.get("entries") or []
            result = []
            for e in entries:
                if e is None:
                    continue
                result.append({
                    "id": e.get("id", ""),
                    "title": e.get("title") or "Unknown",
                    "artist": e.get("uploader") or e.get("channel") or "",
                })
            return json.dumps({"entries": result})
    except Exception as e:
        return json.dumps({"error": str(e)})


def get_lyrics(video_id: str) -> str:
    """Try to get lyrics from YouTube Music."""
    try:
        import yt_dlp
    except ImportError:
        return json.dumps({"error": "yt-dlp not installed"})

    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
    }

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(f"https://music.youtube.com/watch?v={video_id}", download=False)
            if info is None:
                return ""
            # Try to find lyrics in description or chapters
            desc = info.get("description", "")
            if "[Lyrics]" in desc or "[Verse" in desc:
                return desc
            return ""
    except Exception:
        return ""


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: download.py <stream|search|download|playlist|lyrics> <arg>"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "stream":
        video_id = sys.argv[2] if len(sys.argv) > 2 else ""
        print(resolve_stream(video_id))
    elif command == "download":
        video_id = sys.argv[2] if len(sys.argv) > 2 else ""
        out_dir = sys.argv[3] if len(sys.argv) > 3 else ""
        print(download_to_file(video_id, out_dir))
    elif command == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        print(search_youtube(query))
    elif command == "playlist":
        url = sys.argv[2] if len(sys.argv) > 2 else ""
        print(list_playlist(url))
    elif command == "lyrics":
        video_id = sys.argv[2] if len(sys.argv) > 2 else ""
        print(get_lyrics(video_id))
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))
