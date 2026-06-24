// app.ts — Express application factory.
// Kept separate from index.ts so it can be imported in tests without
// side-effectfully binding to a port.

import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import shareRoutes from "./routes/share.routes";
import deviceRoutes from "./routes/device.routes";
import historyRoutes from "./routes/history.routes";
import analyticsRoutes from "./routes/analytics.routes";
import { globalErrorHandler } from "./middleware/error.middleware";
import { sendSuccess } from "./utils/helpers";

// ---- Allowed origins ----
// In production, only the Chrome Extension's origin is accepted.
// Chrome extensions use the chrome-extension:// scheme, so we allow that
// plus the Vercel preview URL for local testing via the REST client.
const ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  "http://localhost:3000",
  process.env.ALLOWED_ORIGIN ?? "",
].filter(Boolean);

export function createApp() {
  const app = express();

  // ---- Security ----
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true); // server-to-server (curl, Postman)
        const allowed = ALLOWED_ORIGINS.some((o) =>
          typeof o === "string" ? o === origin : o.test(origin)
        );
        callback(allowed ? null : new Error("CORS: origin not allowed"), allowed);
      },
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ---- Body parsing ----
  app.use(express.json({ limit: "32kb" }));

  // ---- Global rate limiter (shared across all routes) ----
  app.use(
    rateLimit({
      windowMs: 60_000,       // 1 minute
      max: 60,                // 60 requests per IP per minute
      standardHeaders: true,
      legacyHeaders: false,
      message: { ok: false, error: { code: "RATE_LIMITED", message: "Too many requests" } },
    })
  );

  // ---- Tighter limiter on share endpoint ----
  const shareLimiter = rateLimit({
    windowMs: 10_000,         // 10 seconds
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: { code: "RATE_LIMITED", message: "Share rate limit exceeded" } },
  });

  // ---- Routes ----
  app.get("/api/health", (_req, res) => sendSuccess(res, { status: "ok", version: "0.1.0" }));

  app.use("/api/share", shareLimiter, shareRoutes);
  app.use("/api/device", deviceRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/analytics", analyticsRoutes);

  // ---- 404 catch-all ----
  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // ---- Error handler (must be last) ----
  app.use(globalErrorHandler);

  return app;
}
