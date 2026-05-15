import base64
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time
import zlib
from http.server import HTTPServer, SimpleHTTPRequestHandler
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

IS_WINDOWS = os.name == "nt"
IS_LINUX = sys.platform.startswith("linux")
IS_ANDROID = hasattr(sys, 'getandroidapilevel') or 'ANDROID_ROOT' in os.environ

if IS_ANDROID:
    IS_LINUX = False

if IS_WINDOWS:
    import ctypes
    from ctypes import wintypes

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

HAS_JNIUS = False
_jnius_classes = {}

def _init_jnius():
    global HAS_JNIUS, _jnius_classes
    if HAS_JNIUS or not IS_ANDROID:
        return
    try:
        from jnius import autoclass, cast as jcast
        PA = autoclass('org.kivy.android.PythonActivity')
        if PA.mActivity is None:
            return
        _jnius_classes['autoclass'] = autoclass
        _jnius_classes['cast'] = jcast
        _jnius_classes['PythonActivity'] = PA
        _jnius_classes['WallpaperManager'] = autoclass('android.app.WallpaperManager')
        _jnius_classes['Intent'] = autoclass('android.content.Intent')
        _jnius_classes['DisplayMetrics'] = autoclass('android.util.DisplayMetrics')
        _jnius_classes['Bitmap'] = autoclass('android.graphics.Bitmap')
        _jnius_classes['ByteArrayOutputStream'] = autoclass('java.io.ByteArrayOutputStream')
        _jnius_classes['Base64'] = autoclass('android.util.Base64')
        _jnius_classes['CompressFormat'] = autoclass('android.graphics.Bitmap$CompressFormat')
        _jnius_classes['Canvas'] = autoclass('android.graphics.Canvas')
        _jnius_classes['BitmapConfig'] = autoclass('android.graphics.Bitmap$Config')
        HAS_JNIUS = True
    except Exception:
        HAS_JNIUS = False

def _pick_base_dir() -> Path:
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    if IS_ANDROID:
        here = Path(__file__).parent
        if (here / "index.html").exists():
            return here
        for env in ("ANDROID_APP_PATH", "ANDROID_PRIVATE"):
            v = os.environ.get(env)
            if not v:
                continue
            for cand in (Path(v), Path(v) / "app"):
                if (cand / "index.html").exists():
                    return cand
        return here
    return Path(__file__).parent


BASE_DIR = _pick_base_dir()
STATIC_DIR = BASE_DIR / "static"
MANIFEST_FILE = BASE_DIR / "manifest.json"

if IS_ANDROID:
    _LOG_DIR = Path(os.environ.get('ANDROID_PRIVATE', '/tmp'))
elif getattr(sys, 'frozen', False):
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

if IS_ANDROID:
    PORT = 8765
else:
    PORT = find_free_port(8765)

def get_manifest():
    if MANIFEST_FILE.exists():
        with open(MANIFEST_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"version": "1.0.0", "name": "Plants VS Zombies Desktop"}

try:
    import updater as _updater_mod
    _updater = _updater_mod.Updater(BASE_DIR, get_manifest().get("version", "0.0.0"))
except Exception as _e:
    _updater = None

try:
    import discord_rpc as _discord_rpc
except Exception as _e:
    _discord_rpc = None
    print(f"[DRPC] module unavailable: {_e}", flush=True)

import re

def _strip_json_comments(text):
    result = []
    i = 0
    in_string = False
    while i < len(text):
        c = text[i]
        if in_string:
            result.append(c)
            if c == '\\' and i + 1 < len(text):
                i += 1
                result.append(text[i])
            elif c == '"':
                in_string = False
        elif c == '"':
            in_string = True
            result.append(c)
        elif c == '/' and i + 1 < len(text):
            if text[i + 1] == '/':
                while i < len(text) and text[i] != '\n':
                    i += 1
                continue
            elif text[i + 1] == '*':
                i += 2
                while i + 1 < len(text) and not (text[i] == '*' and text[i + 1] == '/'):
                    i += 1
                i += 2
                continue
            else:
                result.append(c)
        else:
            result.append(c)
        i += 1
    return ''.join(result)

