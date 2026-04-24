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
      "select id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at from bookmarks where user_id = $1 and novel_id = $2 order by created_at desc",
      [session.user_id, novelId]
    );
    success(res, { bookmarks: rows });
    return;
  }

  if (req.method === "POST") {
    if (!validateCsrf(req, session)) {
      fail(res, 403, "Invalid CSRF token");
      return;
    }
    const body = await parseJsonBody(req);
    const novelId = String(body.novelId || "threadborn");
    const volumeId = String(body.volumeId || "");
    const chapterId = String(body.chapterId || "");
    const label = String(body.label || "").slice(0, 90);
    const scrollPosition = Number(body.scrollPosition || 0);
    if (!volumeId || !chapterId) {
      fail(res, 400, "volumeId and chapterId are required");
      return;
    }
    const { rows } = await pool.query(
      `insert into bookmarks (user_id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,now(),now())
       returning id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at`,
      [session.user_id, novelId, volumeId, chapterId, scrollPosition, label || null]
    );
    success(res, { bookmark: rows[0] }, 201);
    return;
  }

  if (req.method === "DELETE") {
    if (!validateCsrf(req, session)) {
      fail(res, 403, "Invalid CSRF token");
      return;
    }
    const body = await parseJsonBody(req);
    const id = String(body.id || "");
    if (!id) {
      fail(res, 400, "id is required");
      return;
    }
    await pool.query("delete from bookmarks where id = $1 and user_id = $2", [id, session.user_id]);
    success(res, { deleted: true });
    return;
  }

  fail(res, 405, "Method not allowed");
};
