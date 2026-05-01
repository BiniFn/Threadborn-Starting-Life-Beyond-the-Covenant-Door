(function () {
  function resolveApiBase() {
    const configured = (window.__THREADBORN_API_BASE || localStorage.getItem("threadborn_api_base") || "").replace(/\/$/, "");
    if (configured) {
      return configured;
    }
    const host = window.location.hostname;
    if (host === "appassets.androidplatform.net" || window.location.protocol === "file:") {
      return "https://threadborn.vercel.app";
    }
    return "";
  }

  const API_BASE = resolveApiBase();
  const QUEUE_KEY = "threadborn_sync_queue_v1";
  const FALLBACK_PROGRESS_KEY = "novelverse_reader_progress";
  const APP_SESSION_KEY = "threadborn_app_session";
  let csrfToken = "";
  let authUser = null;
  let bookmarkCache = [];
  let analyticsBuffer = [];
  let analyticsTimer = null;
  let syncTimer = null;
  let readerActiveSince = null;
  let authConfigMissing = false;

  function apiPath(path) {
    return `${API_BASE}${path}`;
  }

  function getAppMode() {
    return String(window.__THREADBORN_APP_MODE || localStorage.getItem("threadborn_app_mode") || "").trim().toLowerCase();
  }

  function buildAuthHeaders(headers = {}) {
    const next = Object.assign({ "Content-Type": "application/json" }, headers);
    const appMode = getAppMode();
    const appSession = localStorage.getItem(APP_SESSION_KEY) || "";
    if (appMode) {
      next["X-Threadborn-App-Mode"] = appMode;
      localStorage.setItem("threadborn_app_mode", appMode);
    }
    if (appSession) {
      next.Authorization = `Bearer ${appSession}`;
    }
    return next;
  }

  async function apiFetch(path, options = {}) {
    const headers = buildAuthHeaders(options.headers || {});
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    const response = await fetch(apiPath(path), Object.assign({}, options, {
      credentials: "include",
      cache: "no-store",
      headers
    }));
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = { success: false, error: "Invalid response" };
    }
    if (!response.ok || !payload.success) {
      const err = new Error(payload.error || "Request failed");
      err.status = response.status || 500;
      throw err;
    }
    return payload.data;
  }

  function saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  function readQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    } catch (error) {
      return [];
    }
  }

  function enqueue(item) {
    const queue = readQueue();
    queue.push(Object.assign({ retries: 0 }, item));
    saveQueue(queue);
  }

  async function drainQueue() {
    const queue = readQueue();
    if (!queue.length || !authUser) {
      return;
    }
    const nextQueue = [];
    for (const item of queue) {
      try {
        if (item.type === "progress") {
          await apiFetch("/api/reader/progress", {
            method: "PUT",
            body: JSON.stringify(item.payload)
          });
        } else if (item.type === "bookmark") {
          await apiFetch("/api/reader/bookmarks", {
            method: "POST",
            body: JSON.stringify(item.payload)
          });
        } else if (item.type === "bookmark_delete") {
          await apiFetch("/api/reader/bookmarks", {
            method: "DELETE",
            body: JSON.stringify(item.payload)
          });
        } else if (item.type === "analytics") {
          await apiFetch("/api/reader/analytics", {
            method: "POST",
            body: JSON.stringify({ events: item.payload.events })
          });
        }
      } catch (error) {
        item.retries += 1;
        if (item.retries <= 7) {
          nextQueue.push(item);
        }
      }
    }
    saveQueue(nextQueue);
  }

  function toggleAuthNav() {
    const loggedIn = Boolean(authUser);
    const isOwner = loggedIn && authUser.role === "owner";
    const dashEl = document.getElementById("nav-dashboard");
    if (dashEl) dashEl.style.display = isOwner ? "" : "none";
    const mDashEl = document.getElementById("mobile-nav-dashboard");
    if (mDashEl) mDashEl.style.display = isOwner ? "" : "none";
    const loginEl = document.getElementById("nav-login");
    const signupEl = document.getElementById("nav-signup");
    const profileEl = document.getElementById("nav-profile");
    const logoutEl = document.getElementById("nav-logout");
    const mLoginEl = document.getElementById("mobile-nav-login");
    const mSignupEl = document.getElementById("mobile-nav-signup");
    const mProfileEl = document.getElementById("mobile-nav-profile");
    const mLogoutEl = document.getElementById("mobile-nav-logout");
    [loginEl, signupEl, mLoginEl, mSignupEl].forEach(el => {
      if (el) {
        el.style.display = loggedIn ? "none" : "";
      }
    });
    [profileEl, logoutEl, mProfileEl, mLogoutEl].forEach(el => {
      if (el) {
        el.style.display = loggedIn ? "" : "none";
      }
    });
    if (typeof window.renderUserChip === "function") {
      window.renderUserChip();
    }
    const userName = document.getElementById("user-name");
    if (userName && authConfigMissing && !loggedIn) {
      userName.textContent = "Setup required";
    }
  }

  function getChapterMeta() {
    if (!window.chapters || !window.chapters[window.activeChapter]) {
      return null;
    }
    const chapter = window.chapters[window.activeChapter];
    return {
      novelId: "threadborn",
      volumeId: chapter.volume,
      chapterId: chapter.chapter,
      scrollPosition: Number(window.activePage || 0)
    };
  }

  async function syncProgressNow() {
    if (!authUser) {
      return;
    }
    const payload = getChapterMeta();
    if (!payload) {
      return;
    }
    try {
      await apiFetch("/api/reader/progress", {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      const saveSummary = document.getElementById("reader-save-summary");
      if (saveSummary) {
        saveSummary.textContent = "Synced to account";
      }
    } catch (error) {
      enqueue({ type: "progress", payload });
    }
  }

  function addAnalyticsTick() {
    if (!authUser || readerActiveSince === null) {
      return;
    }
    const payload = getChapterMeta();
    if (!payload) {
      return;
    }
    const now = Date.now();
    const seconds = Math.max(1, Math.round((now - readerActiveSince) / 1000));
    readerActiveSince = now;
    analyticsBuffer.push({
      novelId: payload.novelId,
      volumeId: payload.volumeId,
      chapterId: payload.chapterId,
      timeSpent: seconds
    });
  }

  async function flushAnalytics() {
    if (!analyticsBuffer.length || !authUser) {
      return;
    }
    const events = analyticsBuffer.splice(0, analyticsBuffer.length);
    try {
      await apiFetch("/api/reader/analytics", {
        method: "POST",
        body: JSON.stringify({ events })
      });
    } catch (error) {
      enqueue({ type: "analytics", payload: { events } });
    }
  }

  function renderBookmarkSelect() {
    if (typeof window.mergeServerBookmarks === "function") {
      window.mergeServerBookmarks(bookmarkCache);
      return;
    }
    const select = document.getElementById("bookmark-jump");
    if (!select) {
      return;
    }
    const options = [`<option value="">Select a bookmark</option>`];
    bookmarkCache.forEach(bookmark => {
      const label = bookmark.label || `${bookmark.volume_id} • ${bookmark.chapter_id} • p${Math.floor(bookmark.scroll_position) + 1}`;
      options.push(`<option value="${bookmark.id}">${label}</option>`);
    });
    select.innerHTML = options.join("");
  }

  async function loadBookmarks() {
    if (!authUser) {
      if (typeof window.renderBookmarks === "function") {
        window.renderBookmarks();
      } else {
        bookmarkCache = [];
        renderBookmarkSelect();
      }
      return;
    }
    try {
      const data = await apiFetch("/api/reader/bookmarks?novelId=threadborn");
      bookmarkCache = data.bookmarks || [];
      renderBookmarkSelect();
    } catch (error) {
      // ignore
    }
  }

  window.addBookmarkFromReader = async function addBookmarkFromReader() {
    if (typeof window.createBookmark === "function") {
      window.createBookmark();
      return;
    }
    if (!authUser) {
      return;
    }
    const payload = getChapterMeta();
    if (!payload) {
      return;
    }
    const label = window.prompt("Bookmark label (optional)", "");
    try {
      await apiFetch("/api/reader/bookmarks", {
        method: "POST",
        body: JSON.stringify(Object.assign({}, payload, { label: label || "" }))
      });
      loadBookmarks();
    } catch (error) {
      alert("Could not save bookmark.");
    }
  };

  window.syncBookmarkToAccount = async function syncBookmarkToAccount(bookmark) {
    if (!authUser || !bookmark) {
      return;
    }
    const payload = {
      novelId: "threadborn",
      volumeId: bookmark.volumeId,
      chapterId: bookmark.chapterId,
      scrollPosition: Number(bookmark.pageIndex || 0),
      label: bookmark.label || ""
    };
    try {
      const data = await apiFetch("/api/reader/bookmarks", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (data.bookmark && typeof window.mergeServerBookmarks === "function") {
        window.mergeServerBookmarks([data.bookmark]);
      }
      const status = document.getElementById("bookmark-status");
      if (status) {
        status.textContent = "Bookmark saved and synced.";
      }
    } catch (error) {
      enqueue({ type: "bookmark", payload });
      const status = document.getElementById("bookmark-status");
      if (status) {
        status.textContent = "Bookmark saved locally. Sync queued.";
      }
    }
  };

  window.deleteBookmarkFromAccount = async function deleteBookmarkFromAccount(bookmark) {
    if (!authUser || !bookmark || !bookmark.serverId) {
      return;
    }
    const payload = { id: bookmark.serverId };
    try {
      await apiFetch("/api/reader/bookmarks", {
        method: "DELETE",
        body: JSON.stringify(payload)
      });
    } catch (error) {
      enqueue({ type: "bookmark_delete", payload });
    }
  };

  async function syncLocalBookmarks() {
    if (!authUser || typeof window.readLocalBookmarks !== "function" || typeof window.mergeServerBookmarks !== "function") {
      return;
    }
    const localBookmarks = window.readLocalBookmarks();
    for (const bookmark of localBookmarks) {
      if (bookmark.synced || bookmark.serverId) {
        continue;
      }
      const payload = {
        novelId: "threadborn",
        volumeId: bookmark.volumeId,
        chapterId: bookmark.chapterId,
        scrollPosition: Number(bookmark.pageIndex || 0),
        label: bookmark.label || ""
      };
      try {
        const data = await apiFetch("/api/reader/bookmarks", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        if (data.bookmark) {
          window.mergeServerBookmarks([data.bookmark]);
        }
      } catch (error) {
        enqueue({ type: "bookmark", payload });
      }
    }
  }

  window.jumpToBookmark = function jumpToBookmark(id) {
    if (!id) {
      return;
    }
    const bookmark = bookmarkCache.find(item => item.id === id);
    if (!bookmark || !window.chapters) {
      return;
    }
    const idx = window.chapters.findIndex(ch => ch.volume === bookmark.volume_id && ch.chapter === bookmark.chapter_id);
    if (idx >= 0 && typeof window.openChapter === "function") {
      window.openChapter(idx, Number(bookmark.scroll_position || 0));
    }
  };

  window.logoutUser = async function logoutUser() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch (error) {
      // ignore
    }
    authUser = null;
    csrfToken = "";
    localStorage.removeItem(APP_SESSION_KEY);
    localStorage.removeItem("threadborn_csrf_token");
    localStorage.removeItem("threadborn_user");
    toggleAuthNav();
  };

  async function hydrateAuth() {
    try {
      const data = await apiFetch("/api/auth/me", { method: "GET" });
      authUser = data.user;
      csrfToken = data.csrfToken || "";
      authConfigMissing = false;
      localStorage.setItem("threadborn_user", JSON.stringify({
        id: authUser.id,
        email: authUser.email,
        displayName: authUser.username,
        avatarUrl: authUser.avatarUrl,
        verified: authUser.verified,
        role: authUser.role
      }));
    } catch (error) {
      const isAuthError = error.status === 401 || error.status === 403;
      if (isAuthError) {
        authUser = null;
        csrfToken = "";
        localStorage.removeItem("threadborn_user");
        localStorage.removeItem("threadborn_csrf_token");
        localStorage.removeItem(APP_SESSION_KEY);
      } else {
        try {
          const cachedUser = localStorage.getItem("threadborn_user");
          if (cachedUser) {
            authUser = JSON.parse(cachedUser);
          }
        } catch (e) {}
      }
      authConfigMissing = String(error.message || "").includes("Missing DATABASE_URL");
    }
    toggleAuthNav();
    await syncLocalBookmarks();
    await loadBookmarks();
  }

  async function hydrateServerProgress() {
    if (!authUser || !window.chapters || !window.chapters.length) {
      return;
    }
    try {
      const data = await apiFetch("/api/reader/progress?novelId=threadborn", { method: "GET" });
      if (!data.progress) {
        return;
      }
      const chapterIndex = window.chapters.findIndex(ch =>
        ch.volume === data.progress.volume_id && ch.chapter === data.progress.chapter_id
      );
      if (chapterIndex >= 0) {
        window.activeChapter = chapterIndex;
        window.activePage = Math.max(0, Number(data.progress.scroll_position || 0));
        if (typeof window.updateResumeButton === "function") {
          window.updateResumeButton();
        }
        const saved = {
          chapter: chapterIndex,
          page: window.activePage,
          size: window.readerSize || 18,
          theme: window.readerTheme || "night"
        };
        localStorage.setItem(FALLBACK_PROGRESS_KEY, JSON.stringify(saved));
      }
    } catch (error) {
      // ignore
    }
  }

  function monkeyPatchReaderHooks() {
    if (typeof window.renderPage === "function") {
      const originalRenderPage = window.renderPage;
      window.renderPage = function patchedRenderPage() {
        originalRenderPage.apply(this, arguments);
        syncProgressNow();
      };
    }
    if (typeof window.openChapter === "function") {
      const originalOpenChapter = window.openChapter;
      window.openChapter = function patchedOpenChapter() {
        readerActiveSince = Date.now();
        originalOpenChapter.apply(this, arguments);
      };
    }
    if (typeof window.closeReader === "function") {
      const originalCloseReader = window.closeReader;
      window.closeReader = function patchedCloseReader() {
        addAnalyticsTick();
        flushAnalytics();
        readerActiveSince = null;
        originalCloseReader.apply(this, arguments);
      };
    }
  }

  function startBackgroundSync() {
    if (syncTimer) {
      clearInterval(syncTimer);
    }
    syncTimer = setInterval(() => {
      drainQueue();
      syncProgressNow();
    }, 12_000);
    if (analyticsTimer) {
      clearInterval(analyticsTimer);
    }
    analyticsTimer = setInterval(() => {
      addAnalyticsTick();
      flushAnalytics();
    }, 45_000);
    window.addEventListener("online", drainQueue);
  }

  
  // Dashboard Logic
  window.getDashboardLang = function() {
    const isJp = window.location.pathname.indexOf('-jp') !== -1;
    let baseLang = isJp ? "ja" : "en";
    const select = document.getElementById("dashboard-target-lang");
    if (select) {
      baseLang = select.value;
    }
    return baseLang;
  };

  window.loadDashboardConfig = async function loadDashboardConfig() {
    try {
      const lang = window.getDashboardLang();
      const isJp = window.location.pathname.indexOf('-jp') !== -1;
      const displayLang = isJp ? "ja" : "en";
      
      const data = await apiFetch(`/api/dashboard?action=config&lang=${displayLang}`);
      
      const notifBanner = document.getElementById("global-announcement-banner");
      if (data.notification) {
        notifBanner.innerHTML = `<strong>BiniFn:</strong> ${data.notification}`;
        notifBanner.style.display = "";
      } else {
        if(notifBanner) notifBanner.style.display = "none";
      }

      const cdBanner = document.getElementById("global-countdown-banner");
      if (data.countdown && data.countdown.target_date) {
        document.getElementById("global-countdown-title").textContent = data.countdown.title;
        cdBanner.style.display = "";

        if (window._cdInterval) clearInterval(window._cdInterval);
        window._cdInterval = setInterval(() => {
          const target = new Date(data.countdown.target_date).getTime();
          const now = new Date().getTime();
          const distance = target - now;
          if (distance < 0) {
            document.getElementById("global-countdown-timer").textContent = "RELEASED";
            return;
          }
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((distance % (1000 * 60)) / 1000);
          document.getElementById("global-countdown-timer").textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }, 1000);
      } else {
        if(cdBanner) cdBanner.style.display = "none";
      }

      // If owner dashboard is visible, populate inputs with the selected lang config
      const dashboardView = document.getElementById("view-dashboard");
      if (dashboardView && dashboardView.classList.contains("active")) {
        const ownerData = await apiFetch(`/api/dashboard?action=config&lang=${lang}`);
        const notifInput = document.getElementById("dashboard-announcement");
        if (notifInput) notifInput.value = ownerData.notification || "";
        
        const cdTitleInput = document.getElementById("dashboard-countdown-title");
        const cdDateInput = document.getElementById("dashboard-countdown-date");
        if (cdTitleInput) cdTitleInput.value = (ownerData.countdown && ownerData.countdown.title) || "";
        if (cdDateInput) cdDateInput.value = (ownerData.countdown && ownerData.countdown.target_date) || "";
      }

      loadPolls();
    } catch (e) { }
  };

  window.saveDashboardConfig = async function saveDashboardConfig() {
    try {
      const lang = window.getDashboardLang();
      const notification = document.getElementById("dashboard-announcement").value;
      const title = document.getElementById("dashboard-countdown-title").value;
      const target_date = document.getElementById("dashboard-countdown-date").value;
      
      await apiFetch(`/api/dashboard?action=config&lang=${lang}`, {
        method: "PUT",
        body: JSON.stringify({ notification, countdown: { title, target_date } })
      });
      alert("Dashboard config saved!");
      loadDashboardConfig();
    } catch (e) {
      alert("Failed to save config: " + e.message);
    }
  };

  window.clearDashboardAnnouncement = function() {
    document.getElementById("dashboard-announcement").value = "";
  };

  window.clearDashboardTimer = function() {
    document.getElementById("dashboard-countdown-title").value = "";
    document.getElementById("dashboard-countdown-date").value = "";
  };

  // Polls Logic
  window.loadPolls = async function loadPolls() {
    try {
      const isJp = window.location.pathname.indexOf('-jp') !== -1;
      const displayLang = isJp ? "ja" : "en";
      const data = await apiFetch(`/api/dashboard?action=polls&lang=${displayLang}`);
      
      const container = document.getElementById("global-polls-container");
      if (!container) return;

      let html = "";
      (data.polls || []).forEach(poll => {
        let optsHtml = "";
        const totalVotes = poll.options.reduce((sum, o) => sum + parseInt(o.votes || 0), 0);
        poll.options.forEach(opt => {
          const votedKey = `voted_poll_${poll.id}`;
          const isVoted = localStorage.getItem(votedKey) === String(opt.id);
          const hasVotedAny = !!localStorage.getItem(votedKey);
          const votesCount = parseInt(opt.votes || 0);
          const percent = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
          
          optsHtml += `
            <div class="poll-option ${isVoted ? 'voted' : ''}" onclick="votePoll('${poll.id}', '${opt.id}')" style="${hasVotedAny ? 'cursor:default;' : ''}">
              <div class="poll-bg" style="width: ${hasVotedAny ? percent : 0}%;"></div>
              <span style="position:relative; z-index:1;">${opt.option_text}</span>
              <span class="votes" style="position:relative; z-index:1;">${votesCount} votes ${hasVotedAny ? `(${percent}%)` : ''}</span>
            </div>
          `;
        });
        html += `
          <div class="poll-card" id="poll-${poll.id}">
            <h3><strong>BiniFn:</strong> ${poll.question}</h3>
            <div class="poll-options">
              ${optsHtml}
            </div>
          </div>
        `;
      });
      container.innerHTML = html;

      // Populate dashboard active polls if owner
      const dashList = document.getElementById("dashboard-active-polls-list");
      if (dashList) {
        const lang = window.getDashboardLang();
        const ownerData = await apiFetch(`/api/dashboard?action=polls&lang=${lang}`);
        let dashHtml = "";
        (ownerData.polls || []).forEach(poll => {
          dashHtml += `
            <div style="background:#222; padding:10px; margin-bottom:10px; border-radius:4px; border:1px solid #444;">
              <strong>${poll.question}</strong>
              <div class="poll-admin-controls">
                <button class="btn-clear" onclick="deletePoll('${poll.id}')">Delete Poll</button>
              </div>
            </div>
          `;
        });
        dashList.innerHTML = dashHtml;
      }
    } catch (e) { }
  };

  window.votePoll = async function votePoll(pollId, optionId) {
    const votedKey = `voted_poll_${pollId}`;
    if (localStorage.getItem(votedKey)) return; // Already voted

    try {
      await apiFetch("/api/dashboard?action=polls", {
        method: "POST",
        body: JSON.stringify({ optionId })
      });
      localStorage.setItem(votedKey, optionId);
      loadPolls();
    } catch (e) {
      console.error("Vote failed", e);
    }
  };

  window.createPoll = async function createPoll() {
    try {
      const lang = window.getDashboardLang();
      const question = document.getElementById("dashboard-poll-question").value;
      const optsNodes = document.querySelectorAll(".dashboard-poll-opt");
      const options = Array.from(optsNodes).map(n => n.value).filter(v => v.trim() !== "");

      if (!question || options.length < 2) {
        alert("Please enter a question and at least 2 options.");
        return;
      }

      await apiFetch("/api/dashboard?action=polls", {
        method: "PUT",
        body: JSON.stringify({ question, lang, options })
      });
      
      document.getElementById("dashboard-poll-question").value = "";
      optsNodes.forEach(n => n.value = "");
      alert("Poll created!");
      loadPolls();
    } catch (e) {
      alert("Failed to create poll: " + e.message);
    }
  };

  window.deletePoll = async function deletePoll(pollId) {
    if (!confirm("Are you sure you want to delete this poll?")) return;
    try {
      await apiFetch("/api/dashboard?action=polls", {
        method: "DELETE",
        body: JSON.stringify({ id: pollId })
      });
      alert("Poll deleted.");
      loadPolls();
    } catch (e) {
      alert("Failed to delete poll: " + e.message);
    }
  };
  window.loadDashboardArt = async function loadDashboardArt() {
    try {
      const data = await apiFetch("/api/dashboard?action=art");
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
        await apiFetch("/api/dashboard?action=art", {
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
      await apiFetch("/api/dashboard?action=art", {
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

  window.addEventListener("load", async () => {
    monkeyPatchReaderHooks();
    await hydrateAuth();
    await hydrateServerProgress();
    loadDashboardConfig();
    loadDashboardArt();
    startBackgroundSync();
  });
})();
