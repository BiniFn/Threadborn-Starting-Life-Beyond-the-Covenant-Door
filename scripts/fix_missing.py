import os
import re

# 1. Update index.html to add mobile dashboard button
with open('index.html', 'r', encoding='utf-8') as f:
    idx_content = f.read()

if 'id="mobile-nav-dashboard"' not in idx_content:
    idx_content = idx_content.replace(
        '<button class="nav-btn" id="mobile-nav-logout" onclick="logoutUser()" style="display:none;">Logout</button>',
        '<button class="nav-btn" id="mobile-nav-logout" onclick="logoutUser()" style="display:none;">Logout</button>\n    <button class="nav-btn" id="mobile-nav-dashboard" data-view="dashboard" onclick="switchView(\'dashboard\')" style="display:none;">Dashboard</button>'
    )
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(idx_content)

# 2. Update index-jp.html to add mobile dashboard button and translate missing tabs
with open('index-jp.html', 'r', encoding='utf-8') as f:
    jp_content = f.read()

jp_content = jp_content.replace('>Vols<', '>巻<')
jp_content = jp_content.replace('>Cast<', '>キャラクター<')
jp_content = jp_content.replace('>Art<', '>アート<')

if 'id="mobile-nav-dashboard"' not in jp_content:
    jp_content = jp_content.replace(
        '<button class="nav-btn" id="mobile-nav-logout" onclick="logoutUser()" style="display:none;">ログアウト</button>',
        '<button class="nav-btn" id="mobile-nav-logout" onclick="logoutUser()" style="display:none;">ログアウト</button>\n    <button class="nav-btn" id="mobile-nav-dashboard" data-view="dashboard" onclick="switchView(\'dashboard\')" style="display:none;">ダッシュボード</button>'
    )

with open('index-jp.html', 'w', encoding='utf-8') as f:
    f.write(jp_content)

# 3. Update assets/phase1-client.js
with open('assets/phase1-client.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

if 'mobile-nav-dashboard' not in js_content:
    js_content = js_content.replace(
        'const dashEl = document.getElementById("nav-dashboard");\n    if (dashEl) dashEl.style.display = isOwner ? "" : "none";',
        'const dashEl = document.getElementById("nav-dashboard");\n    if (dashEl) dashEl.style.display = isOwner ? "" : "none";\n    const mDashEl = document.getElementById("mobile-nav-dashboard");\n    if (mDashEl) mDashEl.style.display = isOwner ? "" : "none";'
    )
    with open('assets/phase1-client.js', 'w', encoding='utf-8') as f:
        f.write(js_content)

print("Fixed missing translations and mobile dashboard button.")
