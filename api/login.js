const crypto = require("crypto");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
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

function verifyPassword(rawPassword, storedPassword, storedPasswordHash) {
  if (storedPasswordHash && storedPasswordHash.startsWith("scrypt$")) {
    const parts = storedPasswordHash.split("$");
    if (parts.length !== 3) {
      return false;
    }

    const salt = Buffer.from(parts[1], "hex");
    const expectedKey = Buffer.from(parts[2], "hex");
    const derivedKey = crypto.scryptSync(rawPassword, salt, expectedKey.length);
    return crypto.timingSafeEqual(derivedKey, expectedKey);
  }

  if (storedPassword) {
    return crypto.timingSafeEqual(
      Buffer.from(String(rawPassword)),
      Buffer.from(String(storedPassword))
    );
  }

  return false;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  if (!process.env.DATABASE_URL) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Missing DATABASE_URL environment variable" }));
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Email and password are required" }));
      return;
    }

    const query = `
      select id, email, password, password_hash
      from users
      where lower(email) = $1
      limit 1
    `;
    const { rows } = await pool.query(query, [email]);

    if (!rows.length) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid credentials" }));
      return;
    }

    const user = rows[0];
    const valid = verifyPassword(password, user.password, user.password_hash);
    if (!valid) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Invalid credentials" }));
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        email: user.email
      }
    }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Login failed", details: error.message }));
  }
};
