/* ==========================================================
   mailer.js - sends appointment emails via Nodemailer

   If SMTP_HOST is set in .env, mail goes through that real
   SMTP server. Otherwise it falls back to a free Ethereal test
   inbox (nodemailer.createTestAccount()) so booking/cancel still
   works end-to-end in local dev - nothing is actually delivered,
   but a preview link for each email is logged to the console.
   ========================================================== */
const nodemailer = require("nodemailer");

const FROM = process.env.EMAIL_FROM || "Bookly <no-reply@bookly.test>";

let transporterPromise = null;

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    );
  } else {
    transporterPromise = nodemailer.createTestAccount().then((account) =>
      nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      })
    );
  }
  return transporterPromise;
}

async function sendMail({ to, subject, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: FROM, to, subject, text });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) console.log(`Email preview (${subject}): ${previewUrl}`);
  return info;
}

function sendAppointmentConfirmation({
  to,
  patientName,
  providerName,
  dayLabel,
  timeLabel,
  location,
}) {
  return sendMail({
    to,
    subject: "Bookly: Appointment Confirmed",
    text:
      `Hi ${patientName},\n\n` +
      `Your appointment with ${providerName} is confirmed for ${dayLabel} at ${timeLabel}` +
      (location ? ` at ${location}.` : ".") +
      `\n\nThanks for using Bookly.`,
  });
}

function sendAppointmentCancellation({
  to,
  patientName,
  providerName,
  dayLabel,
  timeLabel,
}) {
  return sendMail({
    to,
    subject: "Bookly: Appointment Canceled",
    text:
      `Hi ${patientName},\n\n` +
      `Your appointment with ${providerName} on ${dayLabel} at ${timeLabel} has been canceled.` +
      `\n\nYou can book a new appointment anytime at Bookly.`,
  });
}

module.exports = { sendAppointmentConfirmation, sendAppointmentCancellation };
