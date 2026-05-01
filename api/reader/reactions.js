const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody } = require("../../lib/api/request");
const { getSession, requireSession, validateCsrf } = require("../../lib/api/auth");

function cleanText(value, max = 2000) {
  return String(value || "").trim().slice(0, max);
}

function cleanTarget(input) {
  const targetType = cleanText(input.targetType || input.target_type, 20).toLowerCase();
  const volumeId = cleanText(input.volumeId || input.volume_id, 120);
  const chapterId = cleanText(input.chapterId || input.chapter_id, 160);
  if (!["volume", "chapter"].includes(targetType) || !volumeId) {
    return null;
  }
  if (targetType === "chapter" && !chapterId) {
    return null;
  }
  return {
    targetType,
    volumeId,
    chapterId: targetType === "chapter" ? chapterId : null
  };
}

function rowToReaction(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    volumeId: row.volume_id,
    chapterId: row.chapter_id || "",
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    category: row.category,
    content: row.content || "",
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      username: row.username || "Reader",
      avatarUrl: row.avatar_url || "",
      verified: !!row.verified,
      role: row.role || "user"
    }
  };
}

function rowToSummary(row) {
  const avg = row.average_rating === null || row.average_rating === undefined ? null : Number(row.average_rating);
  return {
    targetType: row.target_type,
    volumeId: row.volume_id,
    chapterId: row.chapter_id || "",
    averageRating: avg === null ? null : Math.round(avg * 10) / 10,
    ratingCount: Number(row.rating_count || 0),
    commentCount: Number(row.comment_count || 0)
  };
}

async function loadSummaries() {
  const { rows } = await pool.query(`
    select target_type, volume_id, coalesce(chapter_id, '') as chapter_id,
           avg(rating) filter (where rating is not null) as average_rating,
           count(rating)::int as rating_count,
           count(*)::int as comment_count
    from reader_reactions
    where novel_id = 'threadborn'
    group by target_type, volume_id, coalesce(chapter_id, '')
  `);
  return rows.map(rowToSummary);
}

async function loadTarget(target, limit) {
  const { rows } = await pool.query(`
    select rr.id, rr.user_id, rr.target_type, rr.volume_id, rr.chapter_id, rr.rating, rr.category, rr.content, rr.created_at,
           u.username, u.avatar_url, u.verified, u.role
    from reader_reactions rr
    join users u on u.id = rr.user_id
    where rr.novel_id = 'threadborn'
      and rr.target_type = $1
      and rr.volume_id = $2
      and coalesce(rr.chapter_id, '') = coalesce($3, '')
    order by rr.created_at desc
    limit $4
  `, [target.targetType, target.volumeId, target.chapterId || "", limit]);

  const summaryRows = await pool.query(`
    select target_type, volume_id, coalesce(chapter_id, '') as chapter_id,
           avg(rating) filter (where rating is not null) as average_rating,
           count(rating)::int as rating_count,
           count(*)::int as comment_count
    from reader_reactions
    where novel_id = 'threadborn'
      and target_type = $1
      and volume_id = $2
      and coalesce(chapter_id, '') = coalesce($3, '')
    group by target_type, volume_id, coalesce(chapter_id, '')
  `, [target.targetType, target.volumeId, target.chapterId || ""]);

  return {
    summary: summaryRows.rows[0] ? rowToSummary(summaryRows.rows[0]) : {
      targetType: target.targetType,
      volumeId: target.volumeId,
      chapterId: target.chapterId || "",
      averageRating: null,
      ratingCount: 0,
      commentCount: 0
    },
    reactions: rows.map(rowToReaction)
  };
}

async function loadMine(session) {
  const { rows } = await pool.query(`
    select rr.id, rr.user_id, rr.target_type, rr.volume_id, rr.chapter_id, rr.rating, rr.category, rr.content, rr.created_at,
           u.username, u.avatar_url, u.verified, u.role
    from reader_reactions rr
    join users u on u.id = rr.user_id
    where rr.user_id = $1
    order by rr.created_at desc
    limit 50
  `, [session.user_id]);
  return rows.map(rowToReaction);
}

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (!process.env.DATABASE_URL) {
    if (req.method === "GET") {
      success(res, { summaries: [], reactions: [], summary: null, mine: [] });
      return;
    }
    fail(res, 503, "Missing DATABASE_URL environment variable");
    return;
  }

  try {
    await pool.ensureMigrations();

    if (req.method === "GET") {
      const query = req.query || {};
      const limit = Math.max(1, Math.min(50, Number(query.limit || 20)));
      const session = await getSession(req).catch(() => null);
      if (query.mine === "1" || query.mine === "true") {
        if (!session) {
          fail(res, 401, "Unauthorized");
          return;
        }
        success(res, { mine: await loadMine(session) });
        return;
      }
      if (query.summary === "1" || query.summary === "true") {
        success(res, { summaries: await loadSummaries() });
        return;
      }
      const target = cleanTarget(query);
      if (!target) {
        success(res, { summaries: await loadSummaries(), reactions: [] });
        return;
      }
      success(res, await loadTarget(target, limit));
      return;
    }

    if (req.method !== "POST" && req.method !== "DELETE") {
      fail(res, 405, "Method not allowed");
      return;
    }

    const session = await requireSession(req, res, fail);
    if (!session) {
      return;
    }
    if (!validateCsrf(req, session)) {
      fail(res, 403, "Invalid CSRF token");
      return;
    }

    const body = await parseJsonBody(req);
    if (req.method === "DELETE") {
      if (session.role !== "owner" && session.role !== "admin") {
        fail(res, 403, "Only owner/admin can delete reactions");
        return;
      }
      const reactionId = cleanText(body.reactionId, 80);
      if (!reactionId) {
        fail(res, 400, "reactionId is required");
        return;
      }
      await pool.query("delete from reader_reactions where id = $1", [reactionId]);
      success(res, { ok: true });
      return;
    }

    const target = cleanTarget(body);
    const category = cleanText(body.category, 20).toLowerCase() || "comment";
    const content = cleanText(body.content, 1600);
    const ratingRaw = body.rating === "" || body.rating === undefined || body.rating === null ? null : Number(body.rating);
    const rating = Number.isFinite(ratingRaw) ? Math.max(1, Math.min(5, Math.round(ratingRaw))) : null;

    if (!target || !["comment", "theory", "spoiler"].includes(category)) {
      fail(res, 400, "Invalid reaction target");
      return;
    }
    if (!content && rating === null) {
      fail(res, 400, "Write a comment or choose a rating");
      return;
    }

    const { rows } = await pool.query(`
      insert into reader_reactions (user_id, novel_id, target_type, volume_id, chapter_id, rating, category, content, updated_at)
      values ($1, 'threadborn', $2, $3, $4, $5, $6, $7, now())
      returning id
    `, [session.user_id, target.targetType, target.volumeId, target.chapterId, rating, category, content]);

    success(res, { reactionId: rows[0].id }, 201);
  } catch (error) {
    fail(res, 500, "Reader reactions unavailable");
  }
};
