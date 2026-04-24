const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody } = require("../../lib/api/request");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const postsResult = await pool.query(
      "select id, title, content, category, created_at from posts where user_id = $1 order by created_at desc limit 20",
      [session.user_id]
    ).catch(() => ({ rows: [] }));
    success(res, {
      user: {
        id: session.user_id,
        email: session.email,
        username: session.username,
        avatarUrl: session.avatar_url || "",
        verified: session.verified,
        role: session.role
      },
      posts: postsResult.rows
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
    const avatarUrl = String(body.avatarUrl || "").trim();
    if (!username || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      fail(res, 400, "Username must be 3-24 chars (letters, numbers, underscore)");
      return;
    }

    const { rows } = await pool.query(
      `update users
       set username = $1, avatar_url = $2, updated_at = now()
       where id = $3
       returning id, email, username, avatar_url, verified, role`,
      [username, avatarUrl || null, session.user_id]
    );
    success(res, {
      user: {
        id: rows[0].id,
        email: rows[0].email,
        username: rows[0].username,
        avatarUrl: rows[0].avatar_url || "",
        verified: rows[0].verified,
        role: rows[0].role
      }
    });
  } catch (error) {
    if (String(error.message || "").includes("duplicate")) {
      fail(res, 409, "Username is already in use");
      return;
    }
    fail(res, 500, "Profile update failed");
  }
};
