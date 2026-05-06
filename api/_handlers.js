const { put, del } = require("@vercel/blob");
const pool = require("../lib/api/db");
const { allowCors, success, fail } = require("../lib/api/http");
const { parseJsonBody, getClientIp } = require("../lib/api/request");
const { takeRateLimitToken } = require("../lib/api/rate-limit");
const {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  makeCookie,
  getSessionCookieOptions,
  makePasswordHash,
  verifyPassword,
  createSession,
  destroySession,
  getSession,
  requireSession,
  validateCsrf,
  shouldExposeSessionToken,
} = require("../lib/api/auth");
const { sendPushToUser, sendPushBroadcast } = require("../lib/api/push");

exports.handleLogin = (() => {






function authPayload(user, session, req) {
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatar_url || "",
      verified: user.verified,
      role: user.role,
    },
    csrfToken: session.csrfToken,
  };
  if (shouldExposeSessionToken(req)) {
    payload.sessionToken = session.token;
  }
  return payload;
}

return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`login:${getClientIp(req)}`, 20, 60_000)) {
    fail(res, 429, "Too many attempts, please retry shortly");
    return;
  }
  if (!process.env.DATABASE_URL) {
    fail(res, 503, "Missing DATABASE_URL environment variable");
    return;
  }

  try {
    await pool.ensureMigrations();
    const body = await parseJsonBody(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      fail(res, 400, "Email and password are required");
      return;
    }

    if (
      process.env.OWNER_EMAIL &&
      process.env.OWNER_PASSWORD &&
      email === process.env.OWNER_EMAIL.trim().toLowerCase()
    ) {
      const existing = await pool.query(
        "select id from users where role = 'owner'::user_role limit 1",
      );
      if (!existing.rows.length) {
        const ownerUsername =
          email
            .split("@")[0]
            .replace(/[^a-zA-Z0-9_]/g, "_")
            .slice(0, 24) || "owner";
        const emailConflict = await pool.query(
          "select role from users where lower(email) = $1 limit 1",
          [email],
        );
        if (!emailConflict.rows.length) {
          await pool.query(
            `insert into users (email, username, password_hash, role, verified, updated_at)
             values ($1, $2, $3, 'owner'::user_role, true, now())`,
            [
              email,
              ownerUsername,
              makePasswordHash(process.env.OWNER_PASSWORD),
            ],
          );
        } else if (emailConflict.rows[0].role !== "owner") {
          fail(
            res,
            409,
            "Owner e-mail is already registered to another account",
          );
          return;
        }
      }
    }

    const { rows } = await pool.query(
      "select id, email, username, password_hash, avatar_url, verified, role from users where lower(email)= $1 limit 1",
      [email],
    );
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      fail(res, 401, "Invalid credentials");
      return;
    }

    const user = rows[0];
    const session = await createSession(user.id);
    res.setHeader(
      "Set-Cookie",
      makeCookie(
        SESSION_COOKIE,
        session.token,
        Math.floor(SESSION_TTL_MS / 1000),
        getSessionCookieOptions(req),
      ),
    );
    success(res, authPayload(user, session, req));
  } catch (error) {
    fail(res, 500, "Login failed");
  }
};

})();

exports.handleLogout = (() => {





return async (req, res) => {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`logout:${getClientIp(req)}`, 10, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  // Clear cookie immediately — do this before the DB call so the user
  // is always logged out in the browser even if the DB is unavailable
  res.setHeader(
    "Set-Cookie",
    makeCookie(
      SESSION_COOKIE,
      "",
      0,
      getSessionCookieOptions(req, { clear: true }),
    ),
  );
  try {
    await destroySession(req, res);
  } catch (error) {
    // Cookie is already cleared — log but don't surface to client
    console.error("[logout] DB delete failed:", error);
  }
  success(res, { loggedOut: true });
};

})();

exports.handleMe = (() => {





return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "GET") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`me:${getClientIp(req)}`, 60, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  try {
    const session = await getSession(req);
    if (!session) {
      fail(res, 401, "Unauthorized");
      return;
    }
    success(res, {
      user: {
        id: session.user_id,
        email: session.email,
        username: session.username,
        avatarUrl: session.avatar_url || "",
        verified: session.verified,
        role: session.role,
      },
      csrfToken: session.csrf_token,
    });
  } catch (error) {
    fail(res, 500, "Service unavailable");
  }
};

})();

exports.handleSignup = (() => {






function validUsername(value) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(value);
}

function authPayload(user, session, req) {
  const payload = {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatar_url || "",
      verified: user.verified,
      role: user.role,
    },
    csrfToken: session.csrfToken,
  };
  if (shouldExposeSessionToken(req)) {
    payload.sessionToken = session.token;
  }
  return payload;
}

return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`signup:${getClientIp(req)}`, 10, 60_000)) {
    fail(res, 429, "Too many signup attempts");
    return;
  }
  if (!process.env.DATABASE_URL) {
    fail(res, 503, "Missing DATABASE_URL environment variable");
    return;
  }

  try {
    await pool.ensureMigrations();
    const body = await parseJsonBody(req);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    let avatarUrl = null;
    const rawAvatarUrl = String(body.avatarUrl || "").trim();
    if (rawAvatarUrl) {
      try {
        const parsed = new URL(rawAvatarUrl);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          avatarUrl = parsed.href;
        }
      } catch (e) {
        /* invalid URL — ignore */
      }
    }

    if (!email || !password || !username) {
      fail(res, 400, "Email, username and password are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail(res, 400, "Invalid email address");
      return;
    }
    if (!validUsername(username)) {
      fail(
        res,
        400,
        "Username must be 3-24 chars (letters, numbers, underscore)",
      );
      return;
    }
    if (password.length < 8) {
      fail(res, 400, "Password must be at least 8 characters");
      return;
    }
    if (password.length > 1024) {
      fail(res, 400, "Password too long (max 1024 characters)");
      return;
    }

    const duplicate = await pool.query(
      "select id from users where lower(email) = $1 or lower(username) = lower($2) limit 1",
      [email, username],
    );
    if (duplicate.rows.length) {
      fail(res, 409, "Email or username is already in use");
      return;
    }

    const passwordHash = makePasswordHash(password);
    const { rows } = await pool.query(
      "insert into users (email, username, password_hash, avatar_url, role, verified, updated_at) values ($1,$2,$3,$4,'user',false,now()) returning id, email, username, avatar_url, verified, role",
      [email, username, passwordHash, avatarUrl],
    );

    const user = rows[0];
    const session = await createSession(user.id);
    res.setHeader(
      "Set-Cookie",
      makeCookie(
        SESSION_COOKIE,
        session.token,
        Math.floor(SESSION_TTL_MS / 1000),
        getSessionCookieOptions(req),
      ),
    );
    success(res, authPayload(user, session, req), 201);
  } catch (error) {
    if (
      String(error.code) === "23505" ||
      String(error.message || "").includes("duplicate")
    ) {
      fail(res, 409, "Email or username is already in use");
      return;
    }
    fail(res, 500, "Signup failed");
  }
};

})();

