const { put, del } = require("@vercel/blob");
const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody } = require("../../lib/api/request");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }

  try {
    await pool.ensureMigrations();

    // GET: Publicly list all art
    if (req.method === "GET") {
      const { rows } = await pool.query("select id, character_name, url, label from dashboard_art order by created_at desc");
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
        token: process.env.BLOB_READ_WRITE_TOKEN
      });

      const { rows } = await pool.query(
        `insert into dashboard_art (character_name, url, label, created_at) 
         values ($1, $2, $3, now()) returning id, character_name, url, label`,
        [characterName, blob.url, label]
      );

      return success(res, { art: rows[0] });
    }

    // DELETE: Remove art
    if (req.method === "DELETE") {
      const body = await parseJsonBody(req);
      const id = String(body.id || "");
      if (!id) return fail(res, 400, "Missing art ID");

      const { rows } = await pool.query("select url from dashboard_art where id = $1", [id]);
      if (rows.length > 0) {
        // Try to delete from blob storage
        try {
          if (process.env.BLOB_READ_WRITE_TOKEN) {
             await del(rows[0].url, { token: process.env.BLOB_READ_WRITE_TOKEN });
          }
        } catch (e) {
          // Ignore blob deletion errors
        }
        await pool.query("delete from dashboard_art where id = $1", [id]);
      }
      return success(res, { deleted: true });
    }

    return fail(res, 405, "Method not allowed");
  } catch (error) {
    return fail(res, 500, "Failed to manage art");
  }
};
