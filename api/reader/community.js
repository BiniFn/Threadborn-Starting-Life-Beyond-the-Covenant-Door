const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

function cleanText(value, max = 2000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (!takeRateLimitToken(`community:${getClientIp(req)}`, 30, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }
  await pool.ensureMigrations();

  const meResult = await pool.query(
    "select role, coalesce(verified, false) as verified, community_banned_until, community_ban_reason from users where id = $1 limit 1",
    [session.user_id],
  );
  const me = meResult.rows[0] || null;
  const isModerator = !!me && (me.role === "owner" || me.role === "admin");
  const isCommunityBanned = !!(
    me &&
    me.community_banned_until &&
    new Date(me.community_banned_until).getTime() > Date.now()
  );

  if (req.method === "GET") {
    const limit = Math.max(1, Math.min(30, Number(req.query?.limit || 12)));
    const offset = Math.max(0, Number(req.query?.offset || 0));
    const postsResult = await pool.query(
      `
      select
        p.id, p.user_id, p.title, p.content, p.image_url, p.category, p.created_at,
        u.username, u.avatar_url, u.verified, u.role,
        coalesce(l.like_count, 0)::int as like_count,
        coalesce(c.comment_count, 0)::int as comment_count,
        exists(select 1 from likes ul where ul.post_id = p.id and ul.user_id = $1) as liked_by_me
      from posts p
      join users u on u.id = p.user_id
      left join (
        select post_id, count(*) as like_count from likes group by post_id
      ) l on l.post_id = p.id
      left join (
        select post_id, count(*) as comment_count from comments group by post_id
      ) c on c.post_id = p.id
      order by p.created_at desc
      limit $2 offset $3
      `,
      [session.user_id, limit, offset],
    );

    const ids = postsResult.rows.map((post) => post.id);
    let commentsByPost = {};
    if (ids.length) {
      const commentsResult = await pool.query(
        `
        select c.id, c.post_id, c.content, c.created_at, c.user_id, u.username, u.avatar_url, u.verified, u.role
        from comments c
        join users u on u.id = c.user_id
        where c.post_id = any($1::uuid[])
        order by c.created_at asc
        limit 200
        `,
        [ids],
      );
      commentsByPost = commentsResult.rows.reduce((acc, row) => {
        if (!acc[row.post_id]) {
          acc[row.post_id] = [];
        }
        acc[row.post_id].push(row);
        return acc;
      }, {});
    }

    success(res, {
      moderation: {
        isModerator,
        isCommunityBanned,
        bannedUntil: me?.community_banned_until || null,
        banReason: me?.community_ban_reason || "",
      },
      posts: postsResult.rows.map((post) => ({
        ...post,
        comments: commentsByPost[post.id] || [],
      })),
    });
    return;
  }

  if (!validateCsrf(req, session)) {
    fail(res, 403, "Invalid CSRF token");
    return;
  }

  const body = await parseJsonBody(req);
  const action = cleanText(body.action, 40).toLowerCase();

  if (req.method === "POST" && action === "ban_user") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can ban users");
      return;
    }
    const username = cleanText(body.username, 64).toLowerCase();
    const reason = cleanText(body.reason, 220) || "Community rules violation";
    const hours = Math.max(1, Math.min(24 * 365, Number(body.hours) || 24));
    if (!username) {
      fail(res, 400, "username is required");
      return;
    }
    const target = await pool.query(
      "select id, role from users where lower(username) = $1 limit 1",
      [username],
    );
    if (!target.rowCount) {
      fail(res, 404, "User not found");
      return;
    }
    const targetUser = target.rows[0];
    if (targetUser.role === "owner") {
      fail(res, 403, "Owner cannot be banned");
      return;
    }
    await pool.query(
      `update users
       set community_banned_until = now() + ($2 || ' hour')::interval,
           community_ban_reason = $3,
           updated_at = now()
       where id = $1`,
      [targetUser.id, String(hours), reason],
    );
    success(res, { ok: true });
    return;
  }

  if (req.method === "POST" && action === "unban_user") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can unban users");
      return;
    }
    const username = cleanText(body.username, 64).toLowerCase();
    if (!username) {
      fail(res, 400, "username is required");
      return;
    }
    await pool.query(
      `update users
       set community_banned_until = null,
           community_ban_reason = null,
           updated_at = now()
       where lower(username) = $1`,
      [username],
    );
    success(res, { ok: true });
    return;
  }

  if (
    isCommunityBanned &&
    (action === "create_post" ||
      action === "toggle_like" ||
      action === "add_comment")
  ) {
    fail(
      res,
      403,
      `You are banned from community interactions until ${new Date(me.community_banned_until).toLocaleString()}`,
    );
    return;
  }

  if (req.method === "POST" && action === "create_post") {
    const title = cleanText(body.title, 120);
    const content = cleanText(body.content, 3000);
    const imageUrl = cleanText(body.imageUrl, 800);
    const category = cleanText(body.category, 30);
    if (
      !title ||
      !content ||
      !["fan_art", "theory", "spoiler"].includes(category)
    ) {
      fail(res, 400, "Invalid post payload");
      return;
    }
    const { rows } = await pool.query(
      `insert into posts (user_id, title, content, image_url, category, created_at, updated_at)
       values ($1,$2,$3,$4,$5,now(),now())
       returning id`,
      [session.user_id, title, content, imageUrl || null, category],
    );
    success(res, { postId: rows[0].id }, 201);
    return;
  }

  if (req.method === "POST" && action === "toggle_like") {
    const postId = cleanText(body.postId, 80);
    if (!postId) {
      fail(res, 400, "postId is required");
      return;
    }
    const existing = await pool.query(
      "select 1 from likes where user_id = $1 and post_id = $2",
      [session.user_id, postId],
    );
    if (existing.rowCount) {
      await pool.query(
        "delete from likes where user_id = $1 and post_id = $2",
        [session.user_id, postId],
      );
      success(res, { liked: false });
    } else {
      await pool.query("insert into likes (user_id, post_id) values ($1, $2)", [
        session.user_id,
        postId,
      ]);
      success(res, { liked: true });
    }
    return;
  }

  if (req.method === "POST" && action === "add_comment") {
    const postId = cleanText(body.postId, 80);
    const content = cleanText(body.content, 1200);
    if (!postId || !content) {
      fail(res, 400, "postId and content are required");
      return;
    }
    const { rows } = await pool.query(
      `insert into comments (post_id, user_id, content, created_at, updated_at)
       values ($1,$2,$3,now(),now())
       returning id`,
      [postId, session.user_id, content],
    );
    success(res, { commentId: rows[0].id }, 201);
    return;
  }

  if (req.method === "POST" && action === "delete_post") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can delete posts");
      return;
    }
    const postId = cleanText(body.postId, 80);
    if (!postId) {
      fail(res, 400, "postId is required");
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from likes where post_id = $1", [postId]);
      await client.query("delete from comments where post_id = $1", [postId]);
      await client.query("delete from posts where id = $1", [postId]);
      await client.query("commit");
    } catch (txErr) {
      await client.query("rollback");
      throw txErr;
    } finally {
      client.release();
    }
    success(res, { ok: true });
    return;
  }

  if (req.method === "POST" && action === "delete_comment") {
    if (!isModerator) {
      fail(res, 403, "Only owner/admin can delete comments");
      return;
    }
    const commentId = cleanText(body.commentId, 80);
    if (!commentId) {
      fail(res, 400, "commentId is required");
      return;
    }
    await pool.query("delete from comments where id = $1", [commentId]);
    success(res, { ok: true });
    return;
  }

  fail(res, 405, "Method not allowed");
};
