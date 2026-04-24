const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody } = require("../../lib/api/request");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  const session = await requireSession(req, res, fail);
  if (!session) {
    return;
  }
  if (!["admin", "owner"].includes(session.role)) {
    fail(res, 403, "Forbidden");
    return;
  }

  if (req.method === "GET") {
    const { rows } = await pool.query(
      "select id, email, username, role, verified, created_at from users order by created_at desc limit 200"
    );
    success(res, { users: rows });
    return;
  }

  if (req.method === "PATCH") {
    if (!validateCsrf(req, session)) {
      fail(res, 403, "Invalid CSRF token");
      return;
    }
    const body = await parseJsonBody(req);
    const id = String(body.id || "");
    const verified = Boolean(body.verified);
    const role = String(body.role || "user");
    if (!id || !["user", "admin", "owner"].includes(role)) {
      fail(res, 400, "Invalid payload");
      return;
    }
    if (role === "owner" && session.role !== "owner") {
      fail(res, 403, "Only owner can assign owner role");
      return;
    }
    await pool.query(
      "update users set role = $1::user_role, verified = $2, updated_at = now() where id = $3",
      [role, verified, id]
    );
    success(res, { updated: true });
    return;
  }

  fail(res, 405, "Method not allowed");
};
