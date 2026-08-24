/* ==========================================================
   setup-db.js - one-time database setup + seed
   Run with:  npm run db:setup
   - Creates the `bookly` database (if missing)
   - Creates tables (if missing)
   - Seeds providers + availability (only if empty)
   - Seeds one test login (only if missing): test@bookly.com / password123
   Safe to re-run: it never drops existing data.
   ========================
   ================================== */
require("dotenv").config();
const dns = require("dns");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

// Some hosts fail outbound IPv6 with an instant connection drop against
// dual-stack DB proxy domains (like Railway's) — force IPv4-first
// resolution, same fix already applied in db.js for the running app.
dns.setDefaultResultOrder("ipv4first");

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
      location VARCHAR(160),
      rating DECIMAL(2,1) NOT NULL DEFAULT 4.8,
      review_count INT NOT NULL DEFAULT 0,
      years_experience INT NOT NULL DEFAULT 0,
      bio TEXT,
      education JSON,
      specialties JSON,
      reviews JSON
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
      reason VARCHAR(500),
      status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE CASCADE
    );
  `);
  console.log("✓ Tables ready");

  // Migration: add `reason` to appointments for installs that already had
  // the table before this column existed.
  try {
    await root.query(
      "ALTER TABLE appointments ADD COLUMN reason VARCHAR(500) AFTER slot_id"
    );
    console.log("✓ Added reason column to appointments");
  } catch (err) {
    if (err.code !== "ER_DUP_FIELDNAME") throw err;
  }

  // Migration: add provider profile columns for installs that already had
  // healthcare_providers before these existed.
  const providerProfileColumns = [
    "ADD COLUMN rating DECIMAL(2,1) NOT NULL DEFAULT 4.8",
    "ADD COLUMN review_count INT NOT NULL DEFAULT 0",
    "ADD COLUMN years_experience INT NOT NULL DEFAULT 0",
    "ADD COLUMN bio TEXT",
    "ADD COLUMN education JSON",
    "ADD COLUMN specialties JSON",
    "ADD COLUMN reviews JSON",
  ];
  for (const clause of providerProfileColumns) {
    try {
      await root.query(`ALTER TABLE healthcare_providers ${clause}`);
    } catch (err) {
      if (err.code !== "ER_DUP_FIELDNAME") throw err;
    }
  }

  // 3) Provider directory + profile content
  const providers = [
    {
      name: "Dr. Sandra Rodriguez",
      specialty: "Family Medicine",
      location: "Bookly Main Clinic",
      rating: 4.6,
      review_count: 87,
      years_experience: 6,
      bio: "Dr. Sandra Rodriguez is a board-certified family medicine physician who provides comprehensive primary care for patients of all ages, from routine checkups to chronic condition management.",
      education: [
        "M.D. – University of Florida College of Medicine",
        "Residency – Family Medicine, Orlando Health",
      ],
      specialties: [
        "Preventive Care",
        "Chronic Disease Management",
        "Annual Physicals",
        "Immunizations",
        "Women's Health",
      ],
      reviews: [
        { patient: "Jamie L.", rating: 5, comment: "Dr. Rodriguez always takes the time to listen and explain things clearly." },
        { patient: "Chris P.", rating: 5, comment: "Friendly staff and never feels rushed during appointments." },
      ],
    },
    {
      name: "Dr. Ian Sky",
      specialty: "Pediatrics",
      location: "Bookly North Clinic",
      rating: 4.9,
      review_count: 156,
      years_experience: 10,
      bio: "Dr. Ian Sky is a board-certified pediatrician dedicated to the health and development of infants, children, and adolescents, with a gentle, family-centered approach to care.",
      education: [
        "M.D. – Duke University School of Medicine",
        "Residency – Pediatrics, Nemours Children's Hospital",
      ],
      specialties: [
        "Well-Child Visits",
        "Vaccinations",
        "Developmental Screening",
        "Asthma & Allergy Care",
        "Newborn Care",
      ],
      reviews: [
        { patient: "Taylor R.", rating: 5, comment: "My kids actually look forward to their checkups with Dr. Sky!" },
        { patient: "Morgan B.", rating: 5, comment: "Patient, kind, and great with anxious toddlers." },
      ],
    },
    {
      name: "Dr. Maya Chen",
      specialty: "Dermatology",
      location: "Bookly Main Clinic",
      rating: 4.8,
      review_count: 124,
      years_experience: 8,
      bio: "Dr. Maya Chen is a board-certified dermatologist specializing in medical, surgical, and cosmetic dermatology. She is dedicated to providing personalized care and helping patients achieve healthy, beautiful skin.",
      education: [
        "M.D. – University of Miami Miller School of Medicine",
        "Residency – Jackson Memorial Hospital",
      ],
      specialties: [
        "General Dermatology",
        "Acne Treatment",
        "Eczema & Psoriasis",
        "Skin Cancer Screening",
        "Cosmetic Dermatology",
      ],
      reviews: [
        { patient: "Sarah J.", rating: 5, comment: "Dr. Chen was very professional and took the time to explain everything. Highly recommend!" },
        { patient: "Michael T.", rating: 4, comment: "Great experience and very friendly staff. My skin is improving a lot!" },
      ],
    },
    {
      name: "Dr. Omar Haddad",
      specialty: "Cardiology",
      location: "Bookly South Clinic",
      rating: 4.7,
      review_count: 98,
      years_experience: 12,
      bio: "Dr. Omar Haddad is a board-certified cardiologist with over a decade of experience diagnosing and treating heart conditions, focused on both preventive cardiology and long-term heart health.",
      education: [
        "M.D. – Baylor College of Medicine",
        "Residency & Fellowship – Cardiology, Cleveland Clinic",
      ],
      specialties: [
        "Preventive Cardiology",
        "Hypertension Management",
        "Heart Disease Risk Assessment",
        "EKG & Stress Testing",
        "Cholesterol Management",
      ],
      reviews: [
        { patient: "Denise K.", rating: 5, comment: "Dr. Haddad explained my test results clearly and put my mind at ease." },
        { patient: "Robert G.", rating: 4, comment: "Thorough exam and very knowledgeable about heart health." },
      ],
    },
  ];

  // Seed providers + availability (only if the table is empty)
  const [[{ cnt }]] = await root.query(
    "SELECT COUNT(*) AS cnt FROM healthcare_providers"
  );
  if (cnt === 0) {
    const times = [
      "08:00:00", "08:40:00", "09:20:00", "10:00:00", "10:40:00", "11:20:00",
      "12:00:00", "12:40:00", "13:20:00", "14:00:00", "14:40:00", "15:20:00",
      "16:00:00", "16:40:00",
    ];
    const slotDate = "2026-07-28";

    for (const p of providers) {
      const [r] = await root.query(
        `INSERT INTO healthcare_providers
           (name, specialty, location, rating, review_count, years_experience, bio, education, specialties, reviews)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.name, p.specialty, p.location, p.rating, p.review_count, p.years_experience, p.bio,
          JSON.stringify(p.education), JSON.stringify(p.specialties), JSON.stringify(p.reviews),
        ]
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
    // Backfill profile content (bio/education/specialties/reviews/etc.) for
    // installs that seeded providers before these columns existed.
    for (const p of providers) {
      await root.query(
        `UPDATE healthcare_providers
            SET rating = ?, review_count = ?, years_experience = ?, bio = ?,
                education = ?, specialties = ?, reviews = ?
          WHERE name = ? AND (bio IS NULL OR education IS NULL)`,
        [
          p.rating, p.review_count, p.years_experience, p.bio,
          JSON.stringify(p.education), JSON.stringify(p.specialties), JSON.stringify(p.reviews),
          p.name,
        ]
      );
    }
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
