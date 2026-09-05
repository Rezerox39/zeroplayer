"""ZeroPlayer - Telegram client with user login (Pyrogram).

Mirrors ZMT's TDLib-based auth flow:
  phone number → verification code → (2FA password) → logged in

Pyrogram is used because it provides the same user-login API as TDLib
but with a simpler Python interface and no native library compilation.

Usage:
    python3 telegram_login.py init <api_id> <api_hash>
    python3 telegram_login.py phone <phone_number>
    python3 telegram_login.py code <verification_code>
    python3 telegram_login.py password <2fa_password>
    python3 telegram_login.py status
    python3 telegram_login.py channels
    python3 telegram_login.py search <query>
    python3 telegram_login.py audio <channel_id>
    python3 telegram_login.py download <message_id> <channel_id>

Session is persisted in ~/.config/zeroplayer/telegram/
"""
import json
import sys
import os
import asyncio

SESSION_DIR = os.path.expanduser("~/.config/zeroplayer/telegram")
SESSION_NAME = "zeroplayer"

def get_session_path():
    os.makedirs(SESSION_DIR, exist_ok=True)
    return os.path.join(SESSION_DIR, SESSION_NAME)

async def init_session(api_id: int, api_hash: str):
    """Initialize a new Telegram session."""
    try:
        from pyrogram import Client
    except ImportError:
        return {"error": "pyrogram not installed. Run: pip install pyrogram"}

    session_path = get_session_path()
    app = Client(session_path, api_id=api_id, api_hash=api_hash)

    # Check if already logged in
    try:
        await app.start()
        me = await app.get_me()
        await app.stop()
        return {
            "status": "logged_in",
            "user_id": me.id,
            "first_name": me.first_name,
            "username": me.username or "",
        }
    except Exception as e:
        error_str = str(e)
        if "PHONE" in error_str or "auth" in error_str.lower():
            return {"status": "need_phone"}
        return {"status": "error", "error": error_str}


async def send_phone(phone_number: str):
    """Send phone number for verification."""
    try:
        from pyrogram import Client
        from pyrogram import errors
    except ImportError:
        return {"error": "pyrogram not installed"}

    session_path = get_session_path()
    # We need api_id and api_hash from config
    config_path = os.path.expanduser("~/.config/zeroplayer/telegram_config.json")
    if not os.path.exists(config_path):
        return {"error": "Telegram not configured. Set API ID and hash first."}

    with open(config_path) as f:
        config = json.load(f)

    app = Client(session_path, api_id=config["api_id"], api_hash=config["api_hash"])

    try:
        await app.start()
        # Already logged in
        me = await app.get_me()
        await app.stop()
        return {"status": "logged_in", "user_id": me.id, "first_name": me.first_name}
    except errors.PhoneNumberUnregistered:
        return {"error": "Phone number is not registered with Telegram"}
    except errors.SessionPasswordNeeded:
        return {"status": "need_password"}
    except errors.PhoneNumberInvalid:
        return {"error": "Invalid phone number. Include country code (e.g. +1234567890)"}
    except errors.PhoneCodeEmpty:
        return {"status": "need_code"}
    except errors.PhoneCodeSent:
        return {"status": "need_code", "code_info": "Verification code sent"}
    except errors.PhoneCodeExpired:
        return {"status": "need_code", "error": "Code expired. Request a new one."}
    except Exception as e:
        error_str = str(e)
        if "phone" in error_str.lower() or "code" in error_str.lower():
            return {"status": "need_code"}
        return {"error": error_str}


async def submit_code(code: str):
    """Submit verification code."""
    try:
        from pyrogram import Client
        from pyrogram import errors
    except ImportError:
        return {"error": "pyrogram not installed"}

    session_path = get_session_path()
    config_path = os.path.expanduser("~/.config/zeroplayer/telegram_config.json")
    if not os.path.exists(config_path):
        return {"error": "Telegram not configured."}

    with open(config_path) as f:
        config = json.load(f)

    app = Client(session_path, api_id=config["api_id"], api_hash=config["api_hash"])

    try:
        await app.start()
        me = await app.get_me()
        await app.stop()
        return {"status": "logged_in", "user_id": me.id, "first_name": me.first_name}
    except errors.SessionPasswordNeeded:
        return {"status": "need_password"}
    except errors.PhoneCodeInvalid:
        return {"error": "Invalid verification code. Try again."}
    except errors.PhoneCodeExpired:
        return {"error": "Code expired. Request a new one."}
    except Exception as e:
        return {"error": str(e)}


async def submit_password(password: str):
    """Submit 2FA password."""
    try:
        from pyrogram import Client
        from pyrogram import errors
    except ImportError:
        return {"error": "pyrogram not installed"}

    session_path = get_session_path()
    config_path = os.path.expanduser("~/.config/zeroplayer/telegram_config.json")
    if not os.path.exists(config_path):
        return {"error": "Telegram not configured."}

    with open(config_path) as f:
        config = json.load(f)

    app = Client(session_path, api_id=config["api_id"], api_hash=config["api_hash"])

    try:
        await app.start()
        me = await app.get_me()
        await app.stop()
        return {"status": "logged_in", "user_id": me.id, "first_name": me.first_name}
    except errors.PasswordHashInvalid:
        return {"error": "Invalid 2FA password. Try again."}
    except Exception as e:
        return {"error": str(e)}


