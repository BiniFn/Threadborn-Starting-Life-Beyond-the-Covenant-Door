const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
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
