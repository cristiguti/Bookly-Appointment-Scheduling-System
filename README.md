# Bookly

Bookly is an appointment booking web app built as a capstone project. The system is designed with a convenient way to manage their medical appointments online.

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express
- **Database:** MySQL

## Prerequisites

- [Node.js](https://nodejs.org/) installed
- MySQL installed (or use the included `start-mysql.bat` to start it)

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Start MySQL (double-click `start-mysql.bat` or run it from the terminal).
3. Set up the database:
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

## Project Structure

```
Bookly/
├── public/        # Frontend assets (HTML, CSS, JS)
├── views/         # Page templates (index, appointments, etc.)
├── db.js          # MySQL connection setup
├── server.js      # Express server / routes
├── setup-db.js    # Database setup script
└── start-mysql.bat
```
