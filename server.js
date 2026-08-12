/* ==========================================================
   server.js - Bookly backend (Express + MySQL + sessions)

   Serves:
   - public/   -> anyone (login.html, register.html, style.css, script.js)
   - views/    -> logged-in users only (index.html, Appointments.html)
   - /api/*    -> JSON API backing the frontend

   Auth: email + password (bcrypt hashed), session stored in an
   httpOnly cookie via express-session.
   ========================================================== */
require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const { sendAppointmentConfirmation, sendAppointmentCancellation } = require("./mailer");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");
const VIEWS_DIR = path.join(__dirname, "views");

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // http on localhost; set true behind HTTPS in production
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

/* ---------- Auth guards ---------- */
// For page requests: bounce to the login page.
function requireAuthPage(req, res, next) {
  if (req.session.userId) return next();
  return res.redirect("/login.html");
}
// For API requests: return 401 JSON so the frontend can react.
function requireAuthApi(req, res, next) {
  if (req.session.userId) return next();
  return res.status(401).json({ error: "Not authenticated" });
}

/* ---------- Protected pages (defined BEFORE static) ---------- */
app.get(["/", "/index.html"], requireAuthPage, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, "index.html"));
});
app.get("/Appointments.html", requireAuthPage, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, "Appointments.html"));
});
app.get("/providers.html", requireAuthPage, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, "providers.html"));
});
app.get("/profile.html", requireAuthPage, (req, res) => {
  res.sendFile(path.join(VIEWS_DIR, "profile.html"));
});

/* ---------- Public pages ---------- */
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});
app.get("/register.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "register.html"));
});
app.get("/forgot-password.html", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "forgot-password.html"));
});

/* ---------- Public static assets ---------- */
app.use(express.static(PUBLIC_DIR, { index: false, extensions: ["html"] }));

/* ==========================================================
   AUTH API
   ========================================================== */
// Requires a domain with an extension, e.g. name@example.com — rejects
// things like "name@example" that have no ".com"/".org"/etc.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// At least 6 characters, with an uppercase letter, a lowercase letter, and a number.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
const PASSWORD_REQUIREMENTS_MSG =
  "Password must be at least 6 characters and include an uppercase letter, a lowercase letter, and a number.";

