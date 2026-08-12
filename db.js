/* ==========================================================
   db.js - MySQL connection pool (mysql2, promise API)
   Every route imports this pool and runs parameterized queries.
   ========================================================== */
require("dotenv").config();
const dns = require("dns");
const mysql = require("mysql2/promise");

// Some hosts (e.g. Vercel) fail outbound IPv6 with an instant
// ECONNREFUSED against dual-stack DB proxy domains (like Railway's).
// mysql2 doesn't expose a per-connection "family" option, so force
// IPv4-first resolution globally instead.
dns.setDefaultResultOrder("ipv4first");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bookly",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
