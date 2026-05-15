import os
import sys
import threading
import time
import traceback
from pathlib import Path

_IS_ANDROID = hasattr(sys, 'getandroidapilevel') or 'ANDROID_ROOT' in os.environ
if _IS_ANDROID:
    _LOG_DIR = Path(os.environ.get('ANDROID_PRIVATE', '/tmp'))
elif getattr(sys, 'frozen', False):
    _LOG_DIR = Path(sys.executable).parent
else:
    _LOG_DIR = Path(__file__).resolve().parent
_LOG_FILE = _LOG_DIR / "game.log"
_file_lock = threading.Lock()

CLIENT_ID = "1502660926892019783"
LARGE_IMAGE_KEY = "icon"
LARGE_IMAGE_TEXT = "Plants VS Zombies Desktop"

BUTTONS = [
    {"label": "Discord-сервер", "url": "https://discord.gg/HjAUGBSvze"},
    {"label": "GitHub", "url": "https://github.com/Xotaym/pvz-desktop"},
]

_rpc = None
_lock = threading.Lock()
_state = {
    "details": "В главном меню",
    "state": "Ожидание битвы",
    "start": None,
    "small_image": None,
    "small_text": None,
}
_connected = False
_disabled = False


def _log(msg):
    t = time.localtime()
    ms = int((time.time() - int(time.time())) * 1000)
    ts = f"[{time.strftime('%H:%M:%S', t)},{ms:03d}]"
    line = f"{ts} [DRPC] {msg}"
    print(line, flush=True)
    try:
        with _file_lock:
            with open(_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(line + "\n")
    except Exception:
        pass


def _try_connect():
    global _rpc, _connected
    if _disabled:
        _log("connect skipped: disabled")
        return False
    try:
        from pypresence import Presence
    except ImportError as e:
        _log(f"pypresence not installed: {e}")
        return False
    try:
        _log(f"connecting with client_id={CLIENT_ID}...")
        client = Presence(CLIENT_ID)
        client.connect()
        _rpc = client
        _connected = True
        _log("connected to Discord IPC successfully")
        return True
    except Exception as e:
        _log(f"connect failed: {type(e).__name__}: {e}")
        _rpc = None
        _connected = False
        return False


def _push():
    if not _connected or _rpc is None:
        _log(f"push skipped: connected={_connected}, rpc={_rpc is not None}")
        return
    try:
        kwargs = {
            "details": _state.get("details") or "Plants VS Zombies Desktop",
            "state": _state.get("state") or "",
            "large_image": LARGE_IMAGE_KEY,
            "large_text": LARGE_IMAGE_TEXT,
            "buttons": BUTTONS,
            "activity_type": 0,
        }
        if _state.get("small_image"):
            kwargs["small_image"] = _state["small_image"]
            if _state.get("small_text"):
                kwargs["small_text"] = _state["small_text"]
        if _state.get("start"):
            kwargs["start"] = int(_state["start"])
        _log(f"pushing: details='{kwargs['details']}', state='{kwargs['state']}', start={kwargs.get('start')}, small={kwargs.get('small_image')}")
        _rpc.update(**kwargs)
        _log("push ok")
    except Exception as e:
        _log(f"update failed: {type(e).__name__}: {e}")
        try:
            with _file_lock:
                with open(_LOG_FILE, "a", encoding="utf-8") as f:
                    traceback.print_exc(file=f)
        except Exception:
            traceback.print_exc()


def start():
    global _disabled
    if _disabled:
        _log("start skipped: disabled")
        return
    _log("start called, spawning connect worker")
    def _worker():
        if not _try_connect():
            _log("initial connect failed, RPC will retry on next set_status")
            return
        _push()
    threading.Thread(target=_worker, daemon=True).start()


def shutdown():
    global _rpc, _connected
    _log("shutdown called")
    with _lock:
        if _rpc is not None:
            try:
                _rpc.close()
                _log("rpc closed")
            except Exception as e:
                _log(f"close failed: {e}")
        _rpc = None
        _connected = False


def set_status(details=None, state=None, reset_timer=False, small_image=None, small_text=None):
    _log(f"set_status: details={details!r}, state={state!r}, reset_timer={reset_timer}, small={small_image!r}")
    with _lock:
        if details is not None:
            _state["details"] = details
        if state is not None:
            _state["state"] = state
        if reset_timer or _state.get("start") is None:
            _state["start"] = time.time()
        _state["small_image"] = small_image
        _state["small_text"] = small_text
        if not _connected:
            _log("not connected, attempting connect+push in background")
            threading.Thread(target=_try_and_push, daemon=True).start()
        else:
            threading.Thread(target=_push, daemon=True).start()


def _try_and_push():
    if _try_connect():
        _push()


def disable():
    global _disabled
    _log("disable called")
    _disabled = True
    shutdown()


def enable():
    global _disabled
    _log("enable called")
    was_disabled = _disabled
    _disabled = False
    if was_disabled or not _connected:
        threading.Thread(target=_try_and_push, daemon=True).start()


def is_disabled():
    return _disabled


def is_available():
    return _connected


def check_available():
    try:
        import pypresence  # noqa: F401
    except ImportError as e:
        return False, f"pypresence_missing: {e}"
    return True, "ok"
