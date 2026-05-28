import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
import zipfile
from datetime import datetime
from pathlib import Path

REPO = "Xotaym/pvz-desktop"
GITHUB_API = f"https://api.github.com/repos/{REPO}/releases/latest"
CACHE_TTL = 30 * 60

_ssl_ctx = None


def _build_ssl_context():
    global _ssl_ctx
    if _ssl_ctx is not None:
        return _ssl_ctx
    try:
        import certifi
        _ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        try:
            _ssl_ctx = ssl.create_default_context()
        except Exception:
            _ssl_ctx = ssl._create_unverified_context()
    return _ssl_ctx

PRESERVE = {
    'save.json',
    'venv',
    '.venv',
    'env',
    '.env',
    'custom_waves',
    '.git',
    'update.log',
    '.update_tmp',
    '.update_backup',
    '.update_success',
    'storage',
    'game.log',
}

_status = {"stage": "idle", "progress": 0, "message": "", "version": None}
_status_lock = threading.Lock()
_check_cache = {"ts": 0, "data": None}
_cache_lock = threading.Lock()


def _set_status(stage=None, progress=None, message=None, version=None):
    with _status_lock:
        if stage is not None:
            _status["stage"] = stage
        if progress is not None:
            _status["progress"] = progress
        if message is not None:
            _status["message"] = message
        if version is not None:
            _status["version"] = version


def get_status():
    with _status_lock:
        return dict(_status)


def detect_build_type():
    if hasattr(sys, 'getandroidapilevel') or 'ANDROID_ROOT' in os.environ:
        return "apk"
    if getattr(sys, 'frozen', False):
        return "exe"
    return "source"


