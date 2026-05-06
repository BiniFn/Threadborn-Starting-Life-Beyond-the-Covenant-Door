/**
 * Threadborn — Unified Notification System (notifications.js)
 *
 * Single source of truth for ALL notification logic:
 *   • Web Push (VAPID) subscription + unsubscription
 *   • Local scheduled reminders (streak, return-to-app)
 *   • Content-change polling (new chapters, art, community posts)
 *   • In-app notification bell rendering
 *   • Android native bridge notifications
 *   • OS-level Notification API (for web PWA without push)
 *
 * Exposed on window.TB_Notif so every page can call the same API.
 */
(function () {
  "use strict";

  // ─── Constants ────────────────────────────────────────────────────────────
  const STORAGE_KEY_PUSH      = "threadborn_push_enabled";
  const STORAGE_KEY_LAST_SEEN = "threadborn_last_content_seen";
  const STORAGE_KEY_LAST_OPEN = "threadborn_last_opened";
  const STORAGE_KEY_STREAK    = "threadborn_last_streak_notif";
  const POLL_INTERVAL_MS      = 5 * 60 * 1000;  // 5 min content poll
  const STREAK_NUDGE_HOURS    = 20;              // remind after 20h gap
  const RETURN_NUDGE_HOURS    = 48;             // "we miss you" after 48h

  // Content fingerprints tracked across polls
  let _lastChapterCount   = null;
  let _lastArtCount       = null;
  let _lastCommunityCount = null;
  let _lastBadgeCount     = null;

  // In-app notification store (server-side notifications for logged-in users)
  let _notifCache  = [];
  let _notifUnread = 0;

  // Resolved auth user (set by phase1-client via TB_Notif.setUser)
  let _authUser = null;

  // ─── Utility ──────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function relTime(ts) {
    if (!ts) return "";
    const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function apiFetch(path, opts) {
    // Delegate to phase1-client's apiFetch if available; otherwise bare fetch
    if (typeof window.apiFetch === "function") return window.apiFetch(path, opts);
    const base = window.__THREADBORN_API_BASE ||
                 localStorage.getItem("threadborn_api_base") || "";
    return fetch(base + path, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...opts,
    }).then((r) => r.json());
  }

  function isAndroid() {
    return (
      typeof window.AndroidBridge !== "undefined" ||
      document.documentElement.classList.contains("android-app")
    );
  }

  function isJP() {
    return (
      document.documentElement.lang === "ja" ||
      window.location.pathname.includes("index-jp")
    );
  }

  // ─── OS / Native Notification ─────────────────────────────────────────────
  /**
   * Show a native OS notification. Works in:
   *   - Web (Notification API via Service Worker)
   *   - Android (Firebase FCM token is server-side; local SW notification for PWA)
   */
  async function showOsNotification(title, body, opts = {}) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const icon  = opts.icon  || "./assets/threadborn-icon-192.png";
    const badge = opts.badge || "./assets/threadborn-favicon.png";
    const tag   = opts.tag   || "threadborn-general";
    const url   = opts.url   || "./";

    // Prefer showing via service worker so it works when page is hidden
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, {
          body,
          icon,
          badge,
          tag,
          renotify: true,
          vibrate: [120, 60, 120],
          data: { url },
          ...opts.extra,
        });
        return;
      } catch (_) { /* fall through to plain Notification */ }
    }

    try {
      const n = new Notification(title, { body, icon, tag });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (_) {}
  }

  // ─── Streak + Return Nudges (local, no server needed) ─────────────────────
  function scheduleLocalReminders() {
    if (isAndroid()) return; // Android uses FCM; skip local scheduling on app

    // Update last-opened timestamp each visit
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY_LAST_OPEN, String(now));

    if (Notification.permission !== "granted") return;

    // Check if we should send a "keep your streak" nudge
    const lastStreakNotif = parseInt(localStorage.getItem(STORAGE_KEY_STREAK) || "0", 10);
    const hoursSinceStreak = (now - lastStreakNotif) / 3_600_000;

    if (hoursSinceStreak >= STREAK_NUDGE_HOURS) {
      // Schedule a gentle nudge 20 h from now (or fire immediately if they
      // haven't been reminded and they just came back after >20h)
      const lastOpen = parseInt(localStorage.getItem(STORAGE_KEY_LAST_OPEN) || "0", 10);
      const hoursSinceOpen = (now - lastOpen) / 3_600_000;
      if (hoursSinceOpen >= STREAK_NUDGE_HOURS) {
        showOsNotification(
          "🔥 Don't break your Threadborn streak!",
          isJP()
            ? "今日も読みますか？ヨノの旅を続けましょう。"
            : "Yono is waiting. Open a chapter to keep your streak alive.",
          { tag: "threadborn-streak" }
        );
        localStorage.setItem(STORAGE_KEY_STREAK, String(now));
      }
    }

    // Late night reading nudge
    const hour = new Date().getHours();
    if (hour >= 2 && hour <= 4) {
      const lastNightNudge = parseInt(localStorage.getItem("threadborn_night_nudge") || "0", 10);
      if (now - lastNightNudge > 12 * 3600000) {
        showOsNotification(
          isJP() ? "🌙 夜更かしですね" : "🌙 Reading Late?",
          isJP()
            ? "ヨノの旅は逃げません。目を休める時間かもしれません。"
            : "Yono's journey will wait. Don't forget to rest your eyes!",
          { tag: "threadborn-night" }
        );
        localStorage.setItem("threadborn_night_nudge", String(now));
      }
    }
  }

  // Periodic check every hour while the tab is open
  function startStreakPoller() {
    if (isAndroid() || typeof Notification === "undefined") return;
    setInterval(() => {
      if (Notification.permission !== "granted") return;
      scheduleLocalReminders();
    }, 60 * 60 * 1000);
  }

  // ─── Content Polling (new chapters / art / community) ─────────────────────
  async function pollContent() {
    // Only fire notifications for users who have push enabled or granted notif perm
    const canNotify =
      (typeof Notification !== "undefined" && Notification.permission === "granted") ||
      isAndroid();

    try {
      // ── New Chapters ──────────────────────────────────────────────────────
      if (window.chapters && window.chapters.length > 0) {
        const count = window.chapters.length;
        if (_lastChapterCount !== null && count > _lastChapterCount && canNotify) {
          const newest = window.chapters[count - 1];
          showOsNotification(
            isJP() ? "📖 新しい章が追加されました！" : "📖 New Chapter Released!",
            isJP()
              ? `${newest?.title ?? "新章"} が公開されました。今すぐ読もう！`
              : `"${newest?.title ?? "New chapter"}" is now available. Start reading!`,
            { tag: "threadborn-chapter", url: "./" }
          );
          addLocalNotif(
            isJP() ? "新章公開" : "New Chapter",
            isJP()
              ? `${newest?.title ?? "新章"} が公開されました。`
              : `"${newest?.title ?? "New chapter"}" just dropped!`
          );
        }
        _lastChapterCount = count;
      }

      // ── Community / Announcements ──────────────────────────────────────────
      try {
        const comm = await apiFetch("/api/owner/community?action=check");
        const commCount = (comm?.announcements?.length || 0) + (comm?.polls?.length || 0);
        if (_lastCommunityCount !== null && commCount > _lastCommunityCount && canNotify) {
          showOsNotification(
            isJP() ? "📣 新しいコミュニティ投稿" : "📣 New Community Post",
            isJP()
              ? "新しいお知らせやアンケートがあります！チェックしてみよう。"
              : "There's a new announcement or poll waiting for you!",
            { tag: "threadborn-community", url: "./#community" }
          );
          addLocalNotif(
            isJP() ? "コミュニティ更新" : "Community Update",
            isJP() ? "新しいお知らせが届いています。" : "New post in the community section."
          );
        }
        _lastCommunityCount = commCount;
      } catch (_) {}

      // ── Badges / Achievements ──────────────────────────────────────────────
      if (_authUser) {
        try {
          const badgeData = await apiFetch("/api/reader/analytics?action=badges");
          if (badgeData && badgeData.badges) {
            const earnedCount = badgeData.badges.filter(b => b.earned).length;
            if (_lastBadgeCount !== null && earnedCount > _lastBadgeCount && canNotify) {
              const newBadge = badgeData.badges.filter(b => b.earned).pop();
              showOsNotification(
                isJP() ? "🏆 新しいバッジを獲得しました！" : "🏆 New Badge Earned!",
                isJP()
                  ? `「${newBadge?.label || "実績"}」を解除しました。`
                  : `You unlocked the "${newBadge?.label || "Achievement"}" badge!`,
                { tag: "threadborn-badge", url: "./#profile" }
              );
              addLocalNotif(
                isJP() ? "実績解除" : "Achievement Unlocked",
                isJP() ? `「${newBadge?.label || "実績"}」を獲得しました。` : `You earned the "${newBadge?.label || "Achievement"}" badge.`
              );
            }
            _lastBadgeCount = earnedCount;
          }
        } catch (_) {}
      }

      // ── New Art / Drawings ─────────────────────────────────────────────────
      // The drawings data lives in window.drawings if phase1-client has loaded it
      if (Array.isArray(window.drawings)) {
        const artCount = window.drawings.length;
        if (_lastArtCount !== null && artCount > _lastArtCount && canNotify) {
          showOsNotification(
            isJP() ? "🎨 新しいアート公開！" : "🎨 New Art Posted!",
            isJP()
              ? "新しいキャラクターイラストが追加されました。チェックしよう！"
              : "Fresh character artwork just dropped in the Drawings section!",
            { tag: "threadborn-art", url: "./#drawings" }
          );
          addLocalNotif(
            isJP() ? "新アート公開" : "New Artwork",
            isJP() ? "新しいイラストが追加されました。" : "New illustration added to the Drawings tab."
          );
        }
        _lastArtCount = artCount;
      }
    } catch (_) {}
  }

  // ─── In-App Notification Store (local ephemeral, no login needed) ─────────
  const _localNotifs = [];

  function addLocalNotif(title, body) {
    _localNotifs.unshift({ id: `local-${Date.now()}`, title, body, read: false, created_at: new Date().toISOString() });
    if (_localNotifs.length > 30) _localNotifs.pop();
    _notifUnread++;
    renderNotifBell();
    renderNotifDropdown();
  }

  // ─── Bell + Dropdown Rendering ────────────────────────────────────────────
  function renderNotifBell() {
    const bell  = document.getElementById("notif-bell");
    const badge = document.getElementById("notif-badge");
    if (!bell) return;
    // Show bell if: logged in OR has local unread notifs
    bell.style.display = (_authUser || _notifUnread > 0) ? "" : "none";
    if (badge) {
      const total = _notifUnread;
      badge.textContent   = total > 9 ? "9+" : total || "";
      badge.style.display = total > 0 ? "" : "none";
    }
  }

  function renderNotifDropdown() {
    const list = document.getElementById("notif-list");
    if (!list) return;

    const combined = [
      ..._localNotifs,
      ..._notifCache.filter(
        (n) => !_localNotifs.find((l) => l.id === n.id)
      ),
    ];

    if (!combined.length) {
      list.innerHTML = `<div class="notif-empty" style="padding:16px;color:var(--mist);font-size:13px;text-align:center;">${isJP() ? "通知はありません。" : "No notifications yet."}</div>`;
      return;
    }

    list.innerHTML = combined
      .map(
        (n) => `
      <div class="notif-item ${n.read ? "" : "unread"}"
           onclick="window.TB_Notif.markRead('${escHtml(n.id)}')"
           style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:pointer;transition:background 0.15s;">
        <div class="notif-title" style="font-size:13px;font-weight:700;color:var(--bone);margin-bottom:3px;">${escHtml(n.title)}</div>
        <div class="notif-body" style="font-size:12px;color:var(--mist);line-height:1.5;">${escHtml(n.body || "")}</div>
        <div class="notif-time" style="font-size:11px;color:rgba(175,160,149,0.6);margin-top:4px;">${relTime(n.created_at)}</div>
      </div>`
      )
      .join("");
  }

  // ─── Server-side Notification Fetch (logged-in users) ─────────────────────
  async function loadServerNotifications() {
    if (!_authUser) return;
    try {
      const data = await apiFetch("/api/user/profile?action=notifications");
      _notifCache  = data.notifications || [];
      _notifUnread = (data.unread || 0) + _localNotifs.filter((n) => !n.read).length;
      renderNotifBell();
      renderNotifDropdown();
    } catch (_) {}
  }

  // ─── Push Subscription (Web VAPID) ────────────────────────────────────────
  function base64ToUint8(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
  }

  async function requestPushPermission() {
    const btn = document.getElementById("push-enable-btn");

    // Android — permission is handled natively, just show a toast
    if (isAndroid()) {
      if (typeof window.AndroidBridge?.syncDataStore === "function") {
        window.AndroidBridge.syncDataStore(JSON.stringify({ pushRequested: true }));
      }
      if (btn) {
        btn.innerHTML = "🔔 <span class='push-label'>Notifications On</span>";
        btn.classList.add("push-active");
      }
      localStorage.setItem(STORAGE_KEY_PUSH, "1");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // Fallback: try plain Notification API
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          localStorage.setItem(STORAGE_KEY_PUSH, "1");
          updatePushButtonState();
          scheduleLocalReminders();
          showOsNotification(
            isJP() ? "✅ 通知が有効になりました" : "✅ Notifications Enabled",
            isJP()
              ? "新章、アート、コミュニティ更新をお知らせします！"
              : "You'll be notified of new chapters, art, and community updates!"
          );
        }
      } else {
        if (btn) btn.innerHTML = "🔔 <span class='push-label'>Not Supported</span>";
      }
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = "⏳ <span class='push-label'>Requesting…</span>"; }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (btn) { btn.disabled = false; updatePushButtonState(); }
        return;
      }

      // Show immediate welcome notification
      await showOsNotification(
        isJP() ? "✅ 通知が有効になりました！" : "✅ Notifications Enabled!",
        isJP()
          ? "新章、コミュニティ更新、新アート、リーディングストリークのリマインダーをお知らせします。"
          : "You'll get alerts for new chapters, community posts, new art, and streak reminders.",
        { tag: "threadborn-welcome" }
      );

      // Try VAPID push subscription
      try {
        const { publicKey } = await apiFetch("/api/user/profile?action=push-vapid");
        if (publicKey) {
          const reg = await navigator.serviceWorker.ready;
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: base64ToUint8(publicKey),
            });
          }
          await apiFetch("/api/user/profile?action=push-subscribe", {
            method: "POST",
            body: JSON.stringify({
              endpoint: sub.endpoint,
              p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")))),
              auth:   btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")))),
            }),
          });
        }
      } catch (_) { /* VAPID optional — local notifications still work */ }

      localStorage.setItem(STORAGE_KEY_PUSH, "1");
      updatePushButtonState();
    } catch (e) {
      console.error("[TB_Notif] push request failed:", e);
      if (btn) { btn.disabled = false; updatePushButtonState(); }
    }
  }

  async function disablePushNotifications() {
    try {
      if ("serviceWorker" in navigator && "PushManager" in window) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await apiFetch("/api/user/profile?action=push-unsubscribe", {
            method: "POST",
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe();
        }
      }
    } catch (_) {}
    localStorage.removeItem(STORAGE_KEY_PUSH);
    updatePushButtonState();
  }

  function updatePushButtonState() {
    const btn = document.getElementById("push-enable-btn");
    if (!btn) return;
    const enabled =
      localStorage.getItem(STORAGE_KEY_PUSH) === "1" &&
      (typeof Notification === "undefined" || Notification.permission === "granted" || isAndroid());

    if (enabled) {
      btn.innerHTML    = "🔔 <span class='push-label'>Notifications On</span>";
      btn.classList.add("push-active");
      btn.onclick      = disablePushNotifications;
    } else {
      btn.innerHTML    = "🔔 <span class='push-label'>Enable Notifications</span>";
      btn.classList.remove("push-active");
      btn.onclick      = requestPushPermission;
    }
    btn.disabled = false;
  }

  // ─── Notification Panel Toggle ────────────────────────────────────────────
  function toggleNotifPanel() {
    const panel = document.getElementById("notif-panel");
    if (!panel) return;
    const open = panel.style.display !== "none" && panel.style.display !== "";
    panel.style.display = open ? "none" : "block";
    if (!open) {
      // Mark all server notifications read
      _notifUnread = _localNotifs.filter((n) => !n.read).length;
      _localNotifs.forEach((n) => { n.read = true; });
      renderNotifBell();
      renderNotifDropdown();
      if (_authUser) {
        apiFetch("/api/user/profile?action=notifications", {
          method: "POST",
          body: JSON.stringify({ markAllRead: true }),
        }).catch(() => {});
      }
    }
  }

  function markRead(id) {
    const local = _localNotifs.find((n) => n.id === id);
    if (local && !local.read) {
      local.read = true;
      _notifUnread = Math.max(0, _notifUnread - 1);
    }
    const server = _notifCache.find((n) => n.id === id);
    if (server && !server.read) {
      server.read = true;
      _notifUnread = Math.max(0, _notifUnread - 1);
      apiFetch("/api/user/profile?action=notifications", {
        method: "POST",
        body: JSON.stringify({ id }),
      }).catch(() => {});
    }
    renderNotifBell();
    renderNotifDropdown();
  }

  // ─── Scheduled "Return to App" Push (local SW alarm) ─────────────────────
  /**
   * Uses the Page Visibility API to detect when the user leaves and hasn't
   * returned. If push permission is granted and they've been away 48 h, we
   * show a gentle re-engagement notification next time the SW fires.
   *
   * On web, we store a localStorage timestamp; on next visit we check it.
   */
  function checkReturnNudge() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const lastOpen = parseInt(localStorage.getItem(STORAGE_KEY_LAST_OPEN) || "0", 10);
    const hoursSince = (Date.now() - lastOpen) / 3_600_000;

    if (hoursSince >= RETURN_NUDGE_HOURS && lastOpen > 0) {
      showOsNotification(
        isJP() ? "📚 また戻ってきてね、スレッドボーン！" : "📚 We miss you, Threadborn reader!",
        isJP()
          ? "ヨノの物語はまだ続いています。今日も読んでみませんか？"
          : "Yono's story is still unfolding. Come back and catch up!",
        { tag: "threadborn-return" }
      );
    }
  }

  // ─── Initialisation ───────────────────────────────────────────────────────
  function init(authUser) {
    _authUser = authUser || null;

    // Show push button if browser supports it
    const pushBtn = document.getElementById("push-enable-btn");
    if (pushBtn) {
      const supported =
        isAndroid() ||
        ("Notification" in window &&
          ("serviceWorker" in navigator || "PushManager" in window));
      pushBtn.style.display = supported ? "" : "none";
      updatePushButtonState();
    }

    // Wire bell
    renderNotifBell();
    renderNotifDropdown();

    // Check return nudge on first load
    checkReturnNudge();

    // Update last-opened
    localStorage.setItem(STORAGE_KEY_LAST_OPEN, String(Date.now()));

    // Local streak reminders
    scheduleLocalReminders();
    startStreakPoller();

    // Content polling
    pollContent();
    setInterval(pollContent, POLL_INTERVAL_MS);

    // Server notifications for logged-in users
    if (_authUser) {
      loadServerNotifications();
      setInterval(() => {
        if (_authUser) loadServerNotifications();
      }, 90_000);
    }

    // Re-subscribe push on load if previously active
    if (
      !isAndroid() &&
      localStorage.getItem(STORAGE_KEY_PUSH) === "1" &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      "serviceWorker" in navigator &&
      "PushManager" in window
    ) {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          const sub = await reg.pushManager.getSubscription();
          if (!sub) {
            // Subscription lapsed — clear flag
            localStorage.removeItem(STORAGE_KEY_PUSH);
            updatePushButtonState();
          }
        })
        .catch(() => {});
    }

    // Network status monitoring
    window.addEventListener("offline", () => {
      addLocalNotif(
        isJP() ? "📶 オフライン" : "📶 Offline Mode",
        isJP()
          ? "ネットワーク接続が切れました。キャッシュされた章は引き続き読めます。"
          : "You lost connection. Cached chapters are still available to read offline."
      );
    });

    window.addEventListener("online", () => {
      addLocalNotif(
        isJP() ? "🌐 オンライン" : "🌐 Back Online",
        isJP()
          ? "接続が回復しました。最新の進捗が同期されます。"
          : "Connection restored. Your reading progress will now sync."
      );
      if (_authUser) loadServerNotifications();
    });

    // Close panel on outside click
    document.addEventListener("click", (e) => {
      const panel = document.getElementById("notif-panel");
      const bell  = document.getElementById("notif-bell");
      if (panel && bell && !bell.contains(e.target) && !panel.contains(e.target)) {
        panel.style.display = "none";
      }
    });
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.TB_Notif = {
    init,
    setUser: (u) => { _authUser = u; },

    // Push
    requestPushPermission,
    disablePushNotifications,
    updatePushButtonState,

    // Panel
    toggleNotifPanel,
    markRead,

    // Manual triggers (useful for admin / chapter release hooks)
    notify: showOsNotification,
    addLocalNotif,

    // Internals exposed for phase1-client compatibility
    loadServerNotifications,
    renderNotifBell,
    renderNotifDropdown,
    pollContent,
  };

  // ─── Backwards-compat shims (phase1-client calls these by name) ───────────
  window.requestPushPermission    = requestPushPermission;
  window.disablePushNotifications = disablePushNotifications;
  window.toggleNotifPanel         = toggleNotifPanel;
  window.markNotifRead            = markRead;
  window.loadNotifications        = loadServerNotifications;

  // Auto-init once DOM is ready (will be re-called with authUser by phase1-client)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(null));
  } else {
    init(null);
  }
})();