def get_custom_waves():
    waves_dir = BASE_DIR / "custom_waves"
    result = []
    failed = 0
    if not waves_dir.exists():
        return {"waves": result, "failed": 0}
    for f in sorted(waves_dir.iterdir()):
        if f.suffix != ".json":
            continue
        try:
            with open(f, encoding="utf-8") as fp:
                raw = fp.read()
            cleaned = _strip_json_comments(raw)
            data = json.loads(cleaned)
            if "waves" in data:
                data["_filename"] = f.stem
                result.append(data)
            else:
                failed += 1
        except Exception:
            failed += 1
    return {"waves": result, "failed": failed}

def _get_wallpaper_windows() -> str:
    try:
        SPI_GETDESKWALLPAPER = 0x0073
        buf = ctypes.create_unicode_buffer(260)
        ctypes.windll.user32.SystemParametersInfoW(SPI_GETDESKWALLPAPER, len(buf), buf, 0)
        wp = buf.value
        if wp and os.path.exists(wp):
            return wp
    except Exception:
        pass
    return ""

def _get_wallpaper_linux() -> str:
    try:
        r = subprocess.run(
            ["gsettings", "get", "org.gnome.desktop.background", "picture-uri"],
            capture_output=True, text=True, timeout=3
        )
        if r.returncode == 0:
            uri = r.stdout.strip().strip("'\"")
            if uri.startswith("file://"):
                uri = uri[7:]
            if uri and os.path.exists(uri):
                return uri
    except Exception:
        pass
    try:
        r = subprocess.run(
            ["gsettings", "get", "org.gnome.desktop.background", "picture-uri-dark"],
            capture_output=True, text=True, timeout=3
        )
        if r.returncode == 0:
            uri = r.stdout.strip().strip("'\"")
            if uri.startswith("file://"):
                uri = uri[7:]
            if uri and os.path.exists(uri):
                return uri
    except Exception:
        pass
    try:
        cfg = Path.home() / ".config" / "plasma-org.kde.plasma.desktop-appletsrc"
        if cfg.exists():
            text = cfg.read_text(encoding="utf-8", errors="ignore")
            for line in text.splitlines():
                if line.strip().startswith("Image="):
                    img = line.split("=", 1)[1].strip()
                    if img.startswith("file://"):
                        img = img[7:]
                    if img and os.path.exists(img):
                        return img
    except Exception:
        pass
    return ""

def _drawable_to_bitmap(drawable):
    C = _jnius_classes
    try:
        bmp = drawable.getBitmap()
        if bmp is not None:
            return bmp
    except Exception:
        pass
    w = drawable.getIntrinsicWidth()
    h = drawable.getIntrinsicHeight()
    if w <= 0:
        w = 64
    if h <= 0:
        h = 64
    Bitmap = C['Bitmap']
    bmp = Bitmap.createBitmap(w, h, C['BitmapConfig'].ARGB_8888)
    canvas = C['Canvas'](bmp)
    drawable.setBounds(0, 0, w, h)
    drawable.draw(canvas)
    return bmp

def _bitmap_to_base64(bitmap, max_size=800):
    C = _jnius_classes
    w, h = bitmap.getWidth(), bitmap.getHeight()
    if w > max_size or h > max_size:
        scale = max_size / max(w, h)
        nw, nh = int(w * scale), int(h * scale)
        bitmap = C['Bitmap'].createScaledBitmap(bitmap, nw, nh, True)
    stream = C['ByteArrayOutputStream']()
    bitmap.compress(C['CompressFormat'].PNG, 80, stream)
    raw = stream.toByteArray()
    return C['Base64'].encodeToString(raw, C['Base64'].NO_WRAP)

def _get_wallpaper_android() -> str:
    _init_jnius()
    if not HAS_JNIUS:
        print("[WALLPAPER] No JNIUS available", flush=True)
        return ""
    try:
        C = _jnius_classes
        activity = C['PythonActivity'].mActivity
        wm = C['WallpaperManager'].getInstance(activity)

        drawable = None
        for method_name in ('getDrawable', 'peekDrawable', 'getBuiltInDrawable', 'getFastDrawable'):
            try:
                method = getattr(wm, method_name, None)
                if method:
                    drawable = method()
                    if drawable is not None:
                        print(f"[WALLPAPER] Got drawable via {method_name}", flush=True)
                        break
            except Exception as e:
                print(f"[WALLPAPER] {method_name} failed: {e}", flush=True)

        if drawable is None:
            try:
                bmp = wm.getBitmap()
                if bmp is not None:
                    return _bitmap_to_base64(bmp)
            except Exception as e:
                print(f"[WALLPAPER] getBitmap failed: {e}", flush=True)
            print("[WALLPAPER] No drawable from any method", flush=True)
            return ""

        bmp = _drawable_to_bitmap(drawable)
        return _bitmap_to_base64(bmp)
    except Exception:
        return ""

