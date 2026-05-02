const { put, del } = require("@vercel/blob");
const pool = require("../lib/api/db");
const { allowCors, success, fail } = require("../lib/api/http");
const { parseJsonBody, getClientIp } = require("../lib/api/request");
const { takeRateLimitToken } = require("../lib/api/rate-limit");
const { requireSession, validateCsrf, getSession } = require("../lib/api/auth");
const { sendPushBroadcast } = require("../lib/api/push");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }

  if (!process.env.DATABASE_URL) {
    return fail(res, 503, "Missing DATABASE_URL environment variable");
  }

  try {
    await pool.ensureMigrations();

    // Parse action from query or default to config
    const action = req.query.action || "config";

    if (action === "config") {
      const lang = req.query.lang || "en";
      const configKey =
        lang === "ja" ? "global_settings_jp" : "global_settings";

      if (req.method === "GET") {
        const { rows } = await pool.query(
          "select value from dashboard_config where key = $1",
          [configKey],
        );
        if (!rows.length) {
          return success(res, {
            notification: "",
            notifications: [],
            countdowns: [],
            countdown: { title: "", target_date: "" },
          });
        }
        return success(res, rows[0].value);
      }

      if (req.method === "POST" || req.method === "PUT") {
        const session = await requireSession(req, res, fail);
        if (!session) return;

        if (session.role !== "owner") {
          return fail(res, 403, "Only the owner can update dashboard config");
        }

        if (!validateCsrf(req, session)) {
          return fail(res, 403, "Invalid CSRF token");
        }

        const body = await parseJsonBody(req);
        const payload = {
          notification: String(body.notification || ""), // legacy fallback
          notifications: Array.isArray(body.notifications)
            ? body.notifications.map((n) => String(n))
            : [],
          countdowns: Array.isArray(body.countdowns)
            ? body.countdowns
            : body.countdown && body.countdown.title
              ? [body.countdown]
              : [],
          countdown: {
            title: String(body.countdown?.title || ""),
            target_date: String(body.countdown?.target_date || ""),
          },
        };

        await pool.query(
          `insert into dashboard_config (key, value, updated_at)
           values ($1, $2, now())
           on conflict (key) do update set value = $2, updated_at = now()`,
          [configKey, payload],
        );

        // Broadcast push notification to all subscribers when an announcement is saved
        if (
          Array.isArray(payload.notifications) &&
          payload.notifications.length > 0
        ) {
          sendPushBroadcast(pool, {
            title: "📢 Threadborn — New Announcement",
            body: String(payload.notifications[0]).slice(0, 100),
            tag: "announcement",
            url: "/?view=community",
          }).catch(() => {});
        }

        return success(res, payload);
      }
    }

    if (action === "art") {
      // GET: Publicly list all art
      if (req.method === "GET") {
        const { rows } = await pool.query(
          "select id, character_name, url, label from dashboard_art order by created_at desc",
        );
        return success(res, { art: rows });
      }

      // Must be logged in as owner for POST and DELETE
      const session = await requireSession(req, res, fail);
      if (!session) return;

      if (session.role !== "owner") {
        return fail(res, 403, "Only the owner can modify art");
      }

      if (!validateCsrf(req, session)) {
        return fail(res, 403, "Invalid CSRF token");
      }

      // POST: Upload new art
      if (req.method === "POST") {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return fail(res, 503, "Missing BLOB_READ_WRITE_TOKEN");
        }

        const body = await parseJsonBody(req);
        const characterName = String(body.characterName || "").trim();
        const label = String(body.label || "").trim();
        const dataUrl = String(body.dataUrl || "");

        if (!characterName) {
          return fail(res, 400, "Character name is required");
        }

        if (!dataUrl.startsWith("data:image/")) {
          return fail(res, 400, "Invalid image payload");
        }

        const [meta, base64] = dataUrl.split(",");
        const typeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(meta);
        if (!typeMatch || !base64) {
          return fail(res, 400, "Invalid image format");
        }

        const contentType = typeMatch[1];
        const bytes = Buffer.from(base64, "base64");

        if (bytes.length > 5 * 1024 * 1024) {
          return fail(res, 400, "Image too large (max 5MB)");
        }

        const ext = contentType.includes("png") ? "png" : "jpg";
        const fileName = `art/${characterName.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${Date.now()}.${ext}`;

        const blob = await put(fileName, bytes, {
          access: "public",
          addRandomSuffix: true,
          contentType,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });

        const { rows } = await pool.query(
          `insert into dashboard_art (character_name, url, label, created_at)
           values ($1, $2, $3, now()) returning id, character_name, url, label`,
          [characterName, blob.url, label],
        );

        return success(res, { art: rows[0] });
      }

      // DELETE: Remove art
      if (req.method === "DELETE") {
        const body = await parseJsonBody(req);
        const id = String(body.id || "");
        if (!id) return fail(res, 400, "Missing art ID");

        const { rows } = await pool.query(
          "select url from dashboard_art where id = $1",
          [id],
        );
        if (rows.length > 0) {
          try {
            if (process.env.BLOB_READ_WRITE_TOKEN) {
              await del(rows[0].url, {
                token: process.env.BLOB_READ_WRITE_TOKEN,
              });
            }
          } catch (e) {
            console.error("[dashboard] blob delete failed:", e);
          }
          await pool.query("delete from dashboard_art where id = $1", [id]);
        }
        return success(res, { deleted: true });
      }
    }

    if (action === "polls") {
      // GET: Fetch active polls for a given language
      if (req.method === "GET") {
        const lang = req.query.lang || "en";
        const { rows: polls } = await pool.query(
          "select id, question, created_at from polls where is_active = true and lang = $1 order by created_at desc",
          [lang],
        );

        if (polls.length > 0) {
          const pollIds = polls.map((p) => p.id);
          const { rows: allOptions } = await pool.query(
            "select id, poll_id, option_text, votes from poll_options where poll_id = any($1::uuid[]) order by id asc",
            [pollIds],
          );
          const optionsByPoll = allOptions.reduce((acc, opt) => {
            if (!acc[opt.poll_id]) acc[opt.poll_id] = [];
            acc[opt.poll_id].push({
              id: opt.id,
              option_text: opt.option_text,
              votes: opt.votes,
            });
            return acc;
          }, {});
          for (const poll of polls) {
            poll.options = optionsByPoll[poll.id] || [];
          }
        }

        return success(res, { polls });
      }

      // POST: Vote on a poll
      if (req.method === "POST") {
        const ip = getClientIp(req);
        if (!takeRateLimitToken(`poll_vote:${ip}`, 10, 60_000)) {
          return fail(res, 429, "Too many votes, please try again later");
        }
        const body = await parseJsonBody(req);
        const optionId = String(body.optionId || "");
        if (!optionId) return fail(res, 400, "Missing option ID");

        const result = await pool.query(
          "update poll_options set votes = votes + 1 where id = $1 and poll_id in (select id from polls where is_active = true)",
          [optionId],
        );
        if (result.rowCount === 0) {
          return fail(res, 404, "Poll option not found");
        }
        return success(res, { voted: true });
      }

      // Must be logged in as owner for PUT and DELETE
      const session = await requireSession(req, res, fail);
      if (!session) return;

      if (session.role !== "owner") {
        return fail(res, 403, "Only the owner can modify polls");
      }

      if (!validateCsrf(req, session)) {
        return fail(res, 403, "Invalid CSRF token");
      }

      // PUT: Create a new poll
      if (req.method === "PUT") {
        const body = await parseJsonBody(req);
        const question = String(body.question || "").trim();
        const lang = String(body.lang || "en").trim();
        const options = Array.isArray(body.options) ? body.options : [];

        if (!question || options.length < 2) {
          return fail(
            res,
            400,
            "Poll must have a question and at least 2 options",
          );
        }

        const client = await pool.connect();
        let pollId;
        try {
          await client.query("begin");
          const { rows } = await client.query(
            "insert into polls (question, lang, is_active) values ($1, $2, true) returning id",
            [question, lang],
          );
          pollId = rows[0].id;
          for (const opt of options) {
            await client.query(
              "insert into poll_options (poll_id, option_text, votes) values ($1, $2, 0)",
              [pollId, String(opt).trim()],
            );
          }
          await client.query("commit");
        } catch (txErr) {
          await client.query("rollback");
          throw txErr;
        } finally {
          client.release();
        }
        return success(res, { created: true, pollId });
      }

      // DELETE: Remove a poll
      if (req.method === "DELETE") {
        const body = await parseJsonBody(req);
        const id = String(body.id || "");
        if (!id) return fail(res, 400, "Missing poll ID");

        await pool.query("delete from polls where id = $1", [id]);
        return success(res, { deleted: true });
      }
    }

    if (action === "clear_all") {
      if (req.method === "POST") {
        const session = await requireSession(req, res, fail);
        if (!session || session.role !== "owner") {
          return fail(res, 403, "Only owner can clear data");
        }
        if (!validateCsrf(req, session)) {
          return fail(res, 403, "Invalid CSRF token");
        }
        const body2 = await parseJsonBody(req);
        if (body2.confirm !== "DELETE_ALL_DATA") {
          return fail(
            res,
            400,
            "Missing confirmation — send { confirm: 'DELETE_ALL_DATA' }",
          );
        }
        await pool.query("truncate dashboard_config");
        await pool.query("truncate dashboard_art");
        await pool.query("truncate polls cascade");
        return success(res, { cleared: true });
      }
    }

    if (action === "unlocks") {
      const lang = req.query.lang || "en";
      if (req.method === "GET") {
        const session = await getSession(req).catch(() => null);
        const { rows: milestones } = await pool.query(
          "SELECT id, title, description, unlock_type, target_votes, current_votes, is_unlocked, unlock_content FROM unlock_milestones WHERE lang=$1 ORDER BY created_at ASC",
          [lang],
        );
        let myVotes = new Set();
        if (session) {
          const vr = await pool.query(
            "SELECT milestone_id FROM unlock_votes WHERE user_id=$1",
            [session.user_id],
          );
          myVotes = new Set(vr.rows.map((r) => r.milestone_id));
        }
        return success(res, {
          milestones: milestones.map((m) => ({
            ...m,
            voted: myVotes.has(m.id),
          })),
        });
      }
      if (req.method === "POST") {
        const session = await requireSession(req, res, fail);
        if (!session) return;
        if (!validateCsrf(req, session))
          return fail(res, 403, "Invalid CSRF token");
        const body = await parseJsonBody(req);
        const milestoneId = String(body.milestoneId || "");
        if (!milestoneId) return fail(res, 400, "milestoneId required");
        const existing = await pool.query(
          "SELECT id FROM unlock_votes WHERE user_id=$1 AND milestone_id=$2",
          [session.user_id, milestoneId],
        );
        if (existing.rows.length) return fail(res, 409, "Already voted");
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(
            "INSERT INTO unlock_votes (user_id, milestone_id) VALUES ($1,$2)",
            [session.user_id, milestoneId],
          );
          const updated = await client.query(
            "UPDATE unlock_milestones SET current_votes=current_votes+1, updated_at=now(), is_unlocked=(current_votes+1 >= target_votes) WHERE id=$1 RETURNING current_votes, target_votes, is_unlocked",
            [milestoneId],
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
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Failed to manage dashboard");
  }
};
