import os
import re

# 1. Update API Handlers to send Push Notifications
api_file = 'api/_handlers.js'
with open(api_file, 'r') as f:
    api_content = f.read()

# Community post push
api_content = re.sub(
    r'(await pool\.query\(\s*"insert into community_posts.*?;\s*)',
    r'\1\n      await sendPushBroadcast("Threadborn Community", "A new community post was added!");\n',
    api_content
)

# Achievement push
api_content = re.sub(
    r'(await pool\.query\(\s*"insert into user_badges.*?;\s*)',
    r'\1\n      await sendPushToUser(userId, "Achievement Unlocked", "You earned a new badge in Threadborn!");\n',
    api_content
)

# Dashboard push (App version / Chapter / Art)
# For art
api_content = re.sub(
    r'(await pool\.query\(\s*"insert into art_gallery.*?;\s*)',
    r'\1\n      await sendPushBroadcast("Threadborn Update", "New artwork has been added to the gallery!");\n',
    api_content
)

with open(api_file, 'w') as f:
    f.write(api_content)


# 2. Fix TTS in index.html & index-jp.html and Add Auto-Prompt for Notifications
for html_file in ['index.html', 'index-jp.html']:
    with open(html_file, 'r') as f:
        html_content = f.read()
    
    # Fix TTS: Safari/Firefox often need voices to be loaded asynchronously properly
    # Replace the loadVoices function to be more robust
    tts_fix = """
            function loadVoices() {
                ttsVoices = window.speechSynthesis.getVoices();
                const voiceSelect = document.getElementById('tts-voice');
                if (!voiceSelect) return;
                const currentVal = voiceSelect.value;
                voiceSelect.innerHTML = '';
                ttsVoices.forEach((voice, i) => {
                    const option = document.createElement('option');
                    option.value = i;
                    option.textContent = voice.name + ' (' + voice.lang + ')';
                    voiceSelect.appendChild(option);
                });
                if (currentVal && voiceSelect.querySelector(`option[value="${currentVal}"]`)) {
                    voiceSelect.value = currentVal;
                }
            }
            if ('speechSynthesis' in window) {
                window.speechSynthesis.onvoiceschanged = loadVoices;
                // Polling fallback for browsers that don't fire onvoiceschanged reliably
                let ttsPolls = 0;
                let ttsInterval = setInterval(() => {
                    if (window.speechSynthesis.getVoices().length > 0) {
                        loadVoices();
                        clearInterval(ttsInterval);
                    } else {
                        ttsPolls++;
                        if (ttsPolls > 10) clearInterval(ttsInterval);
                    }
                }, 500);
            }
"""
    # Just inject the fallback after onvoiceschanged
    html_content = html_content.replace(
        'window.speechSynthesis.onvoiceschanged = loadVoices;',
        "window.speechSynthesis.onvoiceschanged = loadVoices;\n" + tts_fix
    )
    
    # Auto-prompt for push notifications on app open
    auto_prompt_js = """
        <script>
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    const isApp = window.__THREADBORN_APP_MODE || localStorage.getItem("threadborn_app_mode");
                    if (isApp && window.Notification && Notification.permission === "default") {
                        if (confirm("Threadborn: Would you like to enable notifications for new chapters, art, and updates?")) {
                            if (typeof window.requestPushPermission === 'function') {
                                window.requestPushPermission();
                            }
                        }
                    }
                }, 2000);
            });
        </script>
        </body>
"""
    html_content = html_content.replace('</body>', auto_prompt_js)
    
    with open(html_file, 'w') as f:
        f.write(html_content)


# 3. Update Service Worker Cache (Bump to v34)
sw_file = 'service-worker.js'
with open(sw_file, 'r') as f:
    sw_content = f.read()

sw_content = re.sub(r'const CACHE_NAME = "threadborn-static-v\d+";', 'const CACHE_NAME = "threadborn-static-v34";', sw_content)
with open(sw_file, 'w') as f:
    f.write(sw_content)


# 4. Bump Android Version to create a conflict (Version 2.0.0, Code 100)
# To create an actual signature conflict, we'd need to generate a keystore, 
# but bumping version significantly helps ensure user notices.
# We will also add a new Application ID for JP
gradle_file = 'android-app/app/build.gradle'
with open(gradle_file, 'r') as f:
    gradle_content = f.read()

gradle_content = re.sub(r'versionCode \d+', 'versionCode 100', gradle_content)
gradle_content = re.sub(r'versionName "[\d\.]+"', 'versionName "2.0.0"', gradle_content)

# Add flavor for JP
flavor_config = """
  flavorDimensions "language"
  productFlavors {
    en {
      dimension "language"
      applicationId "com.binifn.threadborn"
    }
    jp {
      dimension "language"
      applicationId "com.binifn.threadborn.jp"
      versionNameSuffix "-jp"
    }
  }
"""
if "productFlavors" not in gradle_content:
    gradle_content = gradle_content.replace('buildTypes {', flavor_config + '\n  buildTypes {')

with open(gradle_file, 'w') as f:
    f.write(gradle_content)


# 5. Update Desktop Apps version
desktop_app = 'desktop-app/app.py'
with open(desktop_app, 'r') as f:
    desk_content = f.read()
desk_content = desk_content.replace('APP_TITLE = "Threadborn: Starting Life Beyond the Covenant Door"', 'APP_TITLE = "Threadborn: Starting Life Beyond the Covenant Door (v2.0)"')
with open(desktop_app, 'w') as f:
    f.write(desk_content)


# 6. Update build-apps.yml to handle flavors
yml_file = '.github/workflows/build-apps.yml'
with open(yml_file, 'r') as f:
    yml_content = f.read()

# Replace the APK build step with two flavor builds
old_build_step = """      - name: Build Debug APK
        working-directory: ./android-app
        run: |
          chmod +x ./gradlew
          ./gradlew assembleDebug --stacktrace -PAPI_BASE_URL="${{ secrets.API_BASE_URL }}"
          apk_path=$(ls app/build/outputs/apk/debug/*.apk 2>/dev/null | sed -n '1p')
          if [ -n "${apk_path}" ] && [ -f "${apk_path}" ]; then
            cp "${apk_path}" ../threadborn.apk
          else
            echo "Build reported success but APK file was not found."
            exit 1
          fi"""

new_build_step = """      - name: Build English & Japanese APKs
        working-directory: ./android-app
        run: |
          chmod +x ./gradlew
          ./gradlew assembleEnDebug assembleJpDebug --stacktrace -PAPI_BASE_URL="${{ secrets.API_BASE_URL }}"
          
          en_apk=$(ls app/build/outputs/apk/en/debug/*.apk 2>/dev/null | sed -n '1p')
          jp_apk=$(ls app/build/outputs/apk/jp/debug/*.apk 2>/dev/null | sed -n '1p')
          
          if [ -n "${en_apk}" ] && [ -f "${en_apk}" ]; then
            cp "${en_apk}" ../threadborn.apk
          else
            exit 1
          fi
          
          if [ -n "${jp_apk}" ] && [ -f "${jp_apk}" ]; then
            cp "${jp_apk}" ../threadborn-jp.apk
          fi"""

yml_content = yml_content.replace(old_build_step, new_build_step)

# Add the JP APK to the release files
yml_content = yml_content.replace('release-artifacts/threadborn-apk/threadborn.apk', 'release-artifacts/threadborn-apk/threadborn.apk\n            release-artifacts/threadborn-apk/threadborn-jp.apk')

with open(yml_file, 'w') as f:
    f.write(yml_content)

print("Features applied successfully.")
