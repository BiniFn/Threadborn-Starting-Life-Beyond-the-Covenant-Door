const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { makePasswordHash } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!process.env.OWNER_EMAIL || !process.env.OWNER_PASSWORD) {
    fail(res, 400, "Missing OWNER_EMAIL or OWNER_PASSWORD");
    return;
  }
  try {
    const ownerEmail = process.env.OWNER_EMAIL.trim().toLowerCase();
    const ownerUsername = ownerEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) || "owner";
    const existing = await pool.query("select id from users where role = 'owner'::user_role limit 1");
    if (existing.rows.length) {
      success(res, { created: false, message: "Owner already exists" });
      return;
    }

    await pool.query(
      `insert into users (email, username, password_hash, role, verified, updated_at)
       values ($1, $2, $3, 'owner', true, now())
       on conflict (email) do update
       set role = 'owner', verified = true, password_hash = excluded.password_hash, updated_at = now()`,
      [ownerEmail, ownerUsername, makePasswordHash(process.env.OWNER_PASSWORD)]
    );

    success(res, { created: true });
  } catch (error) {
    fail(res, 500, "Owner bootstrap failed");
  }
};
