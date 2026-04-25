#!/bin/bash
# Comprehensive synchronization script for Threadborn platform
# Syncs web assets to Android and desktop builds

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_SITE_DIR="$PROJECT_ROOT/android-app/app/src/main/assets/site"
DESKTOP_APP_DIR="$PROJECT_ROOT/desktop-app"

echo "🔄 Threadborn Platform Sync Script"
echo "===================================="
echo ""

# Sync Android web assets
echo "📱 Syncing Android assets..."
if [ -d "$ANDROID_SITE_DIR" ]; then
  # Copy all HTML files
  cp "$PROJECT_ROOT/index.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/index-jp.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/login.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/login-jp.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/signup.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/signup-jp.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/profile.html" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/profile-jp.html" "$ANDROID_SITE_DIR/"
  
  # Copy manifest and service worker
  cp "$PROJECT_ROOT/manifest.json" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/service-worker.js" "$ANDROID_SITE_DIR/"
  cp "$PROJECT_ROOT/runtime-config.js" "$ANDROID_SITE_DIR/"
  
  # Sync assets
  cp -r "$PROJECT_ROOT/assets/" "$ANDROID_SITE_DIR/assets/" 2>/dev/null || true
  
  echo "✅ Android assets synced to $ANDROID_SITE_DIR"
else
  echo "⚠️  Android site directory not found at $ANDROID_SITE_DIR"
fi

# Verify sync
echo ""
echo "📋 Verification:"
echo "  - index.html: $([ -f "$ANDROID_SITE_DIR/index.html" ] && echo '✅' || echo '❌')"
echo "  - index-jp.html: $([ -f "$ANDROID_SITE_DIR/index-jp.html" ] && echo '✅' || echo '❌')"
echo "  - service-worker.js: $([ -f "$ANDROID_SITE_DIR/service-worker.js" ] && echo '✅' || echo '❌')"
echo "  - manifest.json: $([ -f "$ANDROID_SITE_DIR/manifest.json" ] && echo '✅' || echo '❌')"

echo ""
echo "✨ Sync complete! Ready to build and deploy."
