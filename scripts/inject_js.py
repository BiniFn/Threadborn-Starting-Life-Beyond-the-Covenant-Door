import os
import re

file_path = "assets/phase1-client.js"
if not os.path.exists(file_path):
    print("Not found")
    exit(1)

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update toggleAuthNav to show dashboard
if 'const isOwner = loggedIn && authUser.role === "owner";' not in content:
    content = re.sub(
        r'(const loggedIn = Boolean\(authUser\);)',
        r'\1\n    const isOwner = loggedIn && authUser.role === "owner";\n    const dashEl = document.getElementById("nav-dashboard");\n    if (dashEl) dashEl.style.display = isOwner ? "" : "none";',
        content
    )

# 2. Append new dashboard logic at the bottom (before the IIFE closes)
dashboard_js = """
  // Dashboard Logic
  window.loadDashboardConfig = async function loadDashboardConfig() {
    try {
      const data = await apiFetch("/api/dashboard/config");
      
      const notifBanner = document.getElementById("global-announcement-banner");
      if (data.notification) {
        notifBanner.textContent = data.notification;
        notifBanner.style.display = "";
        const notifInput = document.getElementById("dashboard-announcement");
        if (notifInput) notifInput.value = data.notification;
      } else {
        notifBanner.style.display = "none";
      }

      const cdBanner = document.getElementById("global-countdown-banner");
      if (data.countdown && data.countdown.target_date) {
        document.getElementById("countdown-title").textContent = data.countdown.title;
        cdBanner.style.display = "";
        const cdTitleInput = document.getElementById("dashboard-countdown-title");
        const cdDateInput = document.getElementById("dashboard-countdown-date");
        if (cdTitleInput) cdTitleInput.value = data.countdown.title;
        if (cdDateInput) cdDateInput.value = data.countdown.target_date;

        setInterval(() => {
          const target = new Date(data.countdown.target_date).getTime();
          const now = new Date().getTime();
          const distance = target - now;
          if (distance < 0) {
            document.getElementById("countdown-timer").textContent = "RELEASED";
            return;
          }
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          document.getElementById("countdown-timer").textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
      } else {
        cdBanner.style.display = "none";
      }
    } catch (e) { }
  };

  window.saveDashboardConfig = async function saveDashboardConfig() {
    try {
      const notification = document.getElementById("dashboard-announcement").value;
      const title = document.getElementById("dashboard-countdown-title").value;
      const target_date = document.getElementById("dashboard-countdown-date").value;
      
      await apiFetch("/api/dashboard/config", {
        method: "PUT",
        body: JSON.stringify({ notification, countdown: { title, target_date } })
      });
      alert("Dashboard config saved!");
      loadDashboardConfig();
    } catch (e) {
      alert("Failed to save config: " + e.message);
    }
  };

  window.loadDashboardArt = async function loadDashboardArt() {
    try {
      const data = await apiFetch("/api/dashboard/art");
      const gallery = document.getElementById("dynamic-art-gallery");
      if (!gallery || !data.art) return;
      
      // Group by character
      const grouped = {};
      data.art.forEach(item => {
        const char = item.character_name || "Unknown";
        if (!grouped[char]) grouped[char] = [];
        grouped[char].push(item);
      });

      let html = `
        <article class="card app-card">
          <div>
            <strong style="display:block;margin-bottom:10px;font-size:24px;font-family:'Cormorant Garamond',serif;">Character Gallery</strong>
            <p>Official character designs, concept art, and illustrations for the Threadborn cast.</p>
          </div>
        </article>
      `;

      for (const [char, items] of Object.entries(grouped)) {
        html += `
          <article class="card chapter-card">
            <div class="chapter-label">
              <span>${char}</span>
              <span>Art Slot</span>
            </div>
            <strong>${char}</strong>
            <div class="character-gallery" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px;">
        `;
        for (const item of items) {
          const deleteBtn = (authUser && authUser.role === 'owner') ? 
            `<button onclick="deleteDashboardArt('${item.id}')" style="background:red;color:white;border:none;padding:2px 6px;margin-top:4px;cursor:pointer;">Delete</button>` : '';
          html += `
            <div>
              <img src="${item.url}" style="width: 100%; border-radius: 8px; cursor: pointer;" onclick="window.open('${item.url}', '_blank')" />
              ${deleteBtn}
            </div>
          `;
        }
        html += `</div></article>`;
      }
      gallery.innerHTML = html;
    } catch (e) { }
  };

  window.uploadDashboardArt = async function uploadDashboardArt() {
    const char = document.getElementById("dashboard-art-char").value;
    const label = document.getElementById("dashboard-art-label").value;
    const fileInput = document.getElementById("dashboard-art-file");
    const status = document.getElementById("dashboard-art-status");
    
    if (!char || !fileInput.files.length) {
      alert("Character name and file are required.");
      return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        status.textContent = "Uploading...";
        await apiFetch("/api/dashboard/art", {
          method: "POST",
          body: JSON.stringify({ characterName: char, label: label, dataUrl: e.target.result })
        });
        status.textContent = "Upload complete!";
        loadDashboardArt();
      } catch (error) {
        status.textContent = "Upload failed: " + error.message;
      }
    };
    reader.readAsDataURL(file);
  };

  window.deleteDashboardArt = async function deleteDashboardArt(id) {
    if (!confirm("Delete this art?")) return;
    try {
      await apiFetch("/api/dashboard/art", {
        method: "DELETE",
        body: JSON.stringify({ id })
      });
      loadDashboardArt();
    } catch (e) {
      alert("Failed to delete art.");
    }
  };

  window.deleteReaction = async function deleteReaction(reactionId) {
    if (!confirm("Delete this comment?")) return;
    try {
      await apiFetch("/api/reader/reactions", {
        method: "DELETE",
        body: JSON.stringify({ reactionId })
      });
      // Try to remove element from DOM
      const el = document.getElementById(`reaction-${reactionId}`);
      if (el) el.remove();
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  };

  window.deleteCommunityPost = async function deleteCommunityPost(postId) {
    if (!confirm("Delete this post?")) return;
    try {
      await apiFetch("/api/reader/community", {
        method: "POST",
        body: JSON.stringify({ action: "delete_post", postId })
      });
      alert("Post deleted.");
      location.reload();
    } catch (e) {
      alert("Delete failed.");
    }
  };

  window.deleteCommunityComment = async function deleteCommunityComment(commentId) {
    if (!confirm("Delete this comment?")) return;
    try {
      await apiFetch("/api/reader/community", {
        method: "POST",
        body: JSON.stringify({ action: "delete_comment", commentId })
      });
      alert("Comment deleted.");
      location.reload();
    } catch (e) {
      alert("Delete failed.");
    }
  };
"""

if 'window.loadDashboardConfig = ' not in content:
    content = re.sub(
        r'(window\.addEventListener\("load", async \(\) => \{)',
        dashboard_js + r'\n  \1',
        content
    )
    
    # Also inject the function calls into the load event listener
    content = re.sub(
        r'(await hydrateServerProgress\(\);)',
        r'\1\n    loadDashboardConfig();\n    loadDashboardArt();',
        content
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Injected JS into phase1-client.js")
