const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody } = require("../../lib/api/request");
const { requireSession } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    await pool.ensureMigrations();

    if (req.method === "GET") {
      const { rows } = await pool.query("select value from dashboard_config where key = 'global_settings'");
      if (!rows.length) {
        return success(res, { notification: "", countdown: { title: "", target_date: "" } });
      }
      return success(res, rows[0].value);
    }

    if (req.method === "POST" || req.method === "PUT") {
      const session = await requireSession(req, res, fail);
      if (!session) return;
      
      if (session.role !== "owner") {
        return fail(res, 403, "Only the owner can update dashboard config");
      }

      const body = await parseJsonBody(req);
      const payload = {
        notification: String(body.notification || ""),
        countdown: {
          title: String(body.countdown?.title || ""),
          target_date: String(body.countdown?.target_date || "")
        }
      };

      await pool.query(
        `insert into dashboard_config (key, value, updated_at) 
         values ('global_settings', $1, now()) 
         on conflict (key) do update set value = $1, updated_at = now()`,
        [payload]
      );

      return success(res, payload);
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Failed to load dashboard config");
  }
};