def _get_icons_android() -> list:
    _init_jnius()
    if not HAS_JNIUS:
        return []
    try:
        C = _jnius_classes
        activity = C['PythonActivity'].mActivity
        pm = activity.getPackageManager()
        Intent = C['Intent']
        intent = Intent(Intent.ACTION_MAIN, None)
        intent.addCategory(Intent.CATEGORY_LAUNCHER)
        apps = pm.queryIntentActivities(intent, 0)
        count = min(apps.size(), 60)
        screen = _get_screen_android()
        start_x, start_y = 20, 40
        step_x, step_y = 90, 90
        cols = max(1, (screen["width"] - start_x * 2) // step_x)
        icons = []
        for i in range(count):
            ri = apps.get(i)
            name = ri.loadLabel(pm)
            if name:
                name = str(name)
            else:
                name = f"App {i+1}"
            col = i % cols
            row = i // cols
            x = start_x + col * step_x
            y = start_y + row * step_y
            data = {"name": name, "x": x, "y": y}
            try:
                icon_drawable = ri.loadIcon(pm)
                if icon_drawable is not None:
                    bmp = _drawable_to_bitmap(icon_drawable)
                    data["icon"] = _bitmap_to_base64(bmp, 64)
            except Exception:
                pass
            icons.append(data)
        return icons
    except Exception:
        return []

def _get_screen_android() -> dict:
    _init_jnius()
    if not HAS_JNIUS:
        return {"width": 1920, "height": 1080}
    try:
        C = _jnius_classes
        activity = C['PythonActivity'].mActivity
        wm = activity.getWindowManager()
        dm = C['DisplayMetrics']()
        wm.getDefaultDisplay().getMetrics(dm)
        return {"width": dm.widthPixels, "height": dm.heightPixels}
    except Exception:
        return {"width": 1920, "height": 1080}

def get_wallpaper_path() -> str:
    if IS_WINDOWS:
        return _get_wallpaper_windows()
    if IS_LINUX:
        return _get_wallpaper_linux()
    return ""

def _bgra_to_png_bytes(bgra: bytes, size: int) -> bytes:
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        row = bgra[y * stride:(y + 1) * stride]
        for x in range(size):
            b, g, r, a = row[x * 4], row[x * 4 + 1], row[x * 4 + 2], row[x * 4 + 3]
            raw.append(r); raw.append(g); raw.append(b); raw.append(a)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

def _get_icon_base64(path: str):
    if not IS_WINDOWS:
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
        png = _bgra_to_png_bytes(buf, size)

        ctypes.windll.gdi32.SelectObject(memdc, old)
        ctypes.windll.gdi32.DeleteObject(hbmp)
        ctypes.windll.gdi32.DeleteDC(memdc)
        ctypes.windll.user32.ReleaseDC(None, hdc)
        ctypes.windll.user32.DestroyIcon(hicon)

        return base64.b64encode(png).decode()
    except Exception:
        return None

def _wallpaper_mime(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".jpg", ".jpeg"): return "image/jpeg"
    if ext == ".png": return "image/png"
    if ext == ".bmp": return "image/bmp"
    if ext == ".webp": return "image/webp"
    if ext == ".gif": return "image/gif"
    return "image/png"

def get_wallpaper_data():
    if IS_ANDROID:
        return {"data": _get_wallpaper_android(), "mime": "image/png"}
    wp = get_wallpaper_path()
    if not wp:
        return {"data": "", "mime": "image/png"}
    try:
        with open(wp, "rb") as f:
            raw = f.read()
        return {"data": base64.b64encode(raw).decode(), "mime": _wallpaper_mime(wp)}
    except Exception:
        return {"data": "", "mime": "image/png"}

def get_desktop_icons():
    if IS_ANDROID:
        return _get_icons_android()

    def _desktop_paths():
        paths = []
        if IS_LINUX:
            try:
                r = subprocess.run(
                    ["xdg-user-dir", "DESKTOP"],
                    capture_output=True, text=True, timeout=3
                )
                if r.returncode == 0:
                    xdg = Path(r.stdout.strip())
                    if xdg.exists():
                        paths.append(xdg)
            except Exception:
                pass
            if not paths:
                for name in ("Desktop", "\u0420\u0430\u0431\u043e\u0447\u0438\u0439 \u0441\u0442\u043e\u043b"):
                    p = Path.home() / name
                    if p.exists():
                        paths.append(p)
                        break
        else:
            user_desktop = Path.home() / "Desktop"
            public_root = os.environ.get("PUBLIC", r"C:\Users\Public")
            public_desktop = Path(public_root) / "Desktop"
            for p in (user_desktop, public_desktop):
                if p.exists():
                    paths.append(p)
        return paths

    def _display_name(item: Path) -> str:
        if item.suffix.lower() in (".lnk", ".url", ".desktop"):
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
    if IS_ANDROID:
        return _get_screen_android()
    if HAS_WIN32:
        w = win32api.GetSystemMetrics(0)
        h = win32api.GetSystemMetrics(1)
        return {"width": w, "height": h}
    if IS_LINUX:
        try:
            r = subprocess.run(
                ["xrandr", "--current"],
                capture_output=True, text=True, timeout=3
            )
            if r.returncode == 0:
                import re
                m = re.search(r"(\d+)x(\d+)\s+\d+\.\d+\*", r.stdout)
                if m:
                    return {"width": int(m.group(1)), "height": int(m.group(2))}
        except Exception:
            pass
    return {"width": 1920, "height": 1080}

class GameHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.webp': 'image/webp',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.json': 'application/json',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, fmt, *args):
        pass

    def _check_access(self) -> bool:
        if IS_ANDROID or not HAS_WEBVIEW:
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
            wp = get_wallpaper_data()
            self._json({
                "wallpaper": wp["data"],
                "wallpaper_mime": wp["mime"],
                "icons": get_desktop_icons(),
                "screen": get_screen_size(),
            })
        elif parsed.path == "/api/manifest":
            self._json(get_manifest())
        elif parsed.path == "/api/screen":
            self._json(get_screen_size())
        elif parsed.path == "/api/custom_waves":
            self._json(get_custom_waves())
        elif parsed.path == "/api/update/check":
            if _updater is None:
                self._json({"error": "updater_unavailable", "build_type": "unknown", "current": get_manifest().get("version", "0.0.0")})
            else:
                from urllib.parse import parse_qs
                qs = parse_qs(parsed.query)
                force = qs.get("force", ["0"])[0] == "1"
                self._json(_updater.check(force=force))
        elif parsed.path == "/api/update/status":
            if _updater is None:
                self._json({"stage": "error", "progress": 0, "message": "updater_unavailable"})
            else:
                self._json(_updater_mod.get_status())
        elif parsed.path == "/api/update/log":
            if _updater is None:
                self._json({"log": ""})
            else:
                self._json({"log": _updater_mod.tail_log(_updater.log_file, n=50)})
        elif parsed.path == "/api/logs/read":
            try:
                if not LOG_FILE.exists():
                    self._json({"ok": True, "content": ""})
                else:
                    with _log_lock:
                        with open(LOG_FILE, "r", encoding="utf-8", errors="replace") as f:
                            content = f.read()
                    self._json({"ok": True, "content": content})
            except Exception as e:
                self._json({"ok": False, "error": str(e), "content": ""})
            return
        elif parsed.path == "/api/discord/available":
            if _discord_rpc is None:
                self._json({"available": False, "reason": "module_unavailable"})
            else:
                ok, reason = _discord_rpc.check_available()
                self._json({"available": ok, "reason": reason, "disabled": _discord_rpc.is_disabled()})
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
        elif parsed.path == "/api/update/apply":
            if _updater is None:
                self._json({"ok": False, "error": "updater_unavailable"})
            else:
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length) if length > 0 else b"{}"
                try:
                    info = json.loads(body) if body else {}
                except Exception:
                    info = {}
                if not info.get("asset_url"):
                    info = _updater.check(force=True)
                if not info.get("available"):
                    self._json({"ok": False, "error": "no_update"})
                else:
                    _updater.run_apply_async(info)
                    self._json({"ok": True})
        elif parsed.path == "/api/logs/open":
            try:
                _open_log_in_system()
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
            return
        elif parsed.path == "/api/logs/share":
            try:
                result = _share_log_android() or {}
                resp = {"ok": True}
                resp.update(result)
                self._json(resp)
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
            return
        elif parsed.path == "/api/heartbeat":
            global _last_heartbeat, _heartbeat_started
            _last_heartbeat = time.time()
            _heartbeat_started = True
            self._json({"ok": True})
            return
        elif parsed.path == "/api/exit":
            self._json({"ok": True})
            try:
                self.wfile.flush()
            except Exception:
                pass
            def _shutdown():
                time.sleep(0.15)
                try:
                    if _discord_rpc is not None:
                        _discord_rpc.shutdown()
                except Exception:
                    pass
                try:
                    if HAS_WEBVIEW and getattr(webview, "windows", None):
                        for w in list(webview.windows):
                            try: w.destroy()
                            except Exception: pass
                except Exception:
                    pass
                try: os._exit(0)
                except Exception: pass
            threading.Thread(target=_shutdown, daemon=True).start()
            return
        elif parsed.path == "/api/discord/enable":
            try:
                if _discord_rpc is not None:
                    _discord_rpc.enable()
                    self._json({"ok": True, "available": _discord_rpc.is_available()})
                else:
                    self._json({"ok": False, "error": "module_unavailable", "available": False})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
            return
        elif parsed.path == "/api/discord/status":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length > 0 else b"{}"
            try:
                data = json.loads(body) if body else {}
                if _discord_rpc is not None:
                    _discord_rpc.set_status(
                        details=data.get("details"),
                        state=data.get("state"),
                        reset_timer=bool(data.get("reset_timer", False)),
                        small_image=data.get("small_image"),
                        small_text=data.get("small_text"),
                    )
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
            return
        elif parsed.path == "/api/discord/disable":
            try:
                if _discord_rpc is not None:
                    _discord_rpc.disable()
                self._json({"ok": True})
            except Exception as e:
                self._json({"ok": False, "error": str(e)})
            return
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

