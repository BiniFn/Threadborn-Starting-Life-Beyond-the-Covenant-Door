const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession } = require("../../lib/api/auth");

const BADGES = {
  first_chapter: { label: "First Steps", icon: "📖", desc: "Read your first chapter" },
  volume1_complete: { label: "Volume I Complete", icon: "⚔️", desc: "Finished Volume 1" },
  volume2_started: { label: "Into the Door", icon: "🚪", desc: "Started Volume 2" },
  ex_reader: { label: "Lore Seeker", icon: "📜", desc: "Read the EX Novel" },
  streak_3: { label: "3-Day Streak", icon: "🔥", desc: "Read 3 days in a row" },
  streak_7: { label: "Week Warrior", icon: "🗡️", desc: "Read 7 days in a row" },
  streak_30: { label: "Devoted Reader", icon: "👑", desc: "Read 30 days in a row" },
  bookmarker: { label: "Bookmarker", icon: "🔖", desc: "Created your first bookmark" },
  reactor: { label: "First Reaction", icon: "❤️", desc: "Left your first reaction" },
  commenter: { label: "Community Voice", icon: "💬", desc: "Posted in the community" },
  all_volumes: { label: "Chronicle Complete", icon: "🌟", desc: "Read all available volumes" },
};

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;
  if (!takeRateLimitToken(`badges:${getClientIp(req)}`, 30, 60_000)) {
    return fail(res, 429, "Too many requests");
  }

  const session = await requireSession(req, res, fail);
  if (!session) return;

  if (!process.env.DATABASE_URL) return fail(res, 503, "Missing DATABASE_URL");

  try {
    await pool.ensureMigrations();

    if (req.method === "GET") {
      const [badgesResult, streakResult] = await Promise.all([
        pool.query("SELECT badge_key, earned_at FROM reader_badges WHERE user_id = $1 ORDER BY earned_at DESC", [session.user_id]),
        pool.query("SELECT current_streak, longest_streak, last_read_date, total_days_read FROM reader_streaks WHERE user_id = $1", [session.user_id]),
      ]);

      const earnedKeys = new Set(badgesResult.rows.map(r => r.badge_key));
      const badges = Object.entries(BADGES).map(([key, meta]) => ({
        key,
        ...meta,
        earned: earnedKeys.has(key),
        earned_at: badgesResult.rows.find(r => r.badge_key === key)?.earned_at || null,
      }));

      const streak = streakResult.rows[0] || { current_streak: 0, longest_streak: 0, last_read_date: null, total_days_read: 0 };

      return success(res, { badges, streak });
    }

    // POST: record a reading activity and award badges
    if (req.method === "POST") {
      const { activity } = req.body ? (typeof req.body === "object" ? req.body : JSON.parse(req.body)) : {};
      if (!activity) return fail(res, 400, "Missing activity");

      // Update streak
      const today = new Date().toISOString().slice(0, 10);
      const streakRow = await pool.query("SELECT * FROM reader_streaks WHERE user_id = $1", [session.user_id]);

      let currentStreak = 1;
      let longestStreak = 1;
      let totalDays = 1;

      if (streakRow.rows.length) {
        const s = streakRow.rows[0];
        const lastDate = s.last_read_date ? new Date(s.last_read_date).toISOString().slice(0, 10) : null;
        if (lastDate === today) {
          currentStreak = s.current_streak;
          longestStreak = s.longest_streak;
          totalDays = s.total_days_read;
        } else {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          currentStreak = lastDate === yesterday ? s.current_streak + 1 : 1;
          longestStreak = Math.max(s.longest_streak, currentStreak);
          totalDays = s.total_days_read + 1;
        }
      }

      await pool.query(`
        INSERT INTO reader_streaks (user_id, current_streak, longest_streak, last_read_date, total_days_read, updated_at)
        VALUES ($1,$2,$3,$4,$5,now())
        ON CONFLICT (user_id) DO UPDATE SET
          current_streak=$2, longest_streak=$3, last_read_date=$4, total_days_read=$5, updated_at=now()
      `, [session.user_id, currentStreak, longestStreak, today, totalDays]);

      // Award badges based on activity
      const toAward = [];
      if (activity === "chapter_read") toAward.push("first_chapter");
      if (activity === "volume1_complete") toAward.push("volume1_complete");
      if (activity === "volume2_started") toAward.push("volume2_started");
      if (activity === "ex_read") toAward.push("ex_reader");
      if (activity === "bookmark_created") toAward.push("bookmarker");
      if (activity === "reaction_posted") toAward.push("reactor");
      if (activity === "community_post") toAward.push("commenter");
      if (currentStreak >= 3) toAward.push("streak_3");
      if (currentStreak >= 7) toAward.push("streak_7");
      if (currentStreak >= 30) toAward.push("streak_30");

      const newBadges = [];
      for (const key of toAward) {
        try {
          await pool.query("INSERT INTO reader_badges (user_id, badge_key) VALUES ($1,$2) ON CONFLICT DO NOTHING", [session.user_id, key]);
          newBadges.push({ key, ...BADGES[key] });
        } catch (e) { /* ignore */ }
      }

      return success(res, { newBadges, streak: { current_streak: currentStreak, longest_streak: longestStreak, total_days_read: totalDays } });
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Badges unavailable");
  }
};
