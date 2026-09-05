#!/usr/bin/env python3
"""ZeroPlayer - YouTube Music Bridge via ytmusicapi (v1.12.2)

Usage:
    python3 ytmusic_bridge.py search <query> <filter>
    python3 ytmusic_bridge.py stream_url <video_id>
    python3 ytmusic_bridge.py lyrics <video_id>
    python3 ytmusic_bridge.py setup <output_path>

Requires: ytmusicapi>=1.12.0  (pip install ytmusicapi)
Auth:     ytmusicapi requires browser auth headers or OAuth.
          Run `python3 ytmusic_bridge.py setup <path>` first
          or place an oauth.json in ~/.config/zeroplayer/.
"""
import sys
import json
import os
from pathlib import Path

AUTH_FILE = Path.home() / ".config" / "zeroplayer" / "oauth.json"


def get_ytmusic():
    from ytmusicapi import YTMusic
    if AUTH_FILE.exists():
        return YTMusic(str(AUTH_FILE))
    # Unauthenticated fallback (limited features: search, suggestions, charts)
    return YTMusic()


def search(query, filter="songs"):
    yt = get_ytmusic()
    results = yt.search(query, filter=filter)
    out = []
    for r in results:
        if r.get("videoId"):
            # Parse duration string "M:SS" -> seconds
            duration = None
            if "duration" in r and r["duration"]:
                parts = r["duration"].split(":")
                if len(parts) == 2:
                    duration = int(parts[0]) * 60 + int(parts[1])
                elif len(parts) == 3:
                    duration = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])

            out.append({
                "video_id": r["videoId"],
                "title": r.get("title", "Unknown"),
                "artist": r.get("artist"),
                "album": r.get("album"),
                "duration_secs": duration,
            })
    print(json.dumps(out))


def get_stream_url(video_id):
    yt = get_ytmusic()
    song = yt.get_song(video_id)
    # Extract streaming URL (best audio quality)
    formats = song.get("streamingData", {}).get("adaptiveFormats", [])
    audio_formats = [f for f in formats if f.get("mimeType", "").startswith("audio/")]
    if not audio_formats:
        # Fallback to combined formats
        audio_formats = song.get("streamingData", {}).get("formats", [])

    if audio_formats:
        # Pick highest bitrate audio
        audio_formats.sort(key=lambda f: f.get("bitrate", 0), reverse=True)
        url = audio_formats[0].get("url") or audio_formats[0].get("signatureCipher")
        if url:
            print(url)
            return
    print("", end="")


def get_lyrics(video_id):
    yt = get_ytmusic()
    try:
        lyrics = yt.get_lyrics(video_id)
        if lyrics and "lyrics" in lyrics:
            print(lyrics["lyrics"])
        else:
            print("")
    except Exception:
        print("")


def setup(output_path):
    from ytmusicapi import setup as yt_setup
    print("Starting interactive browser auth setup...")
    print("This will open a browser window for YouTube Music authentication.")
    print(f"Saving auth to: {output_path}")
    yt_setup(output_path)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: ytmusic_bridge.py <command> [args...]"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        filter_type = sys.argv[3] if len(sys.argv) > 3 else "songs"
        search(query, filter_type)
    elif command == "stream_url":
        video_id = sys.argv[2] if len(sys.argv) > 2 else ""
        get_stream_url(video_id)
    elif command == "lyrics":
        video_id = sys.argv[2] if len(sys.argv) > 2 else ""
        get_lyrics(video_id)
    elif command == "setup":
        output = sys.argv[2] if len(sys.argv) > 2 else str(AUTH_FILE)
        setup(output)
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