exports.handleAnalytics = (() => {







// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGES = {
  first_chapter: {
    label: "First Steps",
    icon: "📖",
    desc: "Read your first chapter",
  },
  volume1_complete: {
    label: "Volume I Complete",
    icon: "⚔️",
    desc: "Finished Volume 1",
  },
  volume2_started: {
    label: "Into the Door",
    icon: "🚪",
    desc: "Started Volume 2",
  },
  ex_reader: { label: "Lore Seeker", icon: "📜", desc: "Read the EX Novel" },
  streak_3: { label: "3-Day Streak", icon: "🔥", desc: "Read 3 days in a row" },
  streak_7: { label: "Week Warrior", icon: "🗡️", desc: "Read 7 days in a row" },
  streak_30: {
    label: "Devoted Reader",
    icon: "👑",
    desc: "Read 30 days in a row",
  },
  bookmarker: {
    label: "Bookmarker",
    icon: "🔖",
    desc: "Created your first bookmark",
  },
  reactor: {
    label: "First Reaction",
    icon: "❤️",
    desc: "Left your first reaction",
  },
  commenter: {
    label: "Community Voice",
    icon: "💬",
    desc: "Posted in the community",
  },
  all_volumes: {
    label: "Chronicle Complete",
    icon: "🌟",
    desc: "Read all available volumes",
  },
};

return async (req, res) => {
  if (allowCors(req, res)) return;

  const action = req.query?.action || "";

  // ── Badges + Streaks ────────────────────────────────────────────────────────
  if (action === "badges") {
    if (!takeRateLimitToken(`badges:${getClientIp(req)}`, 30, 60_000))
      return fail(res, 429, "Too many requests");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      if (req.method === "GET") {
        const [br, sr] = await Promise.all([
          pool.query(
            "SELECT badge_key, earned_at FROM reader_badges WHERE user_id=$1 ORDER BY earned_at DESC",
            [session.user_id],
          ),
          pool.query(
            "SELECT current_streak, longest_streak, last_read_date, total_days_read FROM reader_streaks WHERE user_id=$1",
            [session.user_id],
          ),
        ]);
        const earned = new Set(br.rows.map((r) => r.badge_key));
        const badges = Object.entries(BADGES).map(([key, meta]) => ({
          key,
          ...meta,
          earned: earned.has(key),
          earned_at:
            br.rows.find((r) => r.badge_key === key)?.earned_at || null,
        }));
        const streak = sr.rows[0] || {
          current_streak: 0,
          longest_streak: 0,
          last_read_date: null,
          total_days_read: 0,
        };
        return success(res, { badges, streak });
      }
      if (req.method === "POST") {
        const body = await parseJsonBody(req);
        const { activity } = body;
        if (!activity) return fail(res, 400, "Missing activity");
        const today = new Date().toISOString().slice(0, 10);
        const sr = await pool.query(
          "SELECT * FROM reader_streaks WHERE user_id=$1",
          [session.user_id],
        );
        let cs = 1,
          ls = 1,
          td = 1;
        if (sr.rows.length) {
          const s = sr.rows[0];
          const last = s.last_read_date
            ? new Date(s.last_read_date).toISOString().slice(0, 10)
            : null;
          if (last === today) {
            cs = s.current_streak;
            ls = s.longest_streak;
            td = s.total_days_read;
          } else {
            const yest = new Date(Date.now() - 86400000)
              .toISOString()
              .slice(0, 10);
            cs = last === yest ? s.current_streak + 1 : 1;
            ls = Math.max(s.longest_streak, cs);
            td = s.total_days_read + 1;
          }
        }
        await pool.query(
          `INSERT INTO reader_streaks (user_id,current_streak,longest_streak,last_read_date,total_days_read,updated_at)
           VALUES ($1,$2,$3,$4,$5,now())
           ON CONFLICT (user_id) DO UPDATE SET
             current_streak=$2, longest_streak=$3, last_read_date=$4, total_days_read=$5, updated_at=now()`,
          [session.user_id, cs, ls, today, td],
        );
        const toAward = [];
        if (activity === "chapter_read") toAward.push("first_chapter");
        if (activity === "volume1_complete") toAward.push("volume1_complete");
        if (activity === "volume2_started") toAward.push("volume2_started");
        if (activity === "ex_read") toAward.push("ex_reader");
        if (activity === "bookmark_created") toAward.push("bookmarker");
        if (activity === "reaction_posted") toAward.push("reactor");
        if (activity === "community_post") toAward.push("commenter");
        if (activity === "all_volumes") toAward.push("all_volumes");
        if (cs >= 3) toAward.push("streak_3");
        if (cs >= 7) toAward.push("streak_7");
        if (cs >= 30) toAward.push("streak_30");
        const newBadges = [];
        for (const key of toAward) {
          try {
            const result = await pool.query(
              "INSERT INTO reader_badges (user_id,badge_key) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING badge_key",
              [session.user_id, key],
            );
            if (result.rowCount > 0) {
              newBadges.push({ key, ...BADGES[key] });
              // Create in-app notification for the newly earned badge
              pool
                .query(
                  "INSERT INTO notifications (user_id,type,title,body) VALUES ($1,'badge',$2,$3)",
                  [
                    session.user_id,
                    `🏅 Badge Earned: ${BADGES[key].label}`,
                    BADGES[key].desc,
                  ],
                )
                .catch(() => {});
              // Send OS-level push notification
              sendPushToUser(pool, session.user_id, {
                title: `🏅 ${BADGES[key].label}`,
                body: BADGES[key].desc,
                tag: `badge-${key}`,
                url: "/?view=stats",
              }).catch(() => {});
            }
          } catch (_) {}
        }
        return success(res, {
          newBadges,
          streak: {
            current_streak: cs,
            longest_streak: ls,
            total_days_read: td,
          },
        });
      }
      return fail(res, 405, "Method not allowed");
    } catch (error) {
      return fail(res, 500, "Badges unavailable");
    }
  }

  // ── Reading Analytics (original handler) ────────────────────────────────────
  if (!takeRateLimitToken(`analytics:${getClientIp(req)}`, 30, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const { rows } = await pool.query(
      `select volume_id, sum(time_spent)::int as total_time, max(last_read_at) as last_read_at
       from reading_analytics
       where user_id = $1
       group by volume_id
       order by total_time desc`,
      [session.user_id],
    );
    success(res, { volumes: rows });
    return;
  }

  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!validateCsrf(req, session)) {
    fail(res, 403, "Invalid CSRF token");
    return;
  }
  const body = await parseJsonBody(req);
  const events = Array.isArray(body.events) ? body.events.slice(0, 50) : [];
  let accepted = 0;
  try {
    for (const event of events) {
      const novelId = String(event.novelId || "threadborn");
      const volumeId = String(event.volumeId || "");
      const chapterId = String(event.chapterId || "");
      const timeSpent = Math.max(
        0,
        Math.min(3600, Number(event.timeSpent || 0)),
      );
      if (!volumeId || !chapterId || timeSpent <= 0) {
        continue;
      }
      await pool.query(
        `insert into reading_analytics (user_id, novel_id, volume_id, chapter_id, time_spent, last_read_at, created_at, updated_at)
         values ($1,$2,$3,$4,$5,now(),now(),now())
         on conflict (user_id, novel_id, volume_id, chapter_id)
         do update set
           time_spent = reading_analytics.time_spent + excluded.time_spent,
           last_read_at = now(),
           updated_at = now()`,
        [session.user_id, novelId, volumeId, chapterId, timeSpent],
      );
      accepted++;
    }
    success(res, { accepted });
  } catch (error) {
    fail(res, 500, "Analytics unavailable");
  }
};

})();