async def get_channels():
    """Get list of channels the user has joined."""
    try:
        from pyrogram import Client
    except ImportError:
        return {"error": "pyrogram not installed"}

    session_path = get_session_path()
    config_path = os.path.expanduser("~/.config/zeroplayer/telegram_config.json")
    if not os.path.exists(config_path):
        return {"error": "Telegram not configured."}

    with open(config_path) as f:
        config = json.load(f)

    app = Client(session_path, api_id=config["api_id"], api_hash=config["api_hash"])

    try:
        await app.start()
        channels = []
        async for dialog in app.get_dialogs():
            if dialog.chat.type in ("channel", "supergroup"):
                channels.append({
                    "id": dialog.chat.id,
                    "title": dialog.chat.title or "Unknown",
                    "username": dialog.chat.username or "",
                })
            if len(channels) >= 100:
                break
        await app.stop()
        return {"channels": channels}
    except Exception as e:
        return {"error": str(e)}


async def get_audio_from_channel(channel_id: int):
    """Get audio files from a channel."""
    try:
        from pyrogram import Client
    except ImportError:
        return {"error": "pyrogram not installed"}

    session_path = get_session_path()
    config_path = os.path.expanduser("~/.config/zeroplayer/telegram_config.json")
    if not os.path.exists(config_path):
        return {"error": "Telegram not configured."}

    with open(config_path) as f:
        config = json.load(f)

    app = Client(session_path, api_id=config["api_id"], api_hash=config["api_hash"])

    try:
        await app.start()
        audio_files = []
        count = 0
        async for msg in app.get_chat_history(channel_id, limit=500):
            if msg.audio:
                audio_files.append({
                    "message_id": msg.id,
                    "file_id": msg.audio.file_id,
                    "title": msg.audio.title or "Unknown",
                    "artist": msg.audio.performer or "",
                    "duration": msg.audio.duration or 0,
                    "file_size": msg.audio.file_size or 0,
                    "mime_type": msg.audio.mime_type or "audio/unknown",
                })
            elif msg.document and msg.document.mime_type and msg.document.mime_type.startswith("audio/"):
                audio_files.append({
                    "message_id": msg.id,
                    "file_id": msg.document.file_id,
                    "title": msg.document.file_name or "Unknown",
                    "artist": "",
                    "duration": 0,
                    "file_size": msg.document.file_size or 0,
                    "mime_type": msg.document.mime_type or "audio/unknown",
                })
            count += 1
            if count >= 500:
                break
        await app.stop()
        return {"audio": audio_files}
    except Exception as e:
        return {"error": str(e)}


async def download_audio(message_id: int, channel_id: int):
    """Download an audio file to local storage."""
    try:
        from pyrogram import Client
    except ImportError:
        return {"error": "pyrogram not installed"}

    session_path = get_session_path()
    config_path = os.path.expanduser("~/.config/zeroplayer/telegram_config.json")
    if not os.path.exists(config_path):
        return {"error": "Telegram not configured."}

    with open(config_path) as f:
        config = json.load(f)

    app = Client(session_path, api_id=config["api_id"], api_hash=config["api_hash"])

    try:
        await app.start()
        msg = await app.get_messages(channel_id, message_ids=message_id)
        if not msg or not (msg.audio or (msg.document and msg.document.mime_type and msg.document.mime_type.startswith("audio/"))):
            await app.stop()
            return {"error": "Audio file not found"}

        download_dir = os.path.expanduser("~/.config/zeroplayer/downloads")
        os.makedirs(download_dir, exist_ok=True)

        file_path = await msg.download(file_name=download_dir)
        await app.stop()
        return {"file_path": file_path}
    except Exception as e:
        return {"error": str(e)}


def run_async(coro):
    """Run an async function from sync context."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Already in an async context, use a new thread
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(asyncio.run, coro).result()
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: telegram_login.py <command> [args...]"}))
        sys.exit(1)

    command = sys.argv[1]

    if command == "init":
        api_id = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        api_hash = sys.argv[3] if len(sys.argv) > 3 else ""
        result = run_async(init_session(api_id, api_hash))
    elif command == "phone":
        phone = sys.argv[2] if len(sys.argv) > 2 else ""
        result = run_async(send_phone(phone))
    elif command == "code":
        code = sys.argv[2] if len(sys.argv) > 2 else ""
        result = run_async(submit_code(code))
    elif command == "password":
        password = sys.argv[2] if len(sys.argv) > 2 else ""
        result = run_async(submit_password(password))
    elif command == "status":
        result = run_async(init_session(0, ""))
    elif command == "channels":
        result = run_async(get_channels())
    elif command == "audio":
        channel_id = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        result = run_async(get_audio_from_channel(channel_id))
    elif command == "download":
        message_id = int(sys.argv[2]) if len(sys.argv) > 2 else 0
        channel_id = int(sys.argv[3]) if len(sys.argv) > 3 else 0
        result = run_async(download_audio(message_id, channel_id))
    else:
        result = {"error": f"Unknown command: {command}"}

    if isinstance(result, dict):
        print(json.dumps(result))
    else:
        print(json.dumps(str(result)))


if __name__ == "__main__":
    main()
