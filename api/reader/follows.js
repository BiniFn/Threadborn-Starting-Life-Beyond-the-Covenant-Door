const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;
  if (!takeRateLimitToken(`follows:${getClientIp(req)}`, 30, 60_000)) return fail(res, 429, "Too many requests");

  const session = await requireSession(req, res, fail);
  if (!session) return;
  if (!process.env.DATABASE_URL) return fail(res, 503, "Missing DATABASE_URL");

  try {
    await pool.ensureMigrations();

    if (req.method === "GET") {
      const { rows } = await pool.query(
        "SELECT follow_type, follow_key, created_at FROM reader_follows WHERE user_id = $1 ORDER BY created_at DESC",
        [session.user_id]
      );
      return success(res, { follows: rows });
    }

    if (!validateCsrf(req, session)) return fail(res, 403, "Invalid CSRF token");
    const body = await parseJsonBody(req);
    const followType = String(body.follow_type || "").trim();
    const followKey = String(body.follow_key || "").trim();

    if (!followType || !followKey) return fail(res, 400, "follow_type and follow_key are required");
    if (!["character","volume","arc","tag"].includes(followType)) return fail(res, 400, "Invalid follow_type");

    if (req.method === "POST") {
      await pool.query(
        "INSERT INTO reader_follows (user_id, follow_type, follow_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
        [session.user_id, followType, followKey]
      );
      return success(res, { followed: true, follow_type: followType, follow_key: followKey });
    }

    if (req.method === "DELETE") {
      await pool.query(
        "DELETE FROM reader_follows WHERE user_id=$1 AND follow_type=$2 AND follow_key=$3",
        [session.user_id, followType, followKey]
      );
      return success(res, { unfollowed: true });
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Follows unavailable");
  }
};
