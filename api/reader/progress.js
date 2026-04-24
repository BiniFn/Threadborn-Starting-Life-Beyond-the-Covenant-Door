const pool = require("../_lib/db");
const { allowCors, success, fail } = require("../_lib/http");
const { parseJsonBody } = require("../_lib/request");
const { requireSession, validateCsrf } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }

  if (req.method === "GET") {
    const novelId = String(req.query?.novelId || "threadborn");
    const { rows } = await pool.query(
      "select novel_id, volume_id, chapter_id, scroll_position, updated_at from reading_progress where user_id = $1 and novel_id = $2 limit 1",
      [session.user_id, novelId]
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
  const scrollPosition = Number(body.scrollPosition || 0);
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
    [session.user_id, novelId, volumeId, chapterId, scrollPosition]
  );
  success(res, { progress: rows[0] });
};
