from __future__ import annotations

import logging
import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import webview  # type: ignore

APP_TITLE = "Threadborn: Starting Life Beyond the Covenant Door (v2.0)"
DEFAULT_API_BASE = "https://threadborn.vercel.app"

logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)


def bundled_path(*parts: str) -> Path:
    if hasattr(sys, "_MEIPASS"):
        base = Path(getattr(sys, "_MEIPASS"))
    else:
        base = Path(__file__).resolve().parent
    return base.joinpath(*parts)


def resolve_site_dir() -> Path:
    # 1. Packaged build — site bundled inside the executable
    packaged_site = bundled_path("site")
    if packaged_site.joinpath("index.html").exists():
        return packaged_site

    # 2. Development mode — serve from the repo root
    source_site = Path(__file__).resolve().parents[1]
    if source_site.joinpath("index.html").exists():
        return source_site

    # 3. Fallback to the local site folder (empty on first clone)
    return packaged_site


SITE_DIR = resolve_site_dir()


class QuietRequestHandler(SimpleHTTPRequestHandler):
    """Serves the bundled site with a runtime-config.js injection."""

    def do_GET(self) -> None:  # type: ignore[override]
        # Inject runtime config so the JS knows it is running as a desktop app
        if self.path == "/runtime-config.js" or self.path.startswith(
            "/runtime-config.js?"
        ):
            payload = (
                f"window.__THREADBORN_API_BASE={self._api_base()!r};\n"
                "window.__THREADBORN_APP_MODE='desktop';\n"
            )
            encoded = payload.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(encoded)
            return
        super().do_GET()

    def log_message(self, format: str, *args) -> None:  # type: ignore[override]
        # Suppress the noisy HTTP request log lines
        pass

    @staticmethod
    def _api_base() -> str:
        return os.environ.get("THREADBORN_API_BASE", DEFAULT_API_BASE).rstrip("/")


def start_server() -> tuple[ThreadingHTTPServer, str]:
    """Start the local HTTP server and return (server, url)."""
    handler = partial(QuietRequestHandler, directory=str(SITE_DIR))
    # Port 0 → OS picks a free port automatically (no hardcoded port conflicts)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    port = server.server_address[1]
    url = f"http://127.0.0.1:{port}/index.html?app=desktop"
    logger.info("Local server started at http://127.0.0.1:%d", port)
    return server, url


def main() -> None:
    server, url = start_server()

    # Keyboard shortcuts injected into every page via JS evaluation
    js_shortcuts = """
    (function () {
        if (window.__desktopShortcutsLoaded) return;
        window.__desktopShortcutsLoaded = true;
        document.addEventListener('keydown', function (e) {
            var ctrl = e.ctrlKey || e.metaKey;
            // Ctrl/Cmd + R  →  reload page
            if (ctrl && e.key === 'r') {
                e.preventDefault();
                window.location.reload();
            }
            // Ctrl/Cmd + =  →  zoom in
            if (ctrl && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                document.body.style.zoom = (parseFloat(document.body.style.zoom || '1') + 0.1).toFixed(1);
            }
            // Ctrl/Cmd + -  →  zoom out
            if (ctrl && e.key === '-') {
                e.preventDefault();
                document.body.style.zoom = Math.max(0.5, parseFloat(document.body.style.zoom || '1') - 0.1).toFixed(1);
            }
            // Ctrl/Cmd + 0  →  reset zoom
            if (ctrl && e.key === '0') {
                e.preventDefault();
                document.body.style.zoom = '1';
            }
        });
    })();
    """

    try:
        _webview_window = webview.create_window(
            APP_TITLE,
            url,
            width=1440,
            height=960,
            min_size=(1100, 720),
            text_select=True,
            background_color="#06060C",  # Match the app's dark background
        )

        def on_loaded() -> None:
            try:
                _webview_window.evaluate_js(js_shortcuts)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not inject keyboard shortcuts: %s", exc)

        _webview_window.events.loaded += on_loaded

        webview.start(debug=False)

    except Exception as exc:
        logger.exception("Fatal error starting desktop window: %s", exc)
        raise
    finally:
        try:
            server.shutdown()
            server.server_close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
