const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { getSession, requireSession, validateCsrf } = require("../../lib/api/auth");

const ALLOWED_EMOJIS = new Set(["❤️","😂","😱","🔥","💀","🤯","👏"]);

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;
  if (!takeRateLimitToken(`para_react:${getClientIp(req)}`, 60, 60_000)) return fail(res, 429, "Too many requests");
  if (!process.env.DATABASE_URL) return fail(res, 503, "Missing DATABASE_URL");

  try {
    await pool.ensureMigrations();

    if (req.method === "GET") {
      const chapterKey = String(req.query?.chapter_key || "");
      if (!chapterKey) return fail(res, 400, "chapter_key required");

      const session = await getSession(req).catch(() => null);

      const { rows } = await pool.query(`
        SELECT paragraph_index, emoji, COUNT(*)::int as count
        FROM paragraph_reactions
        WHERE novel_id='threadborn' AND chapter_key=$1
        GROUP BY paragraph_index, emoji
        ORDER BY paragraph_index, count DESC
      `, [chapterKey]);

      let mine = [];
      if (session) {
        const myRows = await pool.query(
          "SELECT paragraph_index, emoji FROM paragraph_reactions WHERE user_id=$1 AND novel_id='threadborn' AND chapter_key=$2",
          [session.user_id, chapterKey]
        );
        mine = myRows.rows;
      }

      return success(res, { reactions: rows, mine });
    }

    if (req.method === "POST") {
      const session = await requireSession(req, res, fail);
      if (!session) return;
      if (!validateCsrf(req, session)) return fail(res, 403, "Invalid CSRF token");

      const body = await parseJsonBody(req);
      const chapterKey = String(body.chapter_key || "").trim();
      const paragraphIndex = Number(body.paragraph_index);
      const emoji = String(body.emoji || "");

      if (!chapterKey || !Number.isInteger(paragraphIndex) || paragraphIndex < 0) return fail(res, 400, "Invalid payload");
      if (!ALLOWED_EMOJIS.has(emoji)) return fail(res, 400, "Invalid emoji");

      const existing = await pool.query(
        "SELECT id FROM paragraph_reactions WHERE user_id=$1 AND chapter_key=$2 AND paragraph_index=$3 AND emoji=$4",
        [session.user_id, chapterKey, paragraphIndex, emoji]
      );

      if (existing.rows.length) {
        await pool.query("DELETE FROM paragraph_reactions WHERE id=$1", [existing.rows[0].id]);
        return success(res, { toggled: false });
      }

      await pool.query(
        "INSERT INTO paragraph_reactions (user_id, novel_id, chapter_key, paragraph_index, emoji) VALUES ($1,'threadborn',$2,$3,$4)",
        [session.user_id, chapterKey, paragraphIndex, emoji]
      );
      return success(res, { toggled: true });
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Paragraph reactions unavailable");
  }
};
