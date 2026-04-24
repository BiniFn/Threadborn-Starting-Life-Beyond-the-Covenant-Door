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
    const { rows } = await pool.query(
      "select settings_json from user_settings where user_id = $1 limit 1",
      [session.user_id]
    );
    success(res, { settings: rows[0]?.settings_json || {} });
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
  const settings = typeof body.settings === "object" && body.settings ? body.settings : {};
  const { rows } = await pool.query(
    `insert into user_settings (user_id, settings_json, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (user_id)
     do update set settings_json = excluded.settings_json, updated_at = now()
     returning settings_json`,
    [session.user_id, JSON.stringify(settings)]
  );
  success(res, { settings: rows[0].settings_json });
};
