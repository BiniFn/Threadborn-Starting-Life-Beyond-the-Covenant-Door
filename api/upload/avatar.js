const { put } = require("@vercel/blob");
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
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
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
    const typeMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64$/.exec(meta);
    if (!typeMatch || !base64) {
      fail(res, 400, "Invalid image format");
      return;
    }
    const contentType = typeMatch[1];
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length > 3 * 1024 * 1024) {
      fail(res, 400, "Image too large (max 3MB)");
      return;
    }

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `avatars/${session.user_id}-${Date.now()}.${ext}`;
    const blob = await put(fileName, bytes, {
      access: "public",
      addRandomSuffix: false,
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    success(res, { url: blob.url });
  } catch (error) {
    fail(res, 500, "Upload failed");
  }
};
