#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="$ROOT_DIR/android-app/app/src/main/assets/site"

rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"
cp "$ROOT_DIR/index.html" "$SITE_DIR/index.html"
cp "$ROOT_DIR/login.html" "$SITE_DIR/login.html"
cp "$ROOT_DIR/signup.html" "$SITE_DIR/signup.html"
cp "$ROOT_DIR/profile.html" "$SITE_DIR/profile.html"
cp "$ROOT_DIR/runtime-config.js" "$SITE_DIR/runtime-config.js"
cp -R "$ROOT_DIR/assets" "$SITE_DIR/assets"
cp "$ROOT_DIR/manifest.json" "$SITE_DIR/manifest.json"
cp "$ROOT_DIR/service-worker.js" "$SITE_DIR/service-worker.js"

if [[ -f "$ROOT_DIR/Threadborn.apk" ]]; then
  cp "$ROOT_DIR/Threadborn.apk" "$SITE_DIR/Threadborn.apk"
fi

echo "Synced website into Android assets."