app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are all required." });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!PASSWORD_PATTERN.test(String(password))) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MSG });
  }
  try {
    const [existing] = await pool.query(
      "SELECT id FROM patients WHERE email = ?",
      [cleanEmail]
    );
    if (existing.length) {
      return res
        .status(409)
        .json({ error: "An account with that email already exists." });
    }
    const hash = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      "INSERT INTO patients (name, email, password_hash) VALUES (?, ?, ?)",
      [String(name).trim(), cleanEmail, hash]
    );
    req.session.userId = result.insertId;
    req.session.userName = String(name).trim();
    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("register error:", err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  try {
    const cleanEmail = String(email).trim().toLowerCase();
    const [rows] = await pool.query(
      "SELECT id, name, password_hash FROM patients WHERE email = ?",
      [cleanEmail]
    );
    if (!rows.length) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const ok = await bcrypt.compare(String(password), rows[0].password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    req.session.userId = rows[0].id;
    req.session.userName = rows[0].name;
    return res.json({ ok: true });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.post("/api/forgot-password", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email and new password are required." });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (!PASSWORD_PATTERN.test(String(password))) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MSG });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id FROM patients WHERE email = ?",
      [cleanEmail]
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ error: "No account found with that email." });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await pool.query("UPDATE patients SET password_hash = ? WHERE id = ?", [
      hash,
      rows[0].id,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", requireAuthApi, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email FROM patients WHERE id = ?",
      [req.session.userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("me error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

/* ==========================================================
   ADMIN / DEV API
   Lets you inspect patient records from the backend as JSON.
   Never returns password_hash — password hashes are one-way,
   so the original passwords can't be recovered or displayed.
   ========================================================== */
app.get("/api/admin/patients", requireAuthApi, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, phone, created_at FROM patients ORDER BY id"
    );
    res.json(rows);
  } catch (err) {
    console.error("admin patients error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

/* ==========================================================
   PROVIDERS + AVAILABILITY API
   ========================================================== */
app.get("/api/providers", requireAuthApi, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, specialty, location FROM healthcare_providers ORDER BY name"
    );
    res.json(rows);
  } catch (err) {
    console.error("providers error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

app.get("/api/providers/:id/availability", requireAuthApi, async (req, res) => {
  const providerId = Number(req.params.id);
  if (!providerId) return res.status(400).json({ error: "Invalid provider." });
  try {
    // Return only slots that are not already booked.
    const [rows] = await pool.query(
      `SELECT s.id,
              DATE_FORMAT(s.slot_date, '%Y-%m-%d') AS dateValue,
              DATE_FORMAT(s.slot_date, '%a %b %e') AS dayLabel,
              DATE_FORMAT(s.slot_time, '%h:%i %p') AS timeLabel
         FROM availability_slots s
        WHERE s.provider_id = ?
          AND s.is_booked = FALSE
          AND s.slot_date >= CURDATE()
        ORDER BY s.slot_date, s.slot_time`,
      [providerId]
    );
    res.json(rows);
  } catch (err) {
    console.error("availability error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

/* ==========================================================
   APPOINTMENTS API (scoped to the logged-in user)
   ========================================================== */
app.get("/api/appointments", requireAuthApi, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id,
              p.name AS providerName,
              p.specialty AS providerSpecialty,
              p.location AS location,
              DATE_FORMAT(s.slot_date, '%a %b %e') AS dayLabel,
              DATE_FORMAT(s.slot_time, '%h:%i %p') AS timeLabel,
              (s.slot_date < CURDATE()
                OR (s.slot_date = CURDATE() AND s.slot_time < CURTIME())) AS isPast
         FROM appointments a
         JOIN availability_slots s ON s.id = a.slot_id
         JOIN healthcare_providers p ON p.id = s.provider_id
        WHERE a.patient_id = ? AND a.status = 'confirmed'
        ORDER BY s.slot_date, s.slot_time`,
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("list appointments error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/appointments", requireAuthApi, async (req, res) => {
  const { slotId } = req.body || {};
  if (!slotId) return res.status(400).json({ error: "A time slot is required." });
  try {
    const [slots] = await pool.query(
      "SELECT id, is_booked FROM availability_slots WHERE id = ?",
      [Number(slotId)]
    );
    if (!slots.length) {
      return res.status(404).json({ error: "That time slot no longer exists." });
    }
    if (slots[0].is_booked) {
      return res
        .status(409)
        .json({ error: "That time was just booked. Please pick another." });
    }

    // A patient can only hold one appointment per date/time, regardless of
    // which provider it's with — check across all of their other bookings.
    const [conflicts] = await pool.query(
      `SELECT a.id
         FROM appointments a
         JOIN availability_slots s ON s.id = a.slot_id
         JOIN availability_slots target ON target.id = ?
        WHERE a.patient_id = ?
          AND a.status = 'confirmed'
          AND s.slot_date = target.slot_date
          AND s.slot_time = target.slot_time`,
      [Number(slotId), req.session.userId]
    );
    if (conflicts.length) {
      return res.status(409).json({
        error: "You already have an appointment at that date and time.",
      });
    }

    await pool.query(
      "INSERT INTO appointments (patient_id, slot_id) VALUES (?, ?)",
      [req.session.userId, Number(slotId)]
    );
    await pool.query(
      "UPDATE availability_slots SET is_booked = TRUE WHERE id = ?",
      [Number(slotId)]
    );
    res.status(201).json({ ok: true });

    try {
      const [[details]] = await pool.query(
        `SELECT p.name AS providerName, p.location AS location,
                pt.name AS patientName, pt.email AS patientEmail,
                DATE_FORMAT(s.slot_date, '%a %b %e') AS dayLabel,
                DATE_FORMAT(s.slot_time, '%h:%i %p') AS timeLabel
           FROM availability_slots s
           JOIN healthcare_providers p ON p.id = s.provider_id
           JOIN patients pt ON pt.id = ?
          WHERE s.id = ?`,
        [req.session.userId, Number(slotId)]
      );
      await sendAppointmentConfirmation({
        to: details.patientEmail,
        patientName: details.patientName,
        providerName: details.providerName,
        dayLabel: details.dayLabel,
        timeLabel: details.timeLabel,
        location: details.location,
      });
    } catch (mailErr) {
      console.error("confirmation email failed:", mailErr.message);
    }
  } catch (err) {
    console.error("book appointment error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/appointments/:id/cancel", requireAuthApi, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const [rows] = await pool.query(
      "SELECT slot_id FROM appointments WHERE id = ? AND patient_id = ?",
      [id, req.session.userId]
    );
    if (!rows.length) return res.json({ ok: true });

    const [[details]] = await pool.query(
      `SELECT p.name AS providerName,
              pt.name AS patientName, pt.email AS patientEmail,
              DATE_FORMAT(s.slot_date, '%a %b %e') AS dayLabel,
              DATE_FORMAT(s.slot_time, '%h:%i %p') AS timeLabel
         FROM availability_slots s
         JOIN healthcare_providers p ON p.id = s.provider_id
         JOIN patients pt ON pt.id = ?
        WHERE s.id = ?`,
      [req.session.userId, rows[0].slot_id]
    );

    await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = ? AND patient_id = ?",
      [id, req.session.userId]
    );
    await pool.query(
      "UPDATE availability_slots SET is_booked = FALSE WHERE id = ?",
      [rows[0].slot_id]
    );
    res.json({ ok: true });

    try {
      await sendAppointmentCancellation({
        to: details.patientEmail,
        patientName: details.patientName,
        providerName: details.providerName,
        dayLabel: details.dayLabel,
        timeLabel: details.timeLabel,
      });
    } catch (mailErr) {
      console.error("cancellation email failed:", mailErr.message);
    }
  } catch (err) {
    console.error("cancel appointment error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

/* ---------- Start ----------
   Vercel imports this file as a serverless function and calls the
   exported app directly, so only bind a real port when run locally
   (node server.js / npm start). ---------- */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nBookly running at http://localhost:${PORT}\n`);
  });
}

module.exports = app;
