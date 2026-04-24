from __future__ import annotations

import os
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import webview


APP_TITLE = "Threadborn — Starting Life Beyond the Covenant Door"
DEFAULT_API_BASE = "https://threadborn.vercel.app"


def bundled_path(*parts: str) -> Path:
  if hasattr(sys, "_MEIPASS"):
    base = Path(sys._MEIPASS)
  else:
    base = Path(__file__).resolve().parent
  return base.joinpath(*parts)


SITE_DIR = bundled_path("site")


class QuietRequestHandler(SimpleHTTPRequestHandler):
  def do_GET(self) -> None:
    if self.path == "/runtime-config.js":
      payload = f"window.__THREADBORN_API_BASE={self._api_base()!r};\n"
      encoded = payload.encode("utf-8")
      self.send_response(200)
      self.send_header("Content-Type", "application/javascript; charset=utf-8")
      self.send_header("Content-Length", str(len(encoded)))
      self.end_headers()
      self.wfile.write(encoded)
      return
    super().do_GET()

  def log_message(self, format: str, *args) -> None:
    return

  @staticmethod
  def _api_base() -> str:
    return os.environ.get("THREADBORN_API_BASE", DEFAULT_API_BASE).rstrip("/")


def start_server() -> tuple[ThreadingHTTPServer, str]:
  handler = partial(QuietRequestHandler, directory=str(SITE_DIR))
  server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
  thread = threading.Thread(target=server.serve_forever, daemon=True)
  thread.start()
  url = f"http://127.0.0.1:{server.server_address[1]}/index.html"
  return server, url


def main() -> None:
  server, url = start_server()

  window = webview.create_window(
    APP_TITLE,
    url,
    width=1440,
    height=960,
    min_size=(1100, 720),
    text_select=True,
  )

  try:
    webview.start()
  finally:
    server.shutdown()
    server.server_close()


if __name__ == "__main__":
  main()
