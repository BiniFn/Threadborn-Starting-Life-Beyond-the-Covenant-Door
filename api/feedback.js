const pool = require("./lib/api/db");
const { allowCors, success, fail } = require("./lib/api/http");
const { parseJsonBody, getClientIp } = require("./lib/api/request");
const { takeRateLimitToken } = require("./lib/api/rate-limit");
const { getSession } = require("./lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return fail(res, 405, "Method not allowed");
  if (!takeRateLimitToken(`feedback:${getClientIp(req)}`, 5, 60_000)) return fail(res, 429, "Too many feedback submissions");

  if (!process.env.DATABASE_URL) return fail(res, 503, "Missing DATABASE_URL");

  try {
    await pool.ensureMigrations();
    const session = await getSession(req).catch(() => null);
    const body = await parseJsonBody(req);

    const feedbackType = ["bug","suggestion","content","other"].includes(body.type) ? body.type : "general";
    const message = String(body.message || "").trim();
    const pagePath = String(body.page || "/").slice(0, 200);

    if (!message || message.length < 5) return fail(res, 400, "Message too short");
    if (message.length > 2000) return fail(res, 400, "Message too long");

    await pool.query(
      "INSERT INTO reader_feedback (user_id, page_path, feedback_type, message) VALUES ($1,$2,$3,$4)",
      [session?.user_id || null, pagePath, feedbackType, message]
    );

    return success(res, { submitted: true });
  } catch (error) {
    return fail(res, 500, "Could not submit feedback");
  }
};
