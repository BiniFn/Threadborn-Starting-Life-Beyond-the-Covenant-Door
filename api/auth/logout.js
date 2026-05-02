const { allowCors, success, fail } = require("../../lib/api/http");
const { getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const {
  SESSION_COOKIE,
  makeCookie,
  getSessionCookieOptions,
  destroySession,
} = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`logout:${getClientIp(req)}`, 10, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  // Clear cookie immediately — do this before the DB call so the user
  // is always logged out in the browser even if the DB is unavailable
  res.setHeader(
    "Set-Cookie",
    makeCookie(
      SESSION_COOKIE,
      "",
      0,
      getSessionCookieOptions(req, { clear: true }),
    ),
  );
  try {
    await destroySession(req, res);
  } catch (error) {
    // Cookie is already cleared — log but don't surface to client
    console.error("[logout] DB delete failed:", error);
  }
  success(res, { loggedOut: true });
};
