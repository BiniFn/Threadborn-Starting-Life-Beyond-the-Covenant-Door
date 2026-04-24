const { allowCors, success, fail } = require("../../lib/api/http");
const { destroySession } = require("../../lib/api/auth");

module.exports = async (req, res) => {
  if (allowCors(req, res)) {
    return;
  }
  if (req.method !== "POST") {
    fail(res, 405, "Method not allowed");
    return;
  }
  await destroySession(req, res);
  success(res, { loggedOut: true });
};