def _parse_version(s):
    if not s:
        return (0, 0, 0)
    s = s.strip().lstrip('v').lstrip('V')
    s = s.split('-')[0].split('+')[0]
    parts = []
    for p in s.split('.'):
        try:
            parts.append(int(p))
        except ValueError:
            digits = ''.join(c for c in p if c.isdigit())
            parts.append(int(digits) if digits else 0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def _is_newer(latest, current):
    return _parse_version(latest) > _parse_version(current)


def _http_get_json(url, timeout=15):
    req = urllib.request.Request(url, headers={
        "User-Agent": "pvz-desktop-updater",
        "Accept": "application/vnd.github+json",
    })
    ctx = _build_ssl_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _http_open(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": "pvz-desktop-updater"})
    ctx = _build_ssl_context()
    return urllib.request.urlopen(req, timeout=timeout, context=ctx)


def _classify_network_error(exc):
    if isinstance(exc, ssl.SSLError):
        return "ssl"
    if isinstance(exc, socket.gaierror):
        return "dns"
    if isinstance(exc, socket.timeout):
        return "timeout"
    if isinstance(exc, urllib.error.HTTPError):
        return f"http_{exc.code}"
    if isinstance(exc, urllib.error.URLError):
        reason = getattr(exc, "reason", None)
        if isinstance(reason, ssl.SSLError):
            return "ssl"
        if isinstance(reason, socket.gaierror):
            return "dns"
        if isinstance(reason, socket.timeout):
            return "timeout"
    return "network"


def _find_asset(assets, build_type, version):
    if not assets:
        return None
    suffix_map = {"exe": ".exe", "apk": ".apk"}
    suffix = suffix_map.get(build_type)
    if not suffix:
        return None
    for a in assets:
        name = a.get("name", "").lower()
        if name.endswith(suffix):
            return a.get("browser_download_url")
    return None


class Updater:
    def __init__(self, base_dir, current_version):
        self.base_dir = Path(base_dir)
        self.current_version = current_version
        self.build_type = detect_build_type()
        self.log_file = self.base_dir / "update.log"

    def _log(self, msg):
        line = f"[{datetime.now().isoformat(timespec='seconds')}] {msg}"
        try:
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception:
            pass
        print(f"[Updater] {msg}")

    def check(self, force=False):
        with _cache_lock:
            now = time.time()
            if not force and _check_cache["data"] and (now - _check_cache["ts"] < CACHE_TTL):
                return _check_cache["data"]

        try:
            data = _http_get_json(GITHUB_API, timeout=15)
        except (urllib.error.URLError, ssl.SSLError, socket.error, OSError) as e:
            kind = _classify_network_error(e)
            self._log(f"check failed ({kind}): {type(e).__name__}: {e}")
            return {
                "error": kind,
                "error_detail": f"{type(e).__name__}: {e}",
                "current": self.current_version,
                "build_type": self.build_type,
            }
        except Exception as e:
            self._log(f"check failed: {type(e).__name__}: {e}")
            return {
                "error": str(e),
                "error_detail": f"{type(e).__name__}: {e}",
                "current": self.current_version,
                "build_type": self.build_type,
            }

        if data.get("prerelease"):
            result = {
                "available": False, "current": self.current_version,
                "latest": self.current_version, "build_type": self.build_type,
                "notes": "", "asset_url": None,
            }
            with _cache_lock:
                _check_cache["ts"] = time.time()
                _check_cache["data"] = result
            return result

        tag = data.get("tag_name", "")
        latest_ver = tag.lstrip("v").lstrip("V")
        notes = data.get("body", "") or ""
        assets = data.get("assets", []) or []

        if self.build_type == "source":
            asset_url = data.get("zipball_url")
        else:
            asset_url = _find_asset(assets, self.build_type, latest_ver)

        available = _is_newer(latest_ver, self.current_version) and asset_url is not None

        result = {
            "available": available,
            "current": self.current_version,
            "latest": latest_ver,
            "build_type": self.build_type,
            "notes": notes[:4000],
            "asset_url": asset_url,
            "tag": tag,
        }
        with _cache_lock:
            _check_cache["ts"] = time.time()
            _check_cache["data"] = result
        return result

    def download(self, url, dest):
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        with _http_open(url, timeout=30) as resp:
            total = int(resp.headers.get("Content-Length") or 0)
            downloaded = 0
            with open(dest, "wb") as f:
                while True:
                    chunk = resp.read(64 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = int(downloaded * 90 / total)
                        _set_status(progress=pct, message=f"{downloaded // 1024} / {total // 1024} KB")
        if total > 0 and dest.stat().st_size != total:
            raise IOError(f"download size mismatch: {dest.stat().st_size} vs {total}")
        return dest

    def _is_preserved(self, rel_path):
        parts = Path(rel_path).parts
        if not parts:
            return False
        return parts[0] in PRESERVE

    def apply_source(self, zip_path):
        self._log(f"apply_source: {zip_path}")
        zip_path = Path(zip_path)
        if not zip_path.exists():
            raise FileNotFoundError(f"zip not found: {zip_path}")

        tmp_dir = self.base_dir / ".update_tmp"
        extract_dir = tmp_dir / "extracted"
        backup_dir = self.base_dir / ".update_backup"

        if extract_dir.exists():
            shutil.rmtree(extract_dir, ignore_errors=True)
        extract_dir.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_dir)

        extracted_root = None
        for child in extract_dir.iterdir():
            if child.is_dir():
                extracted_root = child
                break
        if extracted_root is None:
            extracted_root = extract_dir

        if backup_dir.exists():
            shutil.rmtree(backup_dir, ignore_errors=True)
        backup_dir.mkdir(parents=True)

        for item in extracted_root.rglob("*"):
            if not item.is_file():
                continue
            rel = item.relative_to(extracted_root)
            if self._is_preserved(rel):
                continue
            target = self.base_dir / rel
            if target.exists():
                bk = backup_dir / rel
                bk.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(target, bk)
                except Exception:
                    pass
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, target)

        shutil.rmtree(tmp_dir, ignore_errors=True)

        try:
            game_log = self.base_dir / "game.log"
            if game_log.exists():
                game_log.write_text("", encoding="utf-8")
        except Exception:
            pass

        self._log(f"source updated, restart pending")

    def apply_exe(self, exe_path):
        self._log(f"apply_exe: {exe_path}")
        if not getattr(sys, 'frozen', False):
            raise RuntimeError("not running as frozen exe")
        current_exe = Path(sys.executable)
        bat_path = Path(exe_path).parent / "update.bat"
        bat_content = (
            "@echo off\r\n"
            "timeout /t 2 /nobreak >nul\r\n"
            f'move /y "{exe_path}" "{current_exe}"\r\n'
            f'start "" "{current_exe}"\r\n'
            'del "%~f0"\r\n'
        )
        bat_path.write_text(bat_content, encoding="utf-8")
        DETACHED_PROCESS = 0x00000008
        CREATE_NEW_PROCESS_GROUP = 0x00000200
        subprocess.Popen(
            ["cmd", "/c", str(bat_path)],
            creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
            close_fds=True,
        )

    def apply_apk(self, apk_path):
        self._log(f"apply_apk: {apk_path}")
        apk_str = str(apk_path)
        try:
            try:
                import server as _srv
                _srv._init_jnius()
                if _srv.HAS_JNIUS:
                    autoclass = _srv._jnius_classes['autoclass']
                    PA = _srv._jnius_classes['PythonActivity']
                else:
                    raise ImportError("jnius not initialized in server")
            except Exception:
                from jnius import autoclass
                PA = autoclass('org.kivy.android.PythonActivity')

            activity = PA.mActivity
            if activity is None:
                raise RuntimeError("no current activity")
            Intent = autoclass('android.content.Intent')
            Uri = autoclass('android.net.Uri')
            File = autoclass('java.io.File')

            f = File(apk_str)
            uri = None
            try:
                FileProvider = autoclass('androidx.core.content.FileProvider')
                authority = activity.getPackageName() + ".fileprovider"
                uri = FileProvider.getUriForFile(activity, authority, f)
            except Exception as e:
                self._log(f"FileProvider unavailable: {e}, using file:// uri")
                uri = Uri.fromFile(f)

            intent = Intent(Intent.ACTION_VIEW)
            intent.setDataAndType(uri, "application/vnd.android.package-archive")
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity.startActivity(intent)
        except Exception as e:
            self._log(f"apply_apk jnius failed: {type(e).__name__}: {e}, trying shell fallback")
            try:
                subprocess.Popen(
                    ["am", "start", "-a", "android.intent.action.VIEW",
                     "-d", "file://" + apk_str,
                     "-t", "application/vnd.android.package-archive",
                     "--grant-read-uri-permission"],
                    close_fds=True,
                )
            except Exception as e2:
                self._log(f"shell fallback failed: {e2}")
                raise RuntimeError(f"apk install failed: {e}; fallback: {e2}")

    def restart(self):
        self._log("restart requested")
        if self.build_type == "exe":
            return
        if self.build_type == "apk":
            return
        try:
            if os.name == "nt":
                bat = self.base_dir / "start.bat"
                if bat.exists():
                    DETACHED_PROCESS = 0x00000008
                    subprocess.Popen(
                        ["cmd", "/c", str(bat)],
                        creationflags=DETACHED_PROCESS,
                        close_fds=True,
                        cwd=str(self.base_dir),
                    )
            else:
                sh = self.base_dir / "start.sh"
                if sh.exists():
                    subprocess.Popen(
                        ["bash", str(sh)],
                        cwd=str(self.base_dir),
                        start_new_session=True,
                    )
        except Exception as e:
            self._log(f"restart failed: {e}")

    def run_apply_async(self, info):
        t = threading.Thread(target=self._run_apply, args=(info,), daemon=True)
        t.start()

    def _android_download_dir(self):
        try:
            from jnius import autoclass
            PA = autoclass('org.kivy.android.PythonActivity')
            activity = PA.mActivity
            ext = activity.getExternalFilesDir(None)
            if ext:
                p = Path(ext.getAbsolutePath()) / "updates"
                p.mkdir(parents=True, exist_ok=True)
                return p
        except Exception as e:
            self._log(f"android dir resolve failed: {e}")
        return None

    def _run_apply(self, info):
        try:
            url = info.get("asset_url")
            if not url:
                _set_status(stage="error", message="no asset url")
                return

            _set_status(stage="downloading", progress=0, message="starting", version=info.get("latest"))

            if self.build_type == "apk":
                tmp = self._android_download_dir() or (self.base_dir / ".update_tmp")
            else:
                tmp = self.base_dir / ".update_tmp"
            tmp.mkdir(parents=True, exist_ok=True)

            if self.build_type == "source":
                dest = tmp / "source.zip"
            elif self.build_type == "exe":
                dest = tmp / f"pvz-desktop-{info.get('latest')}.exe"
            else:
                dest = tmp / f"pvz-desktop-{info.get('latest')}.apk"

            self.download(url, dest)
            _set_status(stage="applying", progress=92, message="applying")

            if self.build_type == "source":
                self.apply_source(dest)
                _set_status(stage="done", progress=100, message="updated, restarting")
                self.restart()
                threading.Timer(1.5, lambda: os._exit(0)).start()
            elif self.build_type == "exe":
                self.apply_exe(dest)
                _set_status(stage="done", progress=100, message="restarting")
                threading.Timer(1.5, lambda: os._exit(0)).start()
            else:
                self.apply_apk(dest)
                _set_status(stage="done", progress=100, message="installer launched")
        except (urllib.error.URLError, ssl.SSLError, socket.error, OSError) as e:
            kind = _classify_network_error(e)
            self._log(f"apply network error ({kind}): {type(e).__name__}: {e}")
            _set_status(stage="error", message=f"network ({kind}): {e}")
        except Exception as e:
            self._log(f"apply error: {type(e).__name__}: {e}")
            _set_status(stage="error", message=f"{type(e).__name__}: {e}")


def tail_log(log_path, n=50):
    p = Path(log_path)
    if not p.exists():
        return ""
    try:
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        return "".join(lines[-n:])
    except Exception:
        return ""
