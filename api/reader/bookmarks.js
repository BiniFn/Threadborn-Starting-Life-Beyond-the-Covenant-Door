const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;

  const action = req.query?.action || "";

  // ── Follows ─────────────────────────────────────────────────────────────────
  if (action === "follows") {
    if (!takeRateLimitToken(`follows:${getClientIp(req)}`, 30, 60_000))
      return fail(res, 429, "Too many requests");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      if (req.method === "GET") {
        const { rows } = await pool.query(
          "SELECT follow_type, follow_key, created_at FROM reader_follows WHERE user_id=$1 ORDER BY created_at DESC",
          [session.user_id],
        );
        return success(res, { follows: rows });
      }
      if (!validateCsrf(req, session))
        return fail(res, 403, "Invalid CSRF token");
      const body = await parseJsonBody(req);
      const followType = String(body.follow_type || "").trim();
      const followKey = String(body.follow_key || "").trim();
      if (!followType || !followKey)
        return fail(res, 400, "follow_type and follow_key required");
      if (!["character", "volume", "arc", "tag"].includes(followType))
        return fail(res, 400, "Invalid follow_type");
      if (req.method === "POST") {
        await pool.query(
          "INSERT INTO reader_follows (user_id,follow_type,follow_key) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [session.user_id, followType, followKey],
        );
        return success(res, { followed: true });
      }
      if (req.method === "DELETE") {
        await pool.query(
          "DELETE FROM reader_follows WHERE user_id=$1 AND follow_type=$2 AND follow_key=$3",
          [session.user_id, followType, followKey],
        );
        return success(res, { unfollowed: true });
      }
      return fail(res, 405, "Method not allowed");
    } catch (error) {
      return fail(res, 500, "Follows unavailable");
    }
  }

  // ── Bookmarks (original handler) ─────────────────────────────────────────────
  try {
    if (!takeRateLimitToken(`bookmarks:${getClientIp(req)}`, 60, 60_000)) {
      fail(res, 429, "Too many requests");
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
        [session.user_id, novelId],
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
      const scrollPosition = Math.max(0, Number(body.scrollPosition || 0));
      if (!volumeId || !chapterId) {
        fail(res, 400, "volumeId and chapterId are required");
        return;
      }
      const countResult = await pool.query(
        "select count(*) from bookmarks where user_id = $1",
        [session.user_id],
      );
      if (parseInt(countResult.rows[0].count) >= 500) {
        fail(res, 409, "Bookmark limit reached (max 500)");
        return;
      }
      const { rows } = await pool.query(
        `insert into bookmarks (user_id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,now(),now())
       returning id, novel_id, volume_id, chapter_id, scroll_position, label, created_at, updated_at`,
        [
          session.user_id,
          novelId,
          volumeId,
          chapterId,
          scrollPosition,
          label || null,
        ],
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
      await pool.query("delete from bookmarks where id = $1 and user_id = $2", [
        id,
        session.user_id,
      ]);
      success(res, { deleted: true });
      return;
    }

    fail(res, 405, "Method not allowed");
  } catch (error) {
    fail(res, 500, "Bookmarks unavailable");
  }
};