exports.handleBookmarks = (() => {






return async (req, res) => {
  if (allowCors(req, res)) return;

  const action = req.query?.action || "";

  // ── Follows ─────────────────────────────────────────────────────────────────
  if (action === "follows") {
    if (!takeRateLimitToken(`follows:${getClientIp(req)}`, 30, 60_000))
      return fail(res, 429, "Too many requests");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      if (req.method === "GET") {
        const { rows } = await pool.query(
          "SELECT follow_type, follow_key, created_at FROM reader_follows WHERE user_id=$1 ORDER BY created_at DESC",
          [session.user_id],
        );
        return success(res, { follows: rows });
      }
      if (!validateCsrf(req, session))
        return fail(res, 403, "Invalid CSRF token");
      const body = await parseJsonBody(req);
      const followType = String(body.follow_type || "").trim();
      const followKey = String(body.follow_key || "").trim();
      if (!followType || !followKey)
        return fail(res, 400, "follow_type and follow_key required");
      if (!["character", "volume", "arc", "tag"].includes(followType))
        return fail(res, 400, "Invalid follow_type");
      if (req.method === "POST") {
        await pool.query(
          "INSERT INTO reader_follows (user_id,follow_type,follow_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [session.user_id, followType, followKey],
        );
        return success(res, { followed: true });
      }
      if (req.method === "DELETE") {
        await pool.query(
          "DELETE FROM reader_follows WHERE user_id=$1 AND follow_type=$2 AND follow_key=$3",
          [session.user_id, followType, followKey],
        );
        return success(res, { unfollowed: true });
      }
      return fail(res, 405, "Method not allowed");
    } catch (error) {
      return fail(res, 500, "Follows unavailable");
    }
  }

  // ── Bookmarks (original handler) ─────────────────────────────────────────────
  try {
    if (!takeRateLimitToken(`bookmarks:${getClientIp(req)}`, 60, 60_000)) {
      fail(res, 429, "Too many requests");
      return;
    }
    const session = await requireSession(req, res, fail);
    if (!session) {
      return;
    }

    if (req.method === "GET") {
      const novelId = String(req.query?.novelId || "threadborn");
      const { rows } = await pool.query(
        "select id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at from bookmarks where user_id = $1 and novel_id = $2 order by created_at desc",
        [session.user_id, novelId],
      );
      success(res, { bookmarks: rows });
      return;
    }

    if (req.method === "POST") {
      if (!validateCsrf(req, session)) {
        fail(res, 403, "Invalid CSRF token");
        return;
      }
      const body = await parseJsonBody(req);
      const novelId = String(body.novelId || "threadborn");
      const volumeId = String(body.volumeId || "");
      const chapterId = String(body.chapterId || "");
      const label = String(body.label || "").slice(0, 90);
      const scrollPosition = Math.max(0, Number(body.scrollPosition || 0));
      if (!volumeId || !chapterId) {
        fail(res, 400, "volumeId and chapterId are required");
        return;
      }
      const countResult = await pool.query(
        "select count(*) from bookmarks where user_id = $1",
        [session.user_id],
      );
      if (parseInt(countResult.rows[0].count) >= 500) {
        fail(res, 409, "Bookmark limit reached (max 500)");
        return;
      }
      const { rows } = await pool.query(
        `insert into bookmarks (user_id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,now(),now())
       returning id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at`,
        [
          session.user_id,
          novelId,
          volumeId,
          chapterId,
          scrollPosition,
          label || null,
        ],
      );
      success(res, { bookmark: rows[0] }, 201);
      return;
    }

    if (req.method === "DELETE") {
      if (!validateCsrf(req, session)) {
        fail(res, 403, "Invalid CSRF token");
        return;
      }
      const body = await parseJsonBody(req);
      const id = String(body.id || "");
      if (!id) {
        fail(res, 400, "id is required");
        return;
      }
      await pool.query("delete from bookmarks where id = $1 and user_id = $2", [
        id,
        session.user_id,
      ]);
      success(res, { deleted: true });
      return;
    }

    fail(res, 405, "Method not allowed");
  } catch (error) {
    fail(res, 500, "Bookmarks unavailable");
  }
};

})();

exports.handleCommunity = (() => {






function cleanText(value, max = 2000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (!takeRateLimitToken(`community:${getClientIp(req)}`, 30, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }
  await pool.ensureMigrations();

  const meResult = await pool.query(
    "select role, coalesce(verified, false) as verified, community_banned_until, community_ban_reason from users where id = $1 limit 1",
    [session.user_id],
  );
  const me = meResult.rows[0] || null;
  const isModerator = !!me && (me.role === "owner" || me.role === "admin");
  const isCommunityBanned = !!(
    me &&
    me.community_banned_until &&
    new Date(me.community_banned_until).getTime() > Date.now()
  );

  if (req.method === "GET") {
    const limit = Math.max(1, Math.min(30, Number(req.query?.limit || 12)));
    const offset = Math.max(0, Number(req.query?.offset || 0));
    const postsResult = await pool.query(
      `
      select
        p.id, p.user_id, p.title, p.content, p.image_url, p.category, p.created_at,
        u.username, u.avatar_url, u.verified, u.role,
        coalesce(l.like_count, 0)::int as like_count,
        coalesce(c.comment_count, 0)::int as comment_count,
        exists(select 1 from likes ul where ul.post_id = p.id and ul.user_id = $1) as liked_by_me
      from posts p
      join users u on u.id = p.user_id
      left join (
        select post_id, count(*) as like_count from likes group by post_id
      ) l on l.post_id = p.id
      left join (
        select post_id, count(*) as comment_count from comments group by post_id
      ) c on c.post_id = p.id
      order by p.created_at desc
      limit $2 offset $3
      `,
      [session.user_id, limit, offset],
    );

    const ids = postsResult.rows.map((post) => post.id);
    let commentsByPost = {};
    if (ids.length) {
      const commentsResult = await pool.query(
        `
        select c.id, c.post_id, c.content, c.created_at, c.user_id, u.username, u.avatar_url, u.verified, u.role
        from comments c
        join users u on u.id = c.user_id
        where c.post_id = any($1::uuid[])
        order by c.created_at asc
        limit 200
        `,
        [ids],
      );
      commentsByPost = commentsResult.rows.reduce((acc, row) => {
        if (!acc[row.post_id]) {
          acc[row.post_id] = [];
        }
        acc[row.post_id].push(row);
        return acc;
      }, {});
    }

    success(res, {
      moderation: {
        isModerator,
        isCommunityBanned,
        bannedUntil: me?.community_banned_until || null,
        banReason: me?.community_ban_reason || "",
      },
      posts: postsResult.rows.map((post) => ({
        ...post,
        comments: commentsByPost[post.id] || [],
      })),
    });
    return;
  }

  if (!validateCsrf(req, session)) {
    fail(res, 403, "Invalid CSRF token");
    return;
  }

  const body = await parseJsonBody(req);
  const action = cleanText(body.action, 40).toLowerCase();

  if (req.method === "POST" && action === "ban_user") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can ban users");
      return;
    }
    const username = cleanText(body.username, 64).toLowerCase();
    const reason = cleanText(body.reason, 220) || "Community rules violation";
    const hours = Math.max(1, Math.min(24 * 365, Number(body.hours) || 24));
    if (!username) {
      fail(res, 400, "username is required");
      return;
    }
    const target = await pool.query(
      "select id, role from users where lower(username) = $1 limit 1",
      [username],
    );
    if (!target.rowCount) {
      fail(res, 404, "User not found");
      return;
    }
    const targetUser = target.rows[0];
    if (targetUser.role === "owner") {
      fail(res, 403, "Owner cannot be banned");
      return;
    }
    await pool.query(
      `update users
       set community_banned_until = now() + ($2 || ' hour')::interval,
           community_ban_reason = $3,
           updated_at = now()
       where id = $1`,
      [targetUser.id, String(hours), reason],
    );
    success(res, { ok: true });
    return;
  }

  if (req.method === "POST" && action === "unban_user") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can unban users");
      return;
    }
    const username = cleanText(body.username, 64).toLowerCase();
    if (!username) {
      fail(res, 400, "username is required");
      return;
    }
    await pool.query(
      `update users
       set community_banned_until = null,
           community_ban_reason = null,
           updated_at = now()
       where lower(username) = $1`,
      [username],
    );
    success(res, { ok: true });
    return;
  }

  if (
    isCommunityBanned &&
    (action === "create_post" ||
      action === "toggle_like" ||
      action === "add_comment")
  ) {
    fail(
      res,
      403,
      `You are banned from community interactions until ${new Date(me.community_banned_until).toLocaleString()}`,
    );
    return;
  }

  if (req.method === "POST" && action === "create_post") {
    const title = cleanText(body.title, 120);
    const content = cleanText(body.content, 3000);
    const imageUrl = cleanText(body.imageUrl, 800);
    const category = cleanText(body.category, 30);
    if (
      !title ||
      !content ||
      !["fan_art", "theory", "spoiler"].includes(category)
    ) {
      fail(res, 400, "Invalid post payload");
      return;
    }
    const { rows } = await pool.query(
      `insert into posts (user_id, title, content, image_url, category, created_at, updated_at)
       values ($1,$2,$3,$4,$5,now(),now())
       returning id`,
      [session.user_id, title, content, imageUrl || null, category],
    );
    success(res, { postId: rows[0].id }, 201);
    return;
  }

  if (req.method === "POST" && action === "toggle_like") {
    const postId = cleanText(body.postId, 80);
    if (!postId) {
      fail(res, 400, "postId is required");
      return;
    }
    const existing = await pool.query(
      "select 1 from likes where user_id = $1 and post_id = $2",
      [session.user_id, postId],
    );
    if (existing.rowCount) {
      await pool.query(
        "delete from likes where user_id = $1 and post_id = $2",
        [session.user_id, postId],
      );
      success(res, { liked: false });
    } else {
      await pool.query("insert into likes (user_id, post_id) values ($1, $2)", [
        session.user_id,
        postId,
      ]);
      success(res, { liked: true });
    }
    return;
  }

  if (req.method === "POST" && action === "add_comment") {
    const postId = cleanText(body.postId, 80);
    const content = cleanText(body.content, 1200);
    if (!postId || !content) {
      fail(res, 400, "postId and content are required");
      return;
    }
    const { rows } = await pool.query(
      `insert into comments (post_id, user_id, content, created_at, updated_at)
       values ($1,$2,$3,now(),now())
       returning id`,
      [postId, session.user_id, content],
    );
    success(res, { commentId: rows[0].id }, 201);
    return;
  }

  if (req.method === "POST" && action === "delete_post") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can delete posts");
      return;
    }
    const postId = cleanText(body.postId, 80);
    if (!postId) {
      fail(res, 400, "postId is required");
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from likes where post_id = $1", [postId]);
      await client.query("delete from comments where post_id = $1", [postId]);
      await client.query("delete from posts where id = $1", [postId]);
      await client.query("commit");
    } catch (txErr) {
      await client.query("rollback");
      throw txErr;
    } finally {
      client.release();
    }
    success(res, { ok: true });
    return;
  }

  if (req.method === "POST" && action === "delete_comment") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can delete comments");
      return;
    }
    const commentId = cleanText(body.commentId, 80);
    if (!commentId) {
      fail(res, 400, "commentId is required");
      return;
    }
    await pool.query("delete from comments where id = $1", [commentId]);
    success(res, { ok: true });
    return;
  }

  fail(res, 405, "Method not allowed");
};

})();

