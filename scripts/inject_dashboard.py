import os
import re

FILES = ["index.html", "index-jp.html"]

dashboard_html = """
    <section id="view-dashboard" class="view" style="display:none;">
      <div class="section-head">
        <div>
          <h2>Owner Dashboard</h2>
          <p class="section-copy">Manage site content, global announcements, and art gallery.</p>
        </div>
      </div>
      <div class="grid">
        <article class="card">
          <h3>Global Announcement</h3>
          <p>Set a persistent banner at the top of the main menus.</p>
          <input type="text" id="dashboard-announcement" placeholder="Announcement text..." style="width:100%; margin-bottom:10px; padding:8px;" />
          <button class="nav-btn" onclick="saveDashboardConfig()">Save Config</button>
        </article>
        <article class="card">
          <h3>Global Countdown</h3>
          <input type="text" id="dashboard-countdown-title" placeholder="Countdown Title..." style="width:100%; margin-bottom:10px; padding:8px;" />
          <input type="datetime-local" id="dashboard-countdown-date" style="width:100%; margin-bottom:10px; padding:8px;" />
          <button class="nav-btn" onclick="saveDashboardConfig()">Save Config</button>
        </article>
        <article class="card">
          <h3>Upload Art</h3>
          <p>Add new art to the Drawings gallery.</p>
          <input type="text" id="dashboard-art-char" placeholder="Character Name (e.g. Yono)" style="width:100%; margin-bottom:10px; padding:8px;" />
          <input type="text" id="dashboard-art-label" placeholder="Label (e.g. Official Concept)" style="width:100%; margin-bottom:10px; padding:8px;" />
          <input type="file" id="dashboard-art-file" accept="image/*" style="margin-bottom:10px;" />
          <button class="nav-btn" onclick="uploadDashboardArt()">Upload Art</button>
          <p id="dashboard-art-status" style="margin-top:10px;font-size:12px;"></p>
        </article>
      </div>
    </section>
"""

banners_html = """
    <div id="global-announcement-banner" class="global-banner" style="display:none; background:#8a2be2; color:#fff; padding:10px; text-align:center; font-weight:bold; margin-bottom:16px; border-radius:8px;"></div>
    <div id="global-countdown-banner" class="global-banner" style="display:none; background:#222; color:#fff; padding:10px; text-align:center; margin-bottom:16px; border-radius:8px; border:1px solid #444;">
      <strong id="countdown-title"></strong>: <span id="countdown-timer"></span>
    </div>
"""

drawings_html = """
    <section id="view-drawings" class="view">
      <div class="section-head">
        <div>
          <h2>Drawings</h2>
          <p class="section-copy">Character art for Threadborn will be shown here.</p>
        </div>
      </div>
      <div id="dynamic-art-gallery" class="grid drawings-grid">
        <article class="card app-card">
          <div>
            <strong style="display:block;margin-bottom:10px;font-size:24px;font-family:'Cormorant Garamond',serif;">Character Gallery</strong>
            <p>Official character designs, concept art, and illustrations for the Threadborn cast.</p>
          </div>
        </article>
        <!-- Art will be injected here by JS -->
      </div>
    </section>
"""

for filepath in FILES:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Add nav-dashboard button
    if 'id="nav-dashboard"' not in content:
        content = re.sub(
            r'(<button class="nav-btn" id="nav-logout".*?>.*?</button>)',
            r'\1\n        <button class="nav-btn" id="nav-dashboard" data-view="dashboard" onclick="switchView(\'dashboard\')" style="display:none;">Dashboard</button>',
            content
        )
    
    # 2. Add banners after <main>
    if 'id="global-announcement-banner"' not in content:
        content = re.sub(
            r'(<main>)',
            f'\\1\n{banners_html}',
            content
        )
    
    # 3. Add dashboard section before </main>
    if 'id="view-dashboard"' not in content:
        content = re.sub(
            r'(</main>)',
            f'{dashboard_html}\n\\1',
            content
        )
        
    # 4. Replace view-drawings
    if 'id="dynamic-art-gallery"' not in content:
        content = re.sub(
            r'<section id="view-drawings" class="view">.*?</section>',
            drawings_html,
            content,
            flags=re.DOTALL
        )
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
print("Injected dashboard HTML into index files.")