def start_server():
    server = HTTPServer(("127.0.0.1", PORT), GameHandler)
    print(f"[PvZ Desktop] Server running: http://127.0.0.1:{PORT}")
    server.serve_forever()

_lock_file = None

_last_heartbeat = time.time()
_heartbeat_started = False
_watchdog_started = False
HEARTBEAT_TIMEOUT = 25.0
HEARTBEAT_GRACE = 30.0


def _force_exit(reason):
    print(f"[WATCHDOG] forcing exit: {reason}", flush=True)
    try:
        if _discord_rpc is not None:
            _discord_rpc.shutdown()
    except Exception:
        pass
    try:
        if HAS_WEBVIEW and getattr(webview, "windows", None):
            for w in list(webview.windows):
                try: w.destroy()
                except Exception: pass
    except Exception:
        pass
    try:
        if _lock_file is not None:
            _lock_file.close()
    except Exception:
        pass
    try: os._exit(0)
    except Exception: pass


def _start_watchdog():
    global _watchdog_started
    if _watchdog_started:
        return
    _watchdog_started = True
    def _loop():
        time.sleep(HEARTBEAT_GRACE)
        while True:
            time.sleep(2)
            if not _heartbeat_started:
                continue
            silent = time.time() - _last_heartbeat
            if silent > HEARTBEAT_TIMEOUT:
                _force_exit(f"no heartbeat for {silent:.1f}s (WebView likely crashed)")
                return
    threading.Thread(target=_loop, daemon=True).start()

