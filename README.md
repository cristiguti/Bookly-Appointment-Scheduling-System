# Bookly

Bookly is an appointment booking web app built as a capstone project. It gives patients a convenient way to find a healthcare provider, review their background, and book, manage, or cancel appointments online.

**Live app:** [bookly-appointment-scheduling-system-bcsu-30ah2luxs.vercel.app](https://bookly-appointment-scheduling-system-bcsu-30ah2luxs.vercel.app/)

## What it does

- **Account access** — patient registration, login, and password recovery.
- **Find a provider** — search and filter providers by name or specialty, with each result showing a rating, review count, and years of experience.
- **Provider profiles** — click into a provider's profile for their bio, education, specialties, patient reviews, and location before booking.
- **Book appointments** — pick a date and open time slot from a provider's live availability and submit a reason for the visit.
- **Manage appointments** — view upcoming appointments and cancel them from the dashboard.
- **Email notifications** — automatic emails for booking confirmations, cancellations, and appointment reminders (via Nodemailer).
- **Profile & notification settings** — patients can update notification preferences from their profile page.
- **In-app support** — a help widget on every page lets patients call, or send a message that's emailed to support.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Database:** MySQL
- **Email:** Nodemailer
- **Deployment:** Vercel (app hosting) + Railway (production MySQL)

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- MySQL installed locally for development (or use the included `start-mysql.bat` to start it)

## Local Development Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a `.env` file in the project root with your local values (DB credentials, session secret, etc.) — see `db.js` and `mailer.js` for the variables they read.
3. Start MySQL (double-click `start-mysql.bat`, or run it from the terminal). This starts a local MySQL server against the data directory configured in that script.
4. Set up the database (creates the schema and seeds sample providers/availability):
   ```
   npm run db:setup
   ```

## Running the App

```
npm start
```

The app will run at [http://localhost:3000](http://localhost:3000).

For development with auto-restart on file changes:

```
npm run dev
```

## Deployment

The app is deployed on **Vercel**, connected to this GitHub repo — pushing to `main` triggers a new deployment automatically. The Express app is exposed to Vercel's serverless runtime through `api/index.js`, with `vercel.json` rewriting all requests to it.

### Database: Vercel + Railway

Vercel's serverless functions are stateless and don't provide persistent storage, so they can't host a MySQL database themselves. Bookly's database instead runs on **Railway**, as a separate hosted MySQL service that Vercel connects to over the network:

- **Railway** hosts the actual MySQL database used in production.
- **Vercel** runs the app and connects to that Railway database using connection details (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) set as environment variables in the Vercel project settings — not the local `.env` file used for development.
- Locally, the app instead connects to the MySQL instance started by `start-mysql.bat`, using the values in your local `.env`.

Because Railway's MySQL is reached over a dual-stack (IPv4/IPv6) proxy domain, `db.js` forces IPv4-first DNS resolution — without it, some hosts (Vercel included) get an instant `ECONNREFUSED` trying to connect over IPv6.

Whenever the database schema changes (new tables/columns in `setup-db.js`), remember to run `npm run db:setup` against the Railway database as well, using its connection details, so production stays in sync with local.

## Project Structure

```
Bookly/
├── api/
│   └── index.js         # Vercel serverless entry point (wraps server.js)
├── public/               # Frontend assets (HTML, CSS, JS) served statically
│   ├── login.html
│   ├── register.html
│   ├── forgot-password.html
│   ├── script.js
│   └── style.css
├── views/                # Authenticated page templates
│   ├── index.html        # Dashboard
│   ├── providers.html    # Find a provider + provider profiles + booking
│   ├── Appointments.html
│   └── profile.html
├── db.js                 # MySQL connection pool
├── mailer.js             # Email sending (confirmations, cancellations, support)
├── server.js             # Express server / routes
├── setup-db.js           # Database schema + seed script
├── seed-availability.js  # Seeds additional provider availability
├── vercel.json            # Vercel routing config
└── start-mysql.bat        # Starts local MySQL for development
```
