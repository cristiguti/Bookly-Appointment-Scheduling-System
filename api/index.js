/* Vercel serverless entry point - re-exports the Express app from
   server.js so Vercel's zero-config Node.js runtime can pick it up. */
module.exports = require("../server");
