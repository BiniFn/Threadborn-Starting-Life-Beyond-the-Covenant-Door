const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");
const { sendPushToUser } = require("../../lib/api/push");

// ── Badge definitions ─────────────────────────────────────────────────────────
const BADGES = {
  first_chapter: {
    label: "First Steps",
    icon: "📖",
    desc: "Read your first chapter",
  },
  volume1_complete: {
    label: "Volume I Complete",
    icon: "⚔️",
    desc: "Finished Volume 1",
  },
  volume2_started: {
    label: "Into the Door",
    icon: "🚪",
    desc: "Started Volume 2",
  },
  ex_reader: { label: "Lore Seeker", icon: "📜", desc: "Read the EX Novel" },
  streak_3: { label: "3-Day Streak", icon: "🔥", desc: "Read 3 days in a row" },
  streak_7: { label: "Week Warrior", icon: "🗡️", desc: "Read 7 days in a row" },
  streak_30: {
    label: "Devoted Reader",
    icon: "👑",
    desc: "Read 30 days in a row",
  },
  bookmarker: {
    label: "Bookmarker",
    icon: "🔖",
    desc: "Created your first bookmark",
  },
  reactor: {
    label: "First Reaction",
    icon: "❤️",
    desc: "Left your first reaction",
  },
  commenter: {
    label: "Community Voice",
    icon: "💬",
    desc: "Posted in the community",
  },
  all_volumes: {
    label: "Chronicle Complete",
    icon: "🌟",
    desc: "Read all available volumes",
  },
};

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;

  const action = req.query?.action || "";

  // ── Badges + Streaks ────────────────────────────────────────────────────────
  if (action === "badges") {
    if (!takeRateLimitToken(`badges:${getClientIp(req)}`, 30, 60_000))
      return fail(res, 429, "Too many requests");
    const session = await requireSession(req, res, fail);
    if (!session) return;
    if (!process.env.DATABASE_URL)
      return fail(res, 503, "Missing DATABASE_URL");
    try {
      await pool.ensureMigrations();
      if (req.method === "GET") {
        const [br, sr] = await Promise.all([
          pool.query(
            "SELECT badge_key, earned_at FROM reader_badges WHERE user_id=$1 ORDER BY earned_at DESC",
            [session.user_id],
          ),
          pool.query(
            "SELECT current_streak, longest_streak, last_read_date, total_days_read FROM reader_streaks WHERE user_id=$1",
            [session.user_id],
          ),
        ]);
        const earned = new Set(br.rows.map((r) => r.badge_key));
        const badges = Object.entries(BADGES).map(([key, meta]) => ({
          key,
          ...meta,
          earned: earned.has(key),
          earned_at:
            br.rows.find((r) => r.badge_key === key)?.earned_at || null,
        }));
        const streak = sr.rows[0] || {
          current_streak: 0,
          longest_streak: 0,
          last_read_date: null,
          total_days_read: 0,
        };
        return success(res, { badges, streak });
      }
      if (req.method === "POST") {
        const body = await parseJsonBody(req);
        const { activity } = body;
        if (!activity) return fail(res, 400, "Missing activity");
        const today = new Date().toISOString().slice(0, 10);
        const sr = await pool.query(
          "SELECT * FROM reader_streaks WHERE user_id=$1",
          [session.user_id],
        );
        let cs = 1,
          ls = 1,
          td = 1;
        if (sr.rows.length) {
          const s = sr.rows[0];
          const last = s.last_read_date
            ? new Date(s.last_read_date).toISOString().slice(0, 10)
            : null;
          if (last === today) {
            cs = s.current_streak;
            ls = s.longest_streak;
            td = s.total_days_read;
          } else {
            const yest = new Date(Date.now() - 86400000)
              .toISOString()
              .slice(0, 10);
            cs = last === yest ? s.current_streak + 1 : 1;
            ls = Math.max(s.longest_streak, cs);
            td = s.total_days_read + 1;
          }
        }
        await pool.query(
          `INSERT INTO reader_streaks (user_id,current_streak,longest_streak,last_read_date,total_days_read,updated_at)
           VALUES ($1,$2,$3,$4,$5,now())
           ON CONFLICT (user_id) DO UPDATE SET
             current_streak=$2, longest_streak=$3, last_read_date=$4, total_days_read=$5, updated_at=now()`,
          [session.user_id, cs, ls, today, td],
        );
        const toAward = [];
        if (activity === "chapter_read") toAward.push("first_chapter");
        if (activity === "volume1_complete") toAward.push("volume1_complete");
        if (activity === "volume2_started") toAward.push("volume2_started");
        if (activity === "ex_read") toAward.push("ex_reader");
        if (activity === "bookmark_created") toAward.push("bookmarker");
        if (activity === "reaction_posted") toAward.push("reactor");
        if (activity === "community_post") toAward.push("commenter");
        if (cs >= 3) toAward.push("streak_3");
        if (cs >= 7) toAward.push("streak_7");
        if (cs >= 30) toAward.push("streak_30");
        const newBadges = [];
        for (const key of toAward) {
          try {
            const result = await pool.query(
              "INSERT INTO reader_badges (user_id,badge_key) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING badge_key",
              [session.user_id, key],
            );
            if (result.rowCount > 0) {
              newBadges.push({ key, ...BADGES[key] });
              // Create in-app notification for the newly earned badge
              pool
                .query(
                  "INSERT INTO notifications (user_id,type,title,body) VALUES ($1,'badge',$2,$3)",
                  [
                    session.user_id,
                    `🏅 Badge Earned: ${BADGES[key].label}`,
                    BADGES[key].desc,
                  ],
                )
                .catch(() => {});
              // Send OS-level push notification
              sendPushToUser(pool, session.user_id, {
                title: `🏅 ${BADGES[key].label}`,
                body: BADGES[key].desc,
                tag: `badge-${key}`,
                url: "/?view=stats",
              }).catch(() => {});
            }
          } catch (_) {}
        }
        return success(res, {
          newBadges,
          streak: {
            current_streak: cs,
            longest_streak: ls,
            total_days_read: td,
          },
        });
      }
      return fail(res, 405, "Method not allowed");
    } catch (error) {
      return fail(res, 500, "Badges unavailable");
    }
  }

  // ── Reading Analytics (original handler) ────────────────────────────────────
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