exports.handleProgress = (() => {






return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (!takeRateLimitToken(`progress:${getClientIp(req)}`, 60, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  try {
    const session = await requireSession(req, res, fail);
    if (!session) {
      return;
    }

    if (req.method === "GET") {
      const novelId = String(req.query?.novelId || "threadborn");
      const { rows } = await pool.query(
        "select novel_id, volume_id, chapter_id, scroll_position, updated_at from reading_progress where user_id = $1 and novel_id = $2 limit 1",
        [session.user_id, novelId],
      );
      success(res, { progress: rows[0] || null });
      return;
    }

    if (req.method !== "PUT") {
      fail(res, 405, "Method not allowed");
      return;
    }
    if (!validateCsrf(req, session)) {
      fail(res, 403, "Invalid CSRF token");
      return;
    }
    const body = await parseJsonBody(req);
    const novelId = String(body.novelId || "threadborn");
    const volumeId = String(body.volumeId || "");
    const chapterId = String(body.chapterId || "");
    const scrollPosition = Math.max(0, Number(body.scrollPosition || 0));
    if (!volumeId || !chapterId) {
      fail(res, 400, "volumeId and chapterId are required");
      return;
    }
    const { rows } = await pool.query(
      `insert into reading_progress (user_id, novel_id, volume_id, chapter_id, scroll_position, updated_at)
     values ($1,$2,$3,$4,$5,now())
     on conflict (user_id, novel_id)
     do update set
       volume_id = excluded.volume_id,
       chapter_id = excluded.chapter_id,
       scroll_position = excluded.scroll_position,
       updated_at = now()
     returning novel_id, volume_id, chapter_id, scroll_position, updated_at`,
      [session.user_id, novelId, volumeId, chapterId, scrollPosition],
    );
    success(res, { progress: rows[0] });
  } catch (error) {
    fail(res, 500, "Progress unavailable");
  }
};

})();

exports.handleReactions = (() => {






function cleanText(value, max = 2000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function cleanTarget(input) {
  const targetType = cleanText(
    input.targetType || input.target_type,
    20,
  ).toLowerCase();
  const volumeId = cleanText(input.volumeId || input.volume_id, 120);
  const chapterId = cleanText(input.chapterId || input.chapter_id, 160);
  if (!["volume", "chapter"].includes(targetType) || !volumeId) {
    return null;
  }
  if (targetType === "chapter" && !chapterId) {
    return null;
  }
  return {
    targetType,
    volumeId,
    chapterId: targetType === "chapter" ? chapterId : null,
  };
}

function rowToReaction(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    volumeId: row.volume_id,
    chapterId: row.chapter_id || "",
    rating:
      row.rating === null || row.rating === undefined
        ? null
        : Number(row.rating),
    category: row.category,
    content: row.content || "",
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username || "Reader",
      avatarUrl: row.avatar_url || "",
      verified: !!row.verified,
      role: row.role || "user",
    },
  };
}

function rowToSummary(row) {
  const avg =
    row.average_rating === null || row.average_rating === undefined
      ? null
      : Number(row.average_rating);
  return {
    targetType: row.target_type,
    volumeId: row.volume_id,
    chapterId: row.chapter_id || "",
    averageRating: avg === null ? null : Math.round(avg * 10) / 10,
    ratingCount: Number(row.rating_count || 0),
    commentCount: Number(row.comment_count || 0),
  };
}

async function loadSummaries() {
  const { rows } = await pool.query(`
    select target_type, volume_id, coalesce(chapter_id, '') as chapter_id,
           avg(rating) filter (where rating is not null) as average_rating,
           count(rating)::int as rating_count,
           count(*) filter (where content <> '')::int as comment_count
    from reader_reactions
    where novel_id = 'threadborn'
    group by target_type, volume_id, coalesce(chapter_id, '')
  `);
  return rows.map(rowToSummary);
}

async function loadTarget(target, limit) {
  const { rows } = await pool.query(
    `
    select rr.id, rr.user_id, rr.target_type, rr.volume_id, rr.chapter_id, rr.rating, rr.category, rr.content, rr.created_at,
           u.username, u.avatar_url, u.verified, u.role
    from reader_reactions rr
    join users u on u.id = rr.user_id
    where rr.novel_id = 'threadborn'
      and rr.target_type = $1
      and rr.volume_id = $2
      and coalesce(rr.chapter_id, '') = coalesce($3, '')
    order by rr.created_at desc
    limit $4
  `,
    [target.targetType, target.volumeId, target.chapterId || "", limit],
  );

  const summaryRows = await pool.query(
    `
    select target_type, volume_id, coalesce(chapter_id, '') as chapter_id,
           avg(rating) filter (where rating is not null) as average_rating,
           count(rating)::int as rating_count,
           count(*) filter (where content <> '')::int as comment_count
    from reader_reactions
    where novel_id = 'threadborn'
      and target_type = $1
      and volume_id = $2
      and coalesce(chapter_id, '') = coalesce($3, '')
    group by target_type, volume_id, coalesce(chapter_id, '')
  `,
    [target.targetType, target.volumeId, target.chapterId || ""],
  );

  return {
    summary: summaryRows.rows[0]
      ? rowToSummary(summaryRows.rows[0])
      : {
          targetType: target.targetType,
          volumeId: target.volumeId,
          chapterId: target.chapterId || "",
          averageRating: null,
          ratingCount: 0,
          commentCount: 0,
        },
    reactions: rows.map(rowToReaction),
  };
}

async function loadMine(session) {
  const { rows } = await pool.query(
    `
    select rr.id, rr.user_id, rr.target_type, rr.volume_id, rr.chapter_id, rr.rating, rr.category, rr.content, rr.created_at,
           u.username, u.avatar_url, u.verified, u.role
    from reader_reactions rr
    join users u on u.id = rr.user_id
    where rr.user_id = $1
      and rr.novel_id = 'threadborn'
    order by rr.created_at desc
    limit 50
  `,
    [session.user_id],
  );
  return rows.map(rowToReaction);
}

return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }

  const action = req.query?.action || "";

  // ── Paragraph reactions ──────────────────────────────────────────────────────
  if (action === "paragraph") {
    if (!takeRateLimitToken(`para_react:${getClientIp(req)}`, 60, 60_000))
      return fail(res, 429, "Too many requests");
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    const ALLOWED_EMOJIS = new Set(["❤️", "😂", "😱", "🔥", "💀", "🤯", "👏"]);
    try {
      await pool.ensureMigrations();
      if (req.method === "GET") {
        const chapterKey = String(req.query?.chapter_key || "");
        if (!chapterKey) return fail(res, 400, "chapter_key required");
        const session = await getSession(req).catch(() => null);
        const { rows } = await pool.query(
          `SELECT paragraph_index, emoji, COUNT(*)::int as count FROM paragraph_reactions WHERE novel_id='threadborn' AND chapter_key=$1 GROUP BY paragraph_index, emoji ORDER BY paragraph_index, count DESC`,
          [chapterKey],
        );
        let mine = [];
        if (session) {
          const mr = await pool.query(
            "SELECT paragraph_index, emoji FROM paragraph_reactions WHERE user_id=$1 AND novel_id='threadborn' AND chapter_key=$2",
            [session.user_id, chapterKey],
          );
          mine = mr.rows;
        }
        return success(res, { reactions: rows, mine });
      }
      if (req.method === "POST") {
        const session = await requireSession(req, res, fail);
        if (!session) return;
        if (!validateCsrf(req, session))
          return fail(res, 403, "Invalid CSRF token");
        const body = await parseJsonBody(req);
        const chapterKey = String(body.chapter_key || "").trim();
        const paragraphIndex = Number(body.paragraph_index);
        const emoji = String(body.emoji || "");
        if (
          !chapterKey ||
          !Number.isInteger(paragraphIndex) ||
          paragraphIndex < 0
        )
          return fail(res, 400, "Invalid payload");
        if (!ALLOWED_EMOJIS.has(emoji)) return fail(res, 400, "Invalid emoji");
        const existing = await pool.query(
          "SELECT id FROM paragraph_reactions WHERE user_id=$1 AND chapter_key=$2 AND paragraph_index=$3 AND emoji=$4",
          [session.user_id, chapterKey, paragraphIndex, emoji],
        );
        if (existing.rows.length) {
          await pool.query("DELETE FROM paragraph_reactions WHERE id=$1", [
            existing.rows[0].id,
          ]);
          return success(res, { toggled: false });
        }
        await pool.query(
          "INSERT INTO paragraph_reactions (user_id,novel_id,chapter_key,paragraph_index,emoji) VALUES ($1,'threadborn',$2,$3,$4)",
          [session.user_id, chapterKey, paragraphIndex, emoji],
        );
        return success(res, { toggled: true });
      }
      return fail(res, 405, "Method not allowed");
    } catch (error) {
      return fail(res, 500, "Paragraph reactions unavailable");
    }
  }

  if (!takeRateLimitToken(`reactions:${getClientIp(req)}`, 30, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  if (!process.env.DATABASE_URL) {
    if (req.method === "GET") {
      success(res, { summaries: [], reactions: [], summary: null, mine: [] });
      return;
    }
    fail(res, 503, "Missing DATABASE_URL environment variable");
    return;
  }

  try {
    await pool.ensureMigrations();

    if (req.method === "GET") {
      const query = req.query || {};
      const limit = Math.max(1, Math.min(50, Number(query.limit || 20)));
      const session = await getSession(req).catch(() => null);
      if (query.mine === "1" || query.mine === "true") {
        if (!session) {
          fail(res, 401, "Unauthorized");
          return;
        }
        success(res, { mine: await loadMine(session) });
        return;
      }
      if (query.summary === "1" || query.summary === "true") {
        success(res, { summaries: await loadSummaries() });
        return;
      }
      const target = cleanTarget(query);
      if (!target) {
        success(res, { summaries: await loadSummaries(), reactions: [] });
        return;
      }
      success(res, await loadTarget(target, limit));
      return;
    }

    if (req.method !== "POST" && req.method !== "DELETE") {
      fail(res, 405, "Method not allowed");
      return;
    }

    const session = await requireSession(req, res, fail);
    if (!session) {
      return;
    }
    if (!validateCsrf(req, session)) {
      fail(res, 403, "Invalid CSRF token");
      return;
    }

    const body = await parseJsonBody(req);
    if (req.method === "DELETE") {
      if (session.role !== "owner" && session.role !== "admin") {
        fail(res, 403, "Only owner/admin can delete reactions");
        return;
      }
      const reactionId = cleanText(body.reactionId, 80);
      if (!reactionId) {
        fail(res, 400, "reactionId is required");
        return;
      }
      await pool.query("delete from reader_reactions where id = $1", [
        reactionId,
      ]);
      success(res, { ok: true });
      return;
    }

    const target = cleanTarget(body);
    const category = cleanText(body.category, 20).toLowerCase() || "comment";
    const content = cleanText(body.content, 1600);
    const ratingRaw =
      body.rating === "" || body.rating === undefined || body.rating === null
        ? null
        : Number(body.rating);
    const rating = Number.isFinite(ratingRaw)
      ? Math.max(1, Math.min(5, Math.round(ratingRaw)))
      : null;

    if (!target || !["comment", "theory", "spoiler"].includes(category)) {
      fail(res, 400, "Invalid reaction target");
      return;
    }
    if (!content && rating === null) {
      fail(res, 400, "Write a comment or choose a rating");
      return;
    }

    const { rows } = await pool.query(
      `
      insert into reader_reactions (user_id, novel_id, target_type, volume_id, chapter_id, rating, category, content, updated_at)
      values ($1, 'threadborn', $2, $3, $4, $5, $6, $7, now())
      returning id
    `,
      [
        session.user_id,
        target.targetType,
        target.volumeId,
        target.chapterId,
        rating,
        category,
        content,
      ],
    );

    success(res, { reactionId: rows[0].id }, 201);
  } catch (error) {
    fail(res, 500, "Reader reactions unavailable");
  }
};

})();

