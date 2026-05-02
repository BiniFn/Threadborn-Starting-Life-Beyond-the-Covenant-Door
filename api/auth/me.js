const { allowCors, success, fail } = require("../../lib/api/http");
const { getClientIp } = require("../../lib/api/request");
const { takeRateLimitToken } = require("../../lib/api/rate-limit");
const { getSession } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "GET") {
    fail(res, 405, "Method not allowed");
    return;
  }
  if (!takeRateLimitToken(`me:${getClientIp(req)}`, 60, 60_000)) {
    fail(res, 429, "Too many requests");
    return;
  }
  try {
    const session = await getSession(req);
    if (!session) {
      fail(res, 401, "Unauthorized");
      return;
    }
    success(res, {
      user: {
        id: session.user_id,
        email: session.email,
        username: session.username,
        avatarUrl: session.avatar_url || "",
        verified: session.verified,
        role: session.role,
      },
      csrfToken: session.csrf_token,
    });
  } catch (error) {
    fail(res, 500, "Service unavailable");
  }
};
