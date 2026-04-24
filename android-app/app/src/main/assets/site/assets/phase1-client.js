(function () {
  const API_BASE = (window.__THREADBORN_API_BASE || localStorage.getItem("threadborn_api_base") || "").replace(/\/$/, "");
  const QUEUE_KEY = "threadborn_sync_queue_v1";
  const FALLBACK_PROGRESS_KEY = "novelverse_reader_progress";
  let csrfToken = "";
  let authUser = null;
  let bookmarkCache = [];
  let analyticsBuffer = [];
  let analyticsTimer = null;
  let syncTimer = null;
  let readerActiveSince = null;

  function apiPath(path) {
    return `${API_BASE}${path}`;
  }

  async function apiFetch(path, options = {}) {
    const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }
    const response = await fetch(apiPath(path), Object.assign({}, options, {
      credentials: "include",
      headers
    }));
    let payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = { success: false, error: "Invalid response" };
    }
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || "Request failed");
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
      bookmarkCache = [];
      renderBookmarkSelect();
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
    if (!authUser) {
      alert("Login first to sync bookmarks.");
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
    toggleAuthNav();
  };

  async function hydrateAuth() {
    try {
      const data = await apiFetch("/api/auth/me", { method: "GET" });
      authUser = data.user;
      csrfToken = data.csrfToken || "";
      localStorage.setItem("threadborn_user", JSON.stringify({
        id: authUser.id,
        email: authUser.email,
        displayName: authUser.username,
        avatarUrl: authUser.avatarUrl,
        verified: authUser.verified,
        role: authUser.role
      }));
    } catch (error) {
      authUser = null;
      csrfToken = "";
    }
    toggleAuthNav();
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

  window.addEventListener("load", async () => {
    monkeyPatchReaderHooks();
    await hydrateAuth();
    await hydrateServerProgress();
    startBackgroundSync();
  });
})();
