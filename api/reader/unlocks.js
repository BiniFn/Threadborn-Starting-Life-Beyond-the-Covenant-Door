const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { getSession, requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;
  if (!takeRateLimitToken(`unlocks:${getClientIp(req)}`, 20, 60_000)) return fail(res, 429, "Too many requests");
  if (!process.env.DATABASE_URL) return fail(res, 503, "Missing DATABASE_URL");

  try {
    await pool.ensureMigrations();
    const lang = req.query?.lang || "en";

    if (req.method === "GET") {
      const session = await getSession(req).catch(() => null);
      const { rows: milestones } = await pool.query(
        "SELECT id, title, description, unlock_type, target_votes, current_votes, is_unlocked, unlock_content FROM unlock_milestones WHERE lang=$1 ORDER BY created_at ASC",
        [lang]
      );

      let myVotes = new Set();
      if (session) {
        const vr = await pool.query("SELECT milestone_id FROM unlock_votes WHERE user_id=$1", [session.user_id]);
        myVotes = new Set(vr.rows.map(r => r.milestone_id));
      }

      return success(res, { milestones: milestones.map(m => ({ ...m, voted: myVotes.has(m.id) })) });
    }

    if (req.method === "POST") {
      const session = await requireSession(req, res, fail);
      if (!session) return;
      if (!validateCsrf(req, session)) return fail(res, 403, "Invalid CSRF token");

      const body = await parseJsonBody(req);
      const milestoneId = String(body.milestoneId || "");
      if (!milestoneId) return fail(res, 400, "milestoneId required");

      const existing = await pool.query("SELECT id FROM unlock_votes WHERE user_id=$1 AND milestone_id=$2", [session.user_id, milestoneId]);
      if (existing.rows.length) return fail(res, 409, "Already voted");

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("INSERT INTO unlock_votes (user_id, milestone_id) VALUES ($1,$2)", [session.user_id, milestoneId]);
        const updated = await client.query(
          "UPDATE unlock_milestones SET current_votes=current_votes+1, updated_at=now(), is_unlocked=(current_votes+1 >= target_votes) WHERE id=$1 RETURNING current_votes, target_votes, is_unlocked",
          [milestoneId]
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

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Unlocks unavailable");
  }
};