exports.handleAvatar = (() => {







return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`avatar_upload:${getClientIp(req)}`, 5, 60_000)) {
    fail(res, 429, "Too many upload attempts");
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }
  if (!validateCsrf(req, session)) {
    fail(res, 403, "Invalid CSRF token");
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    fail(res, 503, "Missing BLOB_READ_WRITE_TOKEN");
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const dataUrl = String(body.dataUrl || "");
    if (!dataUrl.startsWith("data:image/")) {
      fail(res, 400, "Invalid image payload");
      return;
    }
    const [meta, base64] = dataUrl.split(",");
    const ALLOWED_IMAGE_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
    const typeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(meta);
    if (!typeMatch || !base64) {
      fail(res, 400, "Invalid image format");
      return;
    }
    const contentType = typeMatch[1];
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      fail(res, 400, "Only JPEG, PNG, GIF, and WebP images are allowed");
      return;
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > 3 * 1024 * 1024) {
      fail(res, 400, "Image too large (max 3MB)");
      return;
    }

    // Delete the old avatar blob if it exists to prevent storage leaks
    try {
      const existing = await pool.query(
        "select avatar_url from users where id = $1",
        [session.user_id],
      );
      const oldUrl = existing.rows[0]?.avatar_url || "";
      if (oldUrl && oldUrl.includes("blob.vercel-storage.com")) {
        
        await del(oldUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
    } catch (e) {
      console.error("[avatar] Failed to delete old blob:", e);
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `avatars/${session.user_id}-${Date.now()}.${ext}`;
    const blob = await put(fileName, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Persist the new avatar URL to the database immediately
    await pool.query(
      "update users set avatar_url = $1, updated_at = now() where id = $2",
      [blob.url, session.user_id],
    );

    success(res, { url: blob.url });
  } catch (error) {
    fail(res, 500, "Upload failed");
  }
};

})();

