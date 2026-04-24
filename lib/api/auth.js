const crypto = require("crypto");
const pool = require("./db");

const SESSION_COOKIE = "tb_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function makePasswordHash(rawPassword) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(rawPassword, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

function verifyPassword(rawPassword, storedPasswordHash) {
  if (!storedPasswordHash || !storedPasswordHash.startsWith("scrypt$")) {
    return false;
  }
  const parts = storedPasswordHash.split("$");
  if (parts.length !== 3) {
    return false;
  }
  const salt = Buffer.from(parts[1], "hex");
  const expectedKey = Buffer.from(parts[2], "hex");
  const derived = crypto.scryptSync(rawPassword, salt, expectedKey.length);
  return crypto.timingSafeEqual(derived, expectedKey);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return raw.split(";").reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split("=");
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function makeCookie(name, value, maxAge, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  if (options.clear) {
    parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  }
  return parts.join("; ");
}

async function createSession(userId) {
  await pool.ensureMigrations();
  const token = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(
    "insert into sessions (user_id, token_hash, csrf_token, expires_at, updated_at) values ($1, $2, $3, $4, now())",
    [userId, tokenHash, csrfToken, expiresAt]
  );
  return { token, csrfToken, expiresAt };
}

async function destroySession(req, res) {
  await pool.ensureMigrations();
  const cookies = parseCookies(req);
  const sessionToken = cookies[SESSION_COOKIE];
  if (sessionToken) {
    await pool.query("delete from sessions where token_hash = $1", [hashToken(sessionToken)]);
  }
  res.setHeader("Set-Cookie", makeCookie(SESSION_COOKIE, "", 0, { clear: true }));
}

async function getSession(req) {
  await pool.ensureMigrations();
  const cookies = parseCookies(req);
  const sessionToken = cookies[SESSION_COOKIE];
  if (!sessionToken) {
    return null;
  }
  const tokenHash = hashToken(sessionToken);
  const { rows } = await pool.query(`
    select s.id as session_id, s.user_id, s.expires_at, s.csrf_token,
           u.email, u.username, u.avatar_url, u.verified, u.role
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = $1 and s.expires_at > now()
    limit 1
  `, [tokenHash]);
  if (!rows.length) {
    return null;
  }
  return rows[0];
}

async function requireSession(req, res, failFn) {
  const session = await getSession(req);
  if (!session) {
    failFn(res, 401, "Unauthorized");
    return null;
  }
  return session;
}

function validateCsrf(req, session) {
  if (!session) {
    return false;
  }
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }
  const token = req.headers["x-csrf-token"];
  return typeof token === "string" && token.length > 10 && token === session.csrf_token;
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  makeCookie,
  makePasswordHash,
  verifyPassword,
  createSession,
  destroySession,
  getSession,
  requireSession,
  validateCsrf
};
