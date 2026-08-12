/* ==========================================================
   seed-availability.js - fills availability_slots with weekday
   slots (Mon-Fri) for every existing provider, running forward
   from today for MONTHS_AHEAD months.

   Run with:  npm run db:seed-availability
   Safe to re-run: INSERT IGNORE + a unique key on
   (provider_id, slot_date, slot_time) skip slots that already exist.
   ========================================================== */
require("dotenv").config();
const mysql = require("mysql2/promise");

const DB_NAME = process.env.DB_NAME || "bookly";
const TIMES = ["09:00:00", "09:40:00", "11:00:00", "13:00:00", "15:20:00"];
const MONTHS_AHEAD = 6;

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: DB_NAME,
  });

  // Guard against duplicate slots on re-runs.
  try {
    await conn.query(
      "ALTER TABLE availability_slots ADD UNIQUE KEY uq_provider_slot (provider_id, slot_date, slot_time)"
    );
    console.log("✓ Added uniqueness guard on availability_slots");
  } catch (err) {
    if (err.code !== "ER_DUP_KEYNAME") throw err;
  }

  const [providers] = await conn.query("SELECT id FROM healthcare_providers");
  if (!providers.length) {
    console.log("No providers found — run `npm run db:setup` first.");
    await conn.end();
    return;
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + MONTHS_AHEAD);

  const rows = [];
  for (const { id: providerId } of providers) {
    for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day === 0 || day === 6) continue; // weekdays only
      const dateStr = d.toISOString().slice(0, 10);
      for (const time of TIMES) {
        rows.push([providerId, dateStr, time]);
      }
    }
  }

  const [result] = await conn.query(
    "INSERT IGNORE INTO availability_slots (provider_id, slot_date, slot_time) VALUES ?",
    [rows]
  );
  console.log(
    `✓ Seeded ${result.affectedRows} new availability slots (${providers.length} providers, ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)})`
  );

  await conn.end();
}

main().catch((err) => {
  console.error("\nSeeding availability failed:\n", err.message);
  process.exit(1);
});
