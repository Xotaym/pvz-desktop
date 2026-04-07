import base64
import ctypes
from ctypes import wintypes
import json
import os
import socket
import sys
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import win32gui
    import win32con
    import win32api
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

try:
    import webview
    HAS_WEBVIEW = True
except ImportError:
    HAS_WEBVIEW = False

if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys._MEIPASS)
else:
    BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
MANIFEST_FILE = BASE_DIR / "manifest.json"

if getattr(sys, 'frozen', False):
    _LOG_DIR = Path(sys.executable).parent
else:
    _LOG_DIR = BASE_DIR
LOG_FILE = _LOG_DIR / "game.log"
_log_lock = threading.Lock()

_ACCESS_TOKEN = base64.b64encode(os.urandom(16)).decode()

def find_free_port(preferred=8765):
    for port in range(preferred, preferred + 100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    return preferred

PORT = find_free_port(8765)

def get_manifest():
    if MANIFEST_FILE.exists():
        with open(MANIFEST_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"version": "0.1.0", "name": "Plants VS Zombies Desktop"}

def get_wallpaper_path() -> str:
    if os.name != "nt":
        return ""
    try:
        SPI_GETDESKWALLPAPER = 0x0073
        buf = ctypes.create_unicode_buffer(260)
        ctypes.windll.user32.SystemParametersInfoW(SPI_GETDESKWALLPAPER, len(buf), buf, 0)
        wp = buf.value
        if wp and os.path.exists(wp):
            return wp
        return ""
    except Exception:
        return ""

def _get_icon_base64(path: str):
    if os.name != "nt" or not HAS_PIL:
        return None
    try:
        class SHFILEINFO(ctypes.Structure):
            _fields_ = [
                ("hIcon", wintypes.HICON),
                ("iIcon", ctypes.c_int),
                ("dwAttributes", ctypes.c_uint32),
                ("szDisplayName", wintypes.WCHAR * 260),
                ("szTypeName", wintypes.WCHAR * 80),
            ]

        class BITMAPINFOHEADER(ctypes.Structure):
            _fields_ = [
                ("biSize", ctypes.c_uint32),
                ("biWidth", ctypes.c_long),
                ("biHeight", ctypes.c_long),
                ("biPlanes", ctypes.c_ushort),
                ("biBitCount", ctypes.c_ushort),
                ("biCompression", ctypes.c_uint32),
                ("biSizeImage", ctypes.c_uint32),
                ("biXPelsPerMeter", ctypes.c_long),
                ("biYPelsPerMeter", ctypes.c_long),
                ("biClrUsed", ctypes.c_uint32),
                ("biClrImportant", ctypes.c_uint32),
            ]

        class BITMAPINFO(ctypes.Structure):
            _fields_ = [("bmiHeader", BITMAPINFOHEADER), ("bmiColors", ctypes.c_uint32 * 3)]

        SHGFI_ICON = 0x000000100
        SHGFI_SMALLICON = 0x000000001

        sfi = SHFILEINFO()
        res = ctypes.windll.shell32.SHGetFileInfoW(
            path, 0, ctypes.byref(sfi), ctypes.sizeof(sfi), SHGFI_ICON | SHGFI_SMALLICON
        )
        if not res:
            return None

        hicon = sfi.hIcon
        size = 32

        bmi = BITMAPINFO()
        bmi.bmiHeader.biSize = ctypes.sizeof(BITMAPINFOHEADER)
        bmi.bmiHeader.biWidth = size
        bmi.bmiHeader.biHeight = -size
        bmi.bmiHeader.biPlanes = 1
        bmi.bmiHeader.biBitCount = 32
        bmi.bmiHeader.biCompression = 0

        hdc = ctypes.windll.user32.GetDC(None)
        memdc = ctypes.windll.gdi32.CreateCompatibleDC(hdc)
        bits = ctypes.c_void_p()
        hbmp = ctypes.windll.gdi32.CreateDIBSection(memdc, ctypes.byref(bmi), 0, ctypes.byref(bits), None, 0)
        old = ctypes.windll.gdi32.SelectObject(memdc, hbmp)

        ctypes.windll.user32.DrawIconEx(memdc, 0, 0, hicon, size, size, 0, None, 3)

        buf = ctypes.string_at(bits, size * size * 4)
        img = Image.frombuffer("RGBA", (size, size), buf, "raw", "BGRA", 0, 1)
        out = BytesIO()
        img.save(out, format="PNG")

        ctypes.windll.gdi32.SelectObject(memdc, old)
        ctypes.windll.gdi32.DeleteObject(hbmp)
        ctypes.windll.gdi32.DeleteDC(memdc)
        ctypes.windll.user32.ReleaseDC(None, hdc)
        ctypes.windll.user32.DestroyIcon(hicon)

        return base64.b64encode(out.getvalue()).decode()
    except Exception:
        return None

def get_wallpaper_base64() -> str:
    wp = get_wallpaper_path()
    if not wp or not HAS_PIL:
        return ""
    try:
        img = Image.open(wp)
        out = BytesIO()
        img.save(out, format="PNG")
        return base64.b64encode(out.getvalue()).decode()
    except Exception:
        return ""

def get_desktop_icons():
    def _desktop_paths():
        paths = []
        user_desktop = Path.home() / "Desktop"
        public_root = os.environ.get("PUBLIC", r"C:\Users\Public")
        public_desktop = Path(public_root) / "Desktop"
        for p in (user_desktop, public_desktop):
            if p.exists():
                paths.append(p)
        return paths

    def _display_name(item: Path) -> str:
        if item.suffix.lower() in (".lnk", ".url"):
            return item.stem
        return item.name

    items = []
    seen = set()
    for p in _desktop_paths():
        for item in p.iterdir():
            if item.name.startswith("."):
                continue
            name = _display_name(item)
            if name in seen:
                continue
            seen.add(name)
            items.append((name, item))

    if not items:
        return [{"name": f"File {i+1}", "x": 80 + (i % 4) * 100, "y": 80 + (i // 4) * 100} for i in range(8)]

    screen = get_screen_size()
    start_x, start_y = 20, 40
    step_x, step_y = 90, 90
    cols = max(1, (screen["width"] - start_x * 2) // step_x)

    icons = []
    items = items[:60]
    for i, (name, item) in enumerate(items):
        col = i % cols
        row = i // cols
        x = start_x + col * step_x
        y = start_y + row * step_y
        icon_b64 = _get_icon_base64(str(item))
        data = {"name": name, "x": x, "y": y}
        if icon_b64:
            data["icon"] = icon_b64
        icons.append(data)

    return icons

def get_screen_size():
    if HAS_WIN32:
        w = win32api.GetSystemMetrics(0)
        h = win32api.GetSystemMetrics(1)
        return {"width": w, "height": h}
    return {"width": 1920, "height": 1080}

class GameHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def _check_access(self) -> bool:
        if not HAS_WEBVIEW:
            return True
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/static/"):
            return True
        if f"token={_ACCESS_TOKEN}" in (parsed.query or ""):
            return True
        referer = self.headers.get("Referer", "")
        if f"token={_ACCESS_TOKEN}" in referer:
            return True
        return False

    def _send_forbidden(self):
        body = b'<html><body style="background:#0a0a1a;color:#e74c3c;font-family:Consolas,monospace;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><div><h1>&#x26D4; Access Denied</h1><p style="color:#888">Launch via <b>python server.py</b></p></div></body></html>'
        self.send_response(403)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if not self._check_access():
            self._send_forbidden()
            return
        parsed = urlparse(self.path)

        if parsed.path == "/api/desktop":
            self._json({
                "wallpaper": get_wallpaper_base64(),
                "icons": get_desktop_icons(),
                "screen": get_screen_size(),
            })
        elif parsed.path == "/api/manifest":
            self._json(get_manifest())
        elif parsed.path == "/api/screen":
            self._json(get_screen_size())
        else:
            super().do_GET()

    def do_POST(self):
        if not self._check_access():
            self._send_forbidden()
            return
        parsed = urlparse(self.path)
        if parsed.path == "/api/log":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                lines = data.get("lines", [])
                if lines:
                    with _log_lock:
                        with open(LOG_FILE, "a", encoding="utf-8") as f:
                            for line in lines:
                                f.write(line + "\n")
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif parsed.path == "/api/log/clear":
            try:
                with _log_lock:
                    with open(LOG_FILE, "w", encoding="utf-8") as f:
                        f.write("")
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        elif parsed.path == "/api/save":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
                if getattr(sys, 'frozen', False):
                    save_path = Path(sys.executable).parent / "save.json"
                else:
                    save_path = BASE_DIR / "save.json"
                with open(save_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
        else:
            self.send_error(404)

    def _json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

class AudioBridge:

    def __init__(self):
        self._sounds_dir = STATIC_DIR / "sounds"
        self._cache = {}
        self._volume = 1.0
        self._muted_sfx = False
        self._muted_music = False
        self._music_ids = {"snd-menu"}
        self._lock = threading.Lock()
        self._scan_sounds()

    def _mci(self, command):
        buf = ctypes.create_unicode_buffer(256)
        err = ctypes.windll.winmm.mciSendStringW(command, buf, 255, None)
        return buf.value if err == 0 else None

    def _scan_sounds(self):
        if not self._sounds_dir.exists():
            return
        id_map = {
            "snd-delete": "удаление",
            "snd-pea": "горошина",
            "snd-explosion": "взрыв",
            "snd-lawnmower": "косилка",
            "snd-sun": "солнце",
            "snd-death": "ваша-смерть",
            "snd-menu": "меню",
            "snd-defeat": "поражение",
        }
        for sid, name in id_map.items():
            for ext in (".mp3", ".wav", ".ogg"):
                p = self._sounds_dir / f"{name}{ext}"
                if p.exists():
                    self._cache[sid] = str(p)
                    break

    def _get_alias(self, sound_id):
        clean = sound_id.replace("-", "")
        return f"pvz_{clean}"

    def play(self, sound_id):
        if os.name != "nt":
            return False
        if sound_id in self._music_ids and self._muted_music:
            return False
        if sound_id not in self._music_ids and self._muted_sfx:
            return False
        path = self._cache.get(sound_id)
        if not path:
            return False
        try:
            with self._lock:
                alias = self._get_alias(sound_id)
                self._mci(f'close {alias}')
                self._mci(f'open "{path}" alias {alias}')
                vol = int(self._volume * 1000)
                self._mci(f'setaudio {alias} volume to {vol}')
                repeat = "repeat" if sound_id in self._music_ids else ""
                self._mci(f'play {alias} from 0 {repeat}')
            return True
        except Exception as e:
            print(f"[audio] error: {e}")
            return False

    def stop(self, sound_id=None):
        if os.name != "nt":
            return False
        try:
            with self._lock:
                if sound_id:
                    alias = self._get_alias(sound_id)
                    self._mci(f'stop {alias}')
                    self._mci(f'close {alias}')
                else:
                    for sid in list(self._cache.keys()):
                        alias = self._get_alias(sid)
                        self._mci(f'stop {alias}')
                        self._mci(f'close {alias}')
            return True
        except Exception:
            return False

    def set_volume(self, volume):
        self._volume = max(0.0, min(1.0, float(volume)))
        vol = int(self._volume * 1000)
        with self._lock:
            for sid in self._cache:
                alias = self._get_alias(sid)
                self._mci(f'setaudio {alias} volume to {vol}')
        return True

    def set_muted(self, sfx_muted, music_muted):
        self._muted_sfx = bool(sfx_muted)
        self._muted_music = bool(music_muted)
        if self._muted_music:
            for sid in list(self._music_ids):
                self.stop(sid)
        return True

def start_server():
    server = HTTPServer(("127.0.0.1", PORT), GameHandler)
    print(f"[PvZ Desktop] Server running: http://127.0.0.1:{PORT}")
    server.serve_forever()

_lock_file = None

def acquire_lock():
    global _lock_file
    if os.name != "nt":
        return True
    lock_path = os.path.join(os.environ.get("TEMP", "."), "pvz_desktop.lock")
    try:
        _lock_file = open(lock_path, "w")
        import msvcrt
        msvcrt.locking(_lock_file.fileno(), msvcrt.LK_NBLCK, 1)
        return True
    except (OSError, IOError):
        return False

def main():
    if not acquire_lock():
        print("[PvZ Desktop] Game is already running!")
        if os.name == "nt":
            ctypes.windll.user32.MessageBoxW(
                0, "Игра уже запущена!", "PvZ Desktop", 0x30
            )
        sys.exit(1)

    print(f"[PvZ Desktop] Port: {PORT}")

    if HAS_WEBVIEW:
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        audio_bridge = AudioBridge()

        if getattr(sys, 'frozen', False):
            _app_dir = Path(sys.executable).parent
        else:
            _app_dir = BASE_DIR
        storage_dir = str(_app_dir / "storage")
        os.makedirs(storage_dir, exist_ok=True)

        webview.create_window(
            "Plants VS Zombies Desktop",
            f"http://127.0.0.1:{PORT}?token={_ACCESS_TOKEN}",
            fullscreen=True,
            resizable=True,
            frameless=False,
            easy_drag=False,
            js_api=audio_bridge,
        )
        webview.start(private_mode=False, storage_path=storage_dir)

        audio_bridge.stop()
        sys.exit(0)
    else:
        print("[PvZ Desktop] No pywebview, server-only mode.")
        print(f"[PvZ Desktop] Open http://127.0.0.1:{PORT} in browser.")
        start_server()

if __name__ == "__main__":
    main()