def _open_log_in_system():
    log_path = LOG_FILE
    if not log_path.exists():
        try:
            log_path.parent.mkdir(parents=True, exist_ok=True)
            log_path.write_text("", encoding="utf-8")
        except Exception:
            pass

    if IS_ANDROID:
        try:
            from jnius import autoclass
            PA = autoclass('org.kivy.android.PythonActivity')
            activity = PA.mActivity
            Intent = autoclass('android.content.Intent')
            Uri = autoclass('android.net.Uri')
            File = autoclass('java.io.File')

            shareable = Path(os.environ.get('ANDROID_PRIVATE', '/tmp')) / "shared"
            try:
                shareable.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            ext_dir = None
            try:
                ext = activity.getExternalFilesDir(None)
                if ext:
                    ext_dir = Path(ext.getAbsolutePath()) / "logs"
                    ext_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                ext_dir = None
            target_dir = ext_dir or shareable
            target = target_dir / "game.log"
            try:
                import shutil
                shutil.copyfile(log_path, target)
            except Exception:
                target = log_path

            authority = activity.getPackageName() + ".fileprovider"
            f = File(str(target))
            try:
                FileProvider = autoclass('androidx.core.content.FileProvider')
                uri = FileProvider.getUriForFile(activity, authority, f)
            except Exception:
                uri = Uri.fromFile(f)

            intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(uri, "text/plain")
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            chooser = Intent.createChooser(intent, "Open log")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(chooser)
            return
        except Exception as e:
            print(f"[LOGS] android open failed: {e}", flush=True)
            raise
    if IS_WINDOWS:
        os.startfile(str(log_path))
        return
    if IS_LINUX:
        subprocess.Popen(["xdg-open", str(log_path)],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return
    if sys.platform == "darwin":
        subprocess.Popen(["open", str(log_path)])
        return
    raise RuntimeError("unsupported platform")


def _share_log_android():
    if not IS_ANDROID:
        raise RuntimeError("android_only")
    log_path = LOG_FILE
    if not log_path.exists():
        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text("", encoding="utf-8")

    ts = time.strftime("%Y%m%d-%H%M%S")
    fname = f"pvz-game-{ts}.log"

    try:
        from jnius import autoclass
        PA = autoclass('org.kivy.android.PythonActivity')
        activity = PA.mActivity
        Intent = autoclass('android.content.Intent')
        Uri = autoclass('android.net.Uri')
        File = autoclass('java.io.File')

        target = log_path
        try:
            ext = activity.getExternalFilesDir(None)
            if ext:
                ext_dir = Path(ext.getAbsolutePath()) / "logs"
                ext_dir.mkdir(parents=True, exist_ok=True)
                target = ext_dir / fname
                import shutil
                shutil.copyfile(log_path, target)
        except Exception:
            pass

        authority = activity.getPackageName() + ".fileprovider"
        f = File(str(target))
        try:
            FileProvider = autoclass('androidx.core.content.FileProvider')
            uri = FileProvider.getUriForFile(activity, authority, f)
        except Exception:
            uri = Uri.fromFile(f)

        intent = Intent(Intent.ACTION_SEND)
        intent.setType("text/plain")
        intent.putExtra(Intent.EXTRA_STREAM, uri)
        intent.putExtra(Intent.EXTRA_SUBJECT, "PvZ Desktop game.log")
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        chooser = Intent.createChooser(intent, "Сохранить лог")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(chooser)
        return {"method": "intent"}
    except Exception as e:
        print(f"[LOGS] jnius share failed, using fallback: {e}", flush=True)

    import shutil
    candidates = []
    ext_storage = os.environ.get("EXTERNAL_STORAGE")
    if ext_storage:
        candidates.append(Path(ext_storage) / "Download")
    candidates.append(Path("/storage/emulated/0/Download"))
    candidates.append(Path("/sdcard/Download"))
    if ext_storage:
        candidates.append(Path(ext_storage))

    last_err = None
    for c in candidates:
        try:
            c.mkdir(parents=True, exist_ok=True)
            target = c / fname
            shutil.copyfile(log_path, target)
            print(f"[LOGS] saved to {target}", flush=True)
            return {"method": "copy", "path": str(target)}
        except Exception as e:
            last_err = e
            continue

    try:
        priv_dir = Path(os.environ.get('ANDROID_PRIVATE', '/tmp')) / "shared"
        priv_dir.mkdir(parents=True, exist_ok=True)
        target = priv_dir / fname
        shutil.copyfile(log_path, target)
        return {"method": "private", "path": str(target)}
    except Exception as e:
        last_err = e

    raise RuntimeError(f"no writable location: {last_err}")


_android_perms_event = threading.Event()
_android_perms_result = {"perms": [], "grants": []}

def _on_android_perms_result(perms, grants):
    _android_perms_result["perms"] = list(perms or [])
    _android_perms_result["grants"] = list(grants or [])
    print(f"[PERMS] result perms={perms} grants={grants}", flush=True)
    _android_perms_event.set()

def _request_android_permissions():
    if not IS_ANDROID:
        return
    try:
        from android.permissions import request_permissions, Permission, check_permission
        perms = []
        for name in ('READ_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'SET_WALLPAPER'):
            p = getattr(Permission, name, None)
            if p is not None:
                perms.append(p)
        already = []
        try:
            already = [p for p in perms if check_permission(p)]
        except Exception:
            already = []
        missing = [p for p in perms if p not in already]
        print(f"[PERMS] requesting={missing} already_granted={already}", flush=True)
        if not missing:
            _android_perms_event.set()
            return
        try:
            request_permissions(missing, _on_android_perms_result)
        except TypeError:
            request_permissions(missing)
            _android_perms_event.set()
        if not _android_perms_event.wait(timeout=30):
            print("[PERMS] timeout waiting for permission dialog", flush=True)
    except Exception as e:
        print(f"[PERMS] request_permissions failed: {e}", flush=True)

def acquire_lock():
    global _lock_file
    if IS_ANDROID:
        return True
    if IS_WINDOWS:
        lock_path = os.path.join(os.environ.get("TEMP", "."), "pvz_desktop.lock")
        try:
            _lock_file = open(lock_path, "w")
            import msvcrt
            msvcrt.locking(_lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except (OSError, IOError):
            return False
    if IS_LINUX:
        lock_path = "/tmp/pvz_desktop.lock"
        try:
            _lock_file = open(lock_path, "w")
            import fcntl
            fcntl.flock(_lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except (OSError, IOError):
            return False
    return True

def main():
    if IS_ANDROID:
        try:
            _request_android_permissions()
        except Exception as e:
            print(f"[PERMS] startup request failed: {e}", flush=True)

    if not acquire_lock():
        print("[PvZ Desktop] Game is already running!")
        if IS_WINDOWS:
            ctypes.windll.user32.MessageBoxW(
                0, "Игра уже запущена!", "PvZ Desktop", 0x30
            )
        sys.exit(1)

    print(f"[PvZ Desktop] Port: {PORT}")

    if _discord_rpc is not None and not IS_ANDROID:
        try:
            _discord_rpc.start()
        except Exception as e:
            print(f"[DRPC] start failed: {e}", flush=True)

    if HAS_WEBVIEW:
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        if getattr(sys, 'frozen', False):
            _app_dir = Path(sys.executable).parent
        else:
            _app_dir = BASE_DIR
        storage_dir = str(_app_dir / "storage")
        os.makedirs(storage_dir, exist_ok=True)

        win = webview.create_window(
            "Plants VS Zombies Desktop",
            f"http://127.0.0.1:{PORT}?token={_ACCESS_TOKEN}",
            fullscreen=True,
            resizable=True,
            frameless=False,
            easy_drag=False,
        )

        def _on_closing():
            print("[PvZ Desktop] window closing, shutting down", flush=True)
            try:
                if _discord_rpc is not None:
                    _discord_rpc.shutdown()
            except Exception:
                pass
            threading.Thread(target=lambda: (time.sleep(0.5), os._exit(0)), daemon=True).start()

        try:
            win.events.closing += _on_closing
        except Exception:
            try:
                win.closing += _on_closing
            except Exception as e:
                print(f"[PvZ Desktop] cannot bind closing handler: {e}", flush=True)

        _start_watchdog()

        try:
            webview.start(private_mode=False, storage_path=storage_dir)
        finally:
            print("[PvZ Desktop] webview.start returned, exiting", flush=True)
            try:
                if _discord_rpc is not None:
                    _discord_rpc.shutdown()
            except Exception:
                pass
            os._exit(0)

        sys.exit(0)
    else:
        print("[PvZ Desktop] No pywebview, server-only mode.")
        print(f"[PvZ Desktop] Open http://127.0.0.1:{PORT} in browser.")
        start_server()

if __name__ == "__main__":
    main()
