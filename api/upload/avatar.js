const { put } = require("@vercel/blob");
const pool = require("../../lib/api/db");
const { allowCors, success, fail } = require("../../lib/api/http");
const { parseJsonBody, getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { requireSession, validateCsrf } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`avatar_upload:${getClientIp(req)}`, 5, 60_000)) {
    fail(res, 429, "Too many upload attempts");
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
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    fail(res, 503, "Missing BLOB_READ_WRITE_TOKEN");
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const dataUrl = String(body.dataUrl || "");
    if (!dataUrl.startsWith("data:image/")) {
      fail(res, 400, "Invalid image payload");
      return;
    }
    const [meta, base64] = dataUrl.split(",");
    const ALLOWED_IMAGE_TYPES = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
    const typeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(meta);
    if (!typeMatch || !base64) {
      fail(res, 400, "Invalid image format");
      return;
    }
    const contentType = typeMatch[1];
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      fail(res, 400, "Only JPEG, PNG, GIF, and WebP images are allowed");
      return;
    }
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > 3 * 1024 * 1024) {
      fail(res, 400, "Image too large (max 3MB)");
      return;
    }

    // Delete the old avatar blob if it exists to prevent storage leaks
    try {
      const existing = await pool.query(
        "select avatar_url from users where id = $1",
        [session.user_id],
      );
      const oldUrl = existing.rows[0]?.avatar_url || "";
      if (oldUrl && oldUrl.includes("blob.vercel-storage.com")) {
        const { del } = require("@vercel/blob");
        await del(oldUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
      }
    } catch (e) {
      console.error("[avatar] Failed to delete old blob:", e);
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `avatars/${session.user_id}-${Date.now()}.${ext}`;
    const blob = await put(fileName, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Persist the new avatar URL to the database immediately
    await pool.query(
      "update users set avatar_url = $1, updated_at = now() where id = $2",
      [blob.url, session.user_id],
    );

    success(res, { url: blob.url });
  } catch (error) {
    fail(res, 500, "Upload failed");
  }
};
