/* ==========================================================
   setup-db.js - one-time database setup + seed
   Run with:  npm run db:setup
   - Creates the `bookly` database (if missing)
   - Creates tables (if missing)
   - Seeds providers + availability (only if empty)
   - Seeds one test login (only if missing): test@bookly.com / password123
   Safe to re-run: it never drops existing data.
   ========================================================== */
require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const DB_NAME = process.env.DB_NAME || "bookly";

async function main() {
  // 1) Connect WITHOUT a database so we can create it.
  const root = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  await root.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await root.changeUser({ database: DB_NAME });
  console.log(`✓ Database "${DB_NAME}" ready`);

  // 2) Tables
  await root.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      phone VARCHAR(30),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS healthcare_providers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      specialty VARCHAR(120) NOT NULL,
      location VARCHAR(160)
    );

    CREATE TABLE IF NOT EXISTS availability_slots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      provider_id INT NOT NULL,
      slot_date DATE NOT NULL,
      slot_time TIME NOT NULL,
      is_booked BOOLEAN NOT NULL DEFAULT FALSE,
      FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      slot_id INT NOT NULL,
      status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE CASCADE
    );
  `);
  console.log("✓ Tables ready");

  // 3) Seed providers + availability (only if empty)
  const [[{ cnt }]] = await root.query(
    "SELECT COUNT(*) AS cnt FROM healthcare_providers"
  );
  if (cnt === 0) {
    const providers = [
      { name: "Dr. Sandra Rodriguez", specialty: "Family Medicine", location: "Bookly Main Clinic" },
      { name: "Dr. Ian Sky", specialty: "Pediatrics", location: "Bookly North Clinic" },
      { name: "Dr. Maya Chen", specialty: "Dermatology", location: "Bookly Main Clinic" },
      { name: "Dr. Omar Haddad", specialty: "Cardiology", location: "Bookly South Clinic" },
    ];
    const times = ["09:00:00", "09:40:00", "11:00:00", "13:00:00", "15:20:00"];
    const slotDate = "2026-07-28";

    for (const p of providers) {
      const [r] = await root.query(
        "INSERT INTO healthcare_providers (name, specialty, location) VALUES (?, ?, ?)",
        [p.name, p.specialty, p.location]
      );
      const providerId = r.insertId;
      for (const t of times) {
        await root.query(
          "INSERT INTO availability_slots (provider_id, slot_date, slot_time) VALUES (?, ?, ?)",
          [providerId, slotDate, t]
        );
      }
    }
    console.log(`✓ Seeded ${providers.length} providers with availability`);
  } else {
    console.log("• Providers already seeded, skipping");
  }

  // 4) Seed a test patient (only if it doesn't exist)
  const testEmail = "test@bookly.com";
  const [existing] = await root.query(
    "SELECT id FROM patients WHERE email = ?",
    [testEmail]
  );
  if (existing.length === 0) {
    const hash = await bcrypt.hash("password123", 10);
    await root.query(
      "INSERT INTO patients (name, email, password_hash) VALUES (?, ?, ?)",
      ["Test User", testEmail, hash]
    );
    console.log(`✓ Seeded test login:  ${testEmail} / password123`);
  } else {
    console.log("• Test patient already exists, skipping");
  }

  await root.end();
  console.log("\nDatabase setup complete. Start the app with:  npm start\n");
}

main().catch((err) => {
  console.error("\n Database setup failed:\n", err.message);
  console.error(
    "\nCheck that MySQL is running and that DB_USER / DB_PASSWORD in .env are correct.\n"
  );
  process.exit(1);
});