exports.handleProfile = (() => {






function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatar_url || "",
    verified: row.verified,
    role: row.role,
  };
}

function reactionRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    targetType: row.target_type,
    volumeId: row.volume_id,
    chapterId: row.chapter_id || "",
    rating:
      row.rating === null || row.rating === undefined
        ? null
        : Number(row.rating),
    category: row.category,
    content: row.content || "",
    createdAt: row.created_at,
  }));
}

async function loadReactionsForUser(userId) {
  const result = await pool
    .query(
      `select id, target_type, volume_id, chapter_id, rating, category, content, created_at
     from reader_reactions
     where user_id = $1
     order by created_at desc
     limit 50`,
      [userId],
    )
    .catch(() => ({ rows: [] }));
  return reactionRows(result.rows);
}

return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }

  if (!takeRateLimitToken(`profile:${getClientIp(req)}`, 60, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }

  if (req.method === "GET" && req.query?.username) {
    if (!process.env.DATABASE_URL) {
      fail(res, 503, "Missing DATABASE_URL environment variable");
      return;
    }
    await pool.ensureMigrations();
    const username = String(req.query.username || "").trim();
    const userResult = await pool.query(
      "select id, username, avatar_url, verified, role from users where lower(username) = lower($1) limit 1",
      [username],
    );
    if (!userResult.rowCount) {
      fail(res, 404, "User not found");
      return;
    }
    const user = userResult.rows[0];
    success(res, {
      user: publicUser(user),
      reactions: await loadReactionsForUser(user.id),
      posts: [],
    });
    return;
  }

  // ── Push VAPID public key (action=push-vapid) ───────────────────────────────
  if (req.query?.action === "push-vapid") {
    return success(res, { publicKey: process.env.VAPID_PUBLIC_KEY || null });
  }

  // ── Save push subscription (action=push-subscribe) ─────────────────────────
  if (req.query?.action === "push-subscribe") {
    if (req.method !== "POST") return fail(res, 405, "Method not allowed");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      const body = await parseJsonBody(req);
      const { endpoint, p256dh, auth } = body;
      if (!endpoint || !p256dh || !auth)
        return fail(res, 400, "Missing subscription fields");
      await pool.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=$3, auth=$4`,
        [session.user_id, endpoint, p256dh, auth],
      );
      return success(res, { subscribed: true });
    } catch (e) {
      return fail(res, 500, "Could not save subscription");
    }
  }

  // ── Remove push subscription (action=push-unsubscribe) ─────────────────────
  if (req.query?.action === "push-unsubscribe") {
    if (req.method !== "POST") return fail(res, 405, "Method not allowed");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      const body = await parseJsonBody(req);
      if (body.endpoint) {
        await pool.query(
          "DELETE FROM push_subscriptions WHERE user_id=$1 AND endpoint=$2",
          [session.user_id, body.endpoint],
        );
      } else {
        await pool.query("DELETE FROM push_subscriptions WHERE user_id=$1", [
          session.user_id,
        ]);
      }
      return success(res, { unsubscribed: true });
    } catch (e) {
      return fail(res, 500, "Could not remove subscription");
    }
  }

  // ── Notifications (action=notifications) ────────────────────────────────────
  if (req.query?.action === "notifications") {
    if (!takeRateLimitToken(`notif:${getClientIp(req)}`, 30, 60_000))
      return fail(res, 429, "Too many requests");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      if (req.method === "GET") {
        const { rows } = await pool.query(
          "SELECT id, type, title, body, link, read, created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30",
          [session.user_id],
        );
        const unread = rows.filter((n) => !n.read).length;
        return success(res, { notifications: rows, unread });
      }
      if (req.method === "POST") {
        const body = await parseJsonBody(req);
        if (body.markAllRead) {
          await pool.query(
            "UPDATE notifications SET read=true WHERE user_id=$1",
            [session.user_id],
          );
        } else if (body.id) {
          await pool.query(
            "UPDATE notifications SET read=true WHERE id=$1 AND user_id=$2",
            [body.id, session.user_id],
          );
        }
        return success(res, { updated: true });
      }
      return fail(res, 405, "Method not allowed");
    } catch (e) {
      return fail(res, 500, "Notifications unavailable");
    }
  }

  // ── Feedback (action=feedback) ────────────────────────────────────────────────────
  if (req.query?.action === "feedback") {
    if (req.method !== "POST") return fail(res, 405, "Method not allowed");
    if (!takeRateLimitToken(`feedback:${getClientIp(req)}`, 5, 60_000))
      return fail(res, 429, "Too many feedback submissions");
    try {
      await pool.ensureMigrations();
      const fbSession = await getSession(req).catch(() => null);
      const feedbackBody = await parseJsonBody(req);
      const feedbackType = ["bug", "suggestion", "content", "other"].includes(
        feedbackBody.type,
      )
        ? feedbackBody.type
        : "other";
      const message = String(feedbackBody.message || "").trim();
      const pagePath = String(feedbackBody.page || "/").slice(0, 200);
      if (!message || message.length < 5)
        return fail(res, 400, "Message too short");
      if (message.length > 2000) return fail(res, 400, "Message too long");
      await pool.query(
        "INSERT INTO reader_feedback (user_id,page_path,feedback_type,message) VALUES ($1,$2,$3,$4)",
        [fbSession?.user_id || null, pagePath, feedbackType, message],
      );
      // Send to Discord webhook if configured
      const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK;
      if (webhookUrl) {
        try {
          const colorMap = {
            bug: 0xff4444,
            suggestion: 0x44cc88,
            content: 0x4488ff,
            other: 0x888888,
          };
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              embeds: [
                {
                  title: `📣 Threadborn Feedback — ${feedbackType}`,
                  description: message.slice(0, 4000),
                  color: colorMap[feedbackType] || 0x888888,
                  fields: [
                    { name: "Type", value: feedbackType, inline: true },
                    { name: "Page", value: pagePath, inline: true },
                    {
                      name: "User",
                      value: fbSession?.username || "Anonymous",
                      inline: true,
                    },
                  ],
                  timestamp: new Date().toISOString(),
                  footer: { text: "Threadborn Reader Feedback" },
                },
              ],
            }),
          });
        } catch (discordErr) {
          console.error(
            "[feedback] Discord webhook failed:",
            discordErr.message,
          );
        }
      }
      return success(res, { submitted: true });
    } catch (e) {
      return fail(res, 500, "Could not submit feedback");
    }
  }

  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }

  // Handle settings routing
  if (req.query?.action === "settings") {
    if (req.method === "GET") {
      const { rows } = await pool.query(
        "select settings_json from user_settings where user_id = $1 limit 1",
        [session.user_id],
      );
      return success(res, { settings: rows[0]?.settings_json || {} });
    }

    if (req.method === "PUT") {
      if (!validateCsrf(req, session)) {
        return fail(res, 403, "Invalid CSRF token");
      }
      const body = await parseJsonBody(req);
      const settings =
        typeof body.settings === "object" && body.settings ? body.settings : {};
      if (JSON.stringify(settings).length > 65536) {
        return fail(res, 400, "Settings payload too large");
      }
      const { rows } = await pool.query(
        `insert into user_settings (user_id, settings_json, updated_at)
         values ($1, $2::jsonb, now())
         on conflict (user_id)
         do update set settings_json = excluded.settings_json, updated_at = now()
         returning settings_json`,
        [session.user_id, JSON.stringify(settings)],
      );
      return success(res, { settings: rows[0].settings_json });
    }
    return fail(res, 405, "Method not allowed for settings");
  }

  if (req.method === "GET") {
    const postsResult = await pool
      .query(
        "select id, title, content, category, created_at from posts where user_id = $1 order by created_at desc limit 20",
        [session.user_id],
      )
      .catch(() => ({ rows: [] }));
    success(res, {
      user: {
        id: session.user_id,
        email: session.email,
        username: session.username,
        avatarUrl: session.avatar_url || "",
        verified: session.verified,
        role: session.role,
      },
      posts: postsResult.rows,
      reactions: await loadReactionsForUser(session.user_id),
    });
    return;
  }

  if (req.method !== "PATCH") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!validateCsrf(req, session)) {
    fail(res, 403, "Invalid CSRF token");
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const username = String(body.username || "").trim();
    if (!username || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      fail(
        res,
        400,
        "Username must be 3-24 chars (letters, numbers, underscore)",
      );
      return;
    }

    let rows;
    if (body.avatarUrl !== undefined) {
      let avatarUrl = null;
      if (body.avatarUrl !== undefined && String(body.avatarUrl).trim()) {
        const rawUrl = String(body.avatarUrl).trim();
        try {
          const parsed = new URL(rawUrl);
          if (parsed.protocol === "https:") avatarUrl = parsed.href;
          else {
            fail(res, 400, "Avatar URL must use HTTPS");
            return;
          }
        } catch {
          fail(res, 400, "Invalid avatar URL");
          return;
        }
      }
      ({ rows } = await pool.query(
        `update users
         set username = $1, avatar_url = $2, updated_at = now()
         where id = $3
         returning id, email, username, avatar_url, verified, role`,
        [username, avatarUrl, session.user_id],
      ));
    } else {
      ({ rows } = await pool.query(
        `update users
         set username = $1, updated_at = now()
         where id = $2
         returning id, email, username, avatar_url, verified, role`,
        [username, session.user_id],
      ));
    }
    success(res, {
      user: {
        id: rows[0].id,
        email: rows[0].email,
        username: rows[0].username,
        avatarUrl: rows[0].avatar_url || "",
        verified: rows[0].verified,
        role: rows[0].role,
      },
    });
  } catch (error) {
    if (String(error.message || "").includes("duplicate")) {
      fail(res, 409, "Username is already in use");
      return;
    }
    fail(res, 500, "Profile update failed");
  }
};

})();

exports.handleDashboard = (() => {








return async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return fail(res, 503, "Missing DATABASE_URL environment variable");
  }

  try {
    await pool.ensureMigrations();

    // Parse action from query or default to config
    const action = req.query.action || "config";

    if (action === "config") {
      const lang = req.query.lang || "en";
      const configKey =
        lang === "ja" ? "global_settings_jp" : "global_settings";

      if (req.method === "GET") {
        const { rows } = await pool.query(
          "select value from dashboard_config where key = $1",
          [configKey],
        );
        if (!rows.length) {
          return success(res, {
            notification: "",
            notifications: [],
            countdowns: [],
            countdown: { title: "", target_date: "" },
          });
        }
        return success(res, rows[0].value);
      }

      if (req.method === "POST" || req.method === "PUT") {
        const session = await requireSession(req, res, fail);
        if (!session) return;

        if (session.role !== "owner") {
          return fail(res, 403, "Only the owner can update dashboard config");
        }

        if (!validateCsrf(req, session)) {
          return fail(res, 403, "Invalid CSRF token");
        }

        const body = await parseJsonBody(req);
        const payload = {
          notification: String(body.notification || ""), // legacy fallback
          notifications: Array.isArray(body.notifications)
            ? body.notifications.map((n) => String(n))
            : [],
          countdowns: Array.isArray(body.countdowns)
            ? body.countdowns
            : body.countdown && body.countdown.title
              ? [body.countdown]
              : [],
          countdown: {
            title: String(body.countdown?.title || ""),
            target_date: String(body.countdown?.target_date || ""),
          },
        };

        await pool.query(
          `insert into dashboard_config (key, value, updated_at)
           values ($1, $2, now())
           on conflict (key) do update set value = $2, updated_at = now()`,
          [configKey, payload],
        );

        // Broadcast push notification to all subscribers when an announcement is saved
        if (
          Array.isArray(payload.notifications) &&
          payload.notifications.length > 0
        ) {
          sendPushBroadcast(pool, {
            title: "📢 Threadborn — New Announcement",
            body: String(payload.notifications[0]).slice(0, 100),
            tag: "announcement",
            url: "/?view=community",
          }).catch(() => {});
        }

        return success(res, payload);
      }
    }

    if (action === "art") {
      // GET: Publicly list all art
      if (req.method === "GET") {
        const { rows } = await pool.query(
          "select id, character_name, url, label from dashboard_art order by created_at desc",
        );
        return success(res, { art: rows });
      }

      // Must be logged in as owner for POST and DELETE
      const session = await requireSession(req, res, fail);
      if (!session) return;

      if (session.role !== "owner") {
        return fail(res, 403, "Only the owner can modify art");
      }

      if (!validateCsrf(req, session)) {
        return fail(res, 403, "Invalid CSRF token");
      }

      // POST: Upload new art
      if (req.method === "POST") {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return fail(res, 503, "Missing BLOB_READ_WRITE_TOKEN");
        }

        const body = await parseJsonBody(req);
        const characterName = String(body.characterName || "").trim();
        const label = String(body.label || "").trim();
        const dataUrl = String(body.dataUrl || "");

        if (!characterName) {
          return fail(res, 400, "Character name is required");
        }

        if (!dataUrl.startsWith("data:image/")) {
          return fail(res, 400, "Invalid image payload");
        }

        const [meta, base64] = dataUrl.split(",");
        const typeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(meta);
        if (!typeMatch || !base64) {
          return fail(res, 400, "Invalid image format");
        }

        const contentType = typeMatch[1];
        const bytes = Buffer.from(base64, "base64");

        if (bytes.length > 5 * 1024 * 1024) {
          return fail(res, 400, "Image too large (max 5MB)");
        }

        const ext = contentType.includes("png") ? "png" : "jpg";
        const fileName = `art/${characterName.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${Date.now()}.${ext}`;

        const blob = await put(fileName, bytes, {
          access: "public",
          addRandomSuffix: true,
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        const { rows } = await pool.query(
          `insert into dashboard_art (character_name, url, label, created_at)
           values ($1, $2, $3, now()) returning id, character_name, url, label`,
          [characterName, blob.url, label],
        );

        return success(res, { art: rows[0] });
      }

      // DELETE: Remove art
      if (req.method === "DELETE") {
        const body = await parseJsonBody(req);
        const id = String(body.id || "");
        if (!id) return fail(res, 400, "Missing art ID");

        const { rows } = await pool.query(
          "select url from dashboard_art where id = $1",
          [id],
        );
        if (rows.length > 0) {
          try {
            if (process.env.BLOB_READ_WRITE_TOKEN) {
              await del(rows[0].url, {
                token: process.env.BLOB_READ_WRITE_TOKEN,
              });
            }
          } catch (e) {
            console.error("[dashboard] blob delete failed:", e);
          }
          await pool.query("delete from dashboard_art where id = $1", [id]);
        }
        return success(res, { deleted: true });
      }
    }

    if (action === "polls") {
      // GET: Fetch active polls for a given language
      if (req.method === "GET") {
        const lang = req.query.lang || "en";
        const { rows: polls } = await pool.query(
          "select id, question, created_at from polls where is_active = true and lang = $1 order by created_at desc",
          [lang],
        );

        if (polls.length > 0) {
          const pollIds = polls.map((p) => p.id);
          const { rows: allOptions } = await pool.query(
            "select id, poll_id, option_text, votes from poll_options where poll_id = any($1::uuid[]) order by id asc",
            [pollIds],
          );
          const optionsByPoll = allOptions.reduce((acc, opt) => {
            if (!acc[opt.poll_id]) acc[opt.poll_id] = [];
            acc[opt.poll_id].push({
              id: opt.id,
              option_text: opt.option_text,
              votes: opt.votes,
            });
            return acc;
          }, {});
          for (const poll of polls) {
            poll.options = optionsByPoll[poll.id] || [];
          }
        }

        return success(res, { polls });
      }

      // POST: Vote on a poll
      if (req.method === "POST") {
        const ip = getClientIp(req);
        if (!takeRateLimitToken(`poll_vote:${ip}`, 10, 60_000)) {
          return fail(res, 429, "Too many votes, please try again later");
        }
        const body = await parseJsonBody(req);
        const optionId = String(body.optionId || "");
        if (!optionId) return fail(res, 400, "Missing option ID");

        const result = await pool.query(
          "update poll_options set votes = votes + 1 where id = $1 and poll_id in (select id from polls where is_active = true)",
          [optionId],
        );
        if (result.rowCount === 0) {
          return fail(res, 404, "Poll option not found");
        }
        return success(res, { voted: true });
      }

      // Must be logged in as owner for PUT and DELETE
      const session = await requireSession(req, res, fail);
      if (!session) return;

      if (session.role !== "owner") {
        return fail(res, 403, "Only the owner can modify polls");
      }

      if (!validateCsrf(req, session)) {
        return fail(res, 403, "Invalid CSRF token");
      }

      // PUT: Create a new poll
      if (req.method === "PUT") {
        const body = await parseJsonBody(req);
        const question = String(body.question || "").trim();
        const lang = String(body.lang || "en").trim();
        const options = Array.isArray(body.options) ? body.options : [];

        if (!question || options.length < 2) {
          return fail(
            res,
            400,
            "Poll must have a question and at least 2 options",
          );
        }

        const client = await pool.connect();
        let pollId;
        try {
          await client.query("begin");
          const { rows } = await client.query(
            "insert into polls (question, lang, is_active) values ($1, $2, true) returning id",
            [question, lang],
          );
          pollId = rows[0].id;
          for (const opt of options) {
            await client.query(
              "insert into poll_options (poll_id, option_text, votes) values ($1, $2, 0)",
              [pollId, String(opt).trim()],
            );
          }
          await client.query("commit");
        } catch (txErr) {
          await client.query("rollback");
          throw txErr;
        } finally {
          client.release();
        }
        return success(res, { created: true, pollId });
      }

      // DELETE: Remove a poll
      if (req.method === "DELETE") {
        const body = await parseJsonBody(req);
        const id = String(body.id || "");
        if (!id) return fail(res, 400, "Missing poll ID");

        await pool.query("delete from polls where id = $1", [id]);
        return success(res, { deleted: true });
      }
    }

    if (action === "clear_all") {
      if (req.method === "POST") {
        const session = await requireSession(req, res, fail);
        if (!session || session.role !== "owner") {
          return fail(res, 403, "Only owner can clear data");
        }
        if (!validateCsrf(req, session)) {
          return fail(res, 403, "Invalid CSRF token");
        }
        const body2 = await parseJsonBody(req);
        if (body2.confirm !== "DELETE_ALL_DATA") {
          return fail(
            res,
            400,
            "Missing confirmation — send { confirm: 'DELETE_ALL_DATA' }",
          );
        }
        await pool.query("truncate dashboard_config");
        await pool.query("truncate dashboard_art");
        await pool.query("truncate polls cascade");
        return success(res, { cleared: true });
      }
    }

    if (action === "unlocks") {
      const lang = req.query.lang || "en";
      if (req.method === "GET") {
        const session = await getSession(req).catch(() => null);
        const { rows: milestones } = await pool.query(
          "SELECT id, title, description, unlock_type, target_votes, current_votes, is_unlocked, unlock_content FROM unlock_milestones WHERE lang=$1 ORDER BY created_at ASC",
          [lang],
        );
        let myVotes = new Set();
        if (session) {
          const vr = await pool.query(
            "SELECT milestone_id FROM unlock_votes WHERE user_id=$1",
            [session.user_id],
          );
          myVotes = new Set(vr.rows.map((r) => r.milestone_id));
        }
        return success(res, {
          milestones: milestones.map((m) => ({
            ...m,
            voted: myVotes.has(m.id),
          })),
        });
      }
      if (req.method === "POST") {
        const session = await requireSession(req, res, fail);
        if (!session) return;
        if (!validateCsrf(req, session))
          return fail(res, 403, "Invalid CSRF token");
        const body = await parseJsonBody(req);
        const milestoneId = String(body.milestoneId || "");
        if (!milestoneId) return fail(res, 400, "milestoneId required");
        const existing = await pool.query(
          "SELECT id FROM unlock_votes WHERE user_id=$1 AND milestone_id=$2",
          [session.user_id, milestoneId],
        );
        if (existing.rows.length) return fail(res, 409, "Already voted");
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            "INSERT INTO unlock_votes (user_id, milestone_id) VALUES ($1,$2)",
            [session.user_id, milestoneId],
          );
          const updated = await client.query(
            "UPDATE unlock_milestones SET current_votes=current_votes+1, updated_at=now(), is_unlocked=(current_votes+1 >= target_votes) WHERE id=$1 RETURNING current_votes, target_votes, is_unlocked",
            [milestoneId],
          );
          await client.query("COMMIT");
          return success(res, { voted: true, ...updated.rows[0] });
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      }
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Failed to manage dashboard");
  }
};

})();

