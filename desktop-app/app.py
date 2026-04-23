from __future__ import annotations

import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import webview


APP_TITLE = "Threadborn — Starting Life Beyond the Covenant Door"


def bundled_path(*parts: str) -> Path:
  if hasattr(sys, "_MEIPASS"):
    base = Path(sys._MEIPASS)
  else:
    base = Path(__file__).resolve().parent
  return base.joinpath(*parts)


SITE_DIR = bundled_path("site")


class QuietRequestHandler(SimpleHTTPRequestHandler):
  def log_message(self, format: str, *args) -> None:
    return


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
