// index.ts — entry point. Initializes Firebase then starts the HTTP server.
// On Vercel, this file is the serverless function handler — `app.listen()`
// is skipped and Vercel routes requests directly to the Express app export.

import { initFirebase } from "./firebase/admin";
import { createApp } from "./app";

// Firebase must be initialized before any route handler imports services
// that call getFirestore() / getMessaging().
initFirebase();

const app = createApp();

// Local dev: bind to a port. Vercel's runtime ignores this branch.
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = Number(process.env.PORT ?? 4000);
  app.listen(PORT, () => {
    console.log(`[Pathua] Backend listening on http://localhost:${PORT}`);
  });
}

// Required by Vercel: export the app as the default export so it wraps it
// in a serverless function automatically.
export default app;
module.exports = app;
