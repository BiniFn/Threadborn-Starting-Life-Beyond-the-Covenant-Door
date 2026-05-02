const webpush = require("web-push");

function isConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@threadborn.vercel.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Send a push notification to all subscriptions for a user.
 * Automatically removes expired/invalid subscriptions (HTTP 410/404).
 */
async function sendPushToUser(pool, userId, payload) {
  if (!isConfigured()) return;
  configure();

  const { rows } = await pool.query(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
    [userId]
  );
  if (!rows.length) return;

  const results = await Promise.allSettled(
    rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title || "Threadborn",
          body: payload.body || "",
          icon: "/assets/threadborn-icon-192.png",
          badge: "/assets/threadborn-favicon.png",
          tag: payload.tag || "threadborn",
          url: payload.url || "/",
        })
      )
    )
  );

  // Clean up expired subscriptions
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "rejected") {
      const code = results[i].reason?.statusCode;
      if (code === 410 || code === 404) {
        pool
          .query("DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2", [
            userId,
            rows[i].endpoint,
          ])
          .catch(() => {});
      }
    }
  }
}

/**
 * Send a push notification to ALL subscribed users (e.g. announcements).
 * Use sparingly — iterates all subscriptions.
 */
async function sendPushBroadcast(pool, payload, limit = 500) {
  if (!isConfigured()) return;
  configure();

  const { rows } = await pool.query(
    "SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions LIMIT $1",
    [limit]
  );
  if (!rows.length) return;

  await Promise.allSettled(
    rows.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title || "Threadborn",
          body: payload.body || "",
          icon: "/assets/threadborn-icon-192.png",
          badge: "/assets/threadborn-favicon.png",
          tag: payload.tag || "threadborn-broadcast",
          url: payload.url || "/",
        })
      )
    )
  );
}

module.exports = { sendPushToUser, sendPushBroadcast, isConfigured };
