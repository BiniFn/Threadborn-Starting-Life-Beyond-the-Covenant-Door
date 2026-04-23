from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "desktop-app"
SITE_DIR = APP_DIR / "site"
ENTRYPOINT = APP_DIR / "app.py"


def main() -> None:
  separator = ";" if os.name == "nt" else ":"
  cmd = [
    sys.executable,
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--windowed",
    "--name",
    "Threadborn",
    "--collect-all",
    "webview",
    "--add-data",
    f"{SITE_DIR}{separator}site",
    str(ENTRYPOINT),
  ]
  subprocess.run(cmd, check=True, cwd=ROOT)


if __name__ == "__main__":
  main()
