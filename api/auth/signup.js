const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const {
  makePasswordHash,
  createSession,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  makeCookie,
  getSessionCookieOptions,
  shouldExposeSessionToken,
} = require("../../lib/api/auth");

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

module.exports = async (req, res) => {
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
