function parseJsonBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch (e) {
        return Promise.resolve({});
      }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

module.exports = { parseJsonBody, getClientIp };
