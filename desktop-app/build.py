from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "desktop-app"
SITE_DIR = APP_DIR / "site"
ENTRYPOINT = APP_DIR / "app.py"
SITE_FILES = [
  "index.html",
  "index-jp.html",
  "login.html",
  "login-jp.html",
  "signup.html",
  "signup-jp.html",
  "profile.html",
  "profile-jp.html",
  "runtime-config.js",
  "manifest.json",
  "service-worker.js",
  "global.css",
  "Threadborn.apk",
]


def sync_site_assets() -> None:
  if SITE_DIR.exists():
    shutil.rmtree(SITE_DIR)
  SITE_DIR.mkdir(parents=True, exist_ok=True)

  for name in SITE_FILES:
    source = ROOT / name
    if source.exists():
      shutil.copy2(source, SITE_DIR / name)

  assets_source = ROOT / "assets"
  if assets_source.exists():
    shutil.copytree(assets_source, SITE_DIR / "assets")


def main() -> None:
  sync_site_assets()
  separator = ";" if os.name == "nt" else ":"
  icon_ext = "ico" if os.name == "nt" else "icns"
  icon_path = ROOT / "assets" / f"app-icon.{icon_ext}"

  cmd = [
    sys.executable,
    "-m",
    "PyInstaller",
    "--noconfirm",
    "--clean",
    "--windowed",
    "--name",
    "Threadborn",
    "--icon",
    str(icon_path),
    "--collect-all",
    "webview",
    "--add-data",
    f"{SITE_DIR}{separator}site",
    str(ENTRYPOINT),
  ]
  subprocess.run(cmd, check=True, cwd=ROOT)


if __name__ == "__main__":
  main()
