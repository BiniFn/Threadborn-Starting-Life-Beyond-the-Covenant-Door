const { allowCors, success, fail } = require("../_lib/http");
const { destroySession } = require("../_lib/auth");

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
