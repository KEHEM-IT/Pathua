// error.middleware.ts — global Express error handler.
// Catches anything thrown that wasn't caught by a controller.

import { ErrorRequestHandler } from "express";
import { sendError } from "../utils/helpers";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[Pathua] Unhandled error:", err);
  sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred");
};
