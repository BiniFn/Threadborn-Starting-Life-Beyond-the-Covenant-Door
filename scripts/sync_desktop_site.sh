#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="$ROOT_DIR/desktop-app/site"

rm -rf "$SITE_DIR"
mkdir -p "$SITE_DIR"

cp "$ROOT_DIR/index.html" "$SITE_DIR/index.html"
cp -R "$ROOT_DIR/assets" "$SITE_DIR/assets"
cp "$ROOT_DIR/manifest.json" "$SITE_DIR/manifest.json"
cp "$ROOT_DIR/service-worker.js" "$SITE_DIR/service-worker.js"

if [[ -f "$ROOT_DIR/Threadborn.apk" ]]; then
  cp "$ROOT_DIR/Threadborn.apk" "$SITE_DIR/Threadborn.apk"
fi

echo "Synced website into desktop app assets."
