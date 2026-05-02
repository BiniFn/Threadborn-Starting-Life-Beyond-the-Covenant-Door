const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

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

module.exports = async (req, res) => {
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
