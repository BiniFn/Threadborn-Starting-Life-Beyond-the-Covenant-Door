const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  makeCookie,
  verifyPassword,
  createSession
} = require("../../lib/api/auth");

module.exports = async (req, res) => {
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
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) {
      fail(res, 400, "Email and password are required");
      return;
    }

    const { rows } = await pool.query(
      "select id, email, username, password_hash, avatar_url, verified, role from users where lower(email)= $1 limit 1",
      [email]
    );
    if (!rows.length || !verifyPassword(password, rows[0].password_hash)) {
      fail(res, 401, "Invalid credentials");
      return;
    }

    const user = rows[0];
    const session = await createSession(user.id);
    res.setHeader("Set-Cookie", makeCookie(SESSION_COOKIE, session.token, Math.floor(SESSION_TTL_MS / 1000)));
    success(res, {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatar_url || "",
        verified: user.verified,
        role: user.role
      },
      csrfToken: session.csrfToken
    });
  } catch (error) {
    fail(res, 500, "Login failed");
  }
};
