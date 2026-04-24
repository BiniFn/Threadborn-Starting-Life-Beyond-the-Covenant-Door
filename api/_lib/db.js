const { Pool } = require("pg");

if (!global.__threadbornPool) {
  global.__threadbornPool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

module.exports = global.__threadbornPool;
