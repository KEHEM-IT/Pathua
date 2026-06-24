// analytics.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import { analyticsService } from "../services/analytics.service";
import { sendSuccess, sendError } from "../utils/helpers";

export async function getAnalyticsController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { uid } = req;
  const range = (req.query.range as "7d" | "30d" | "90d") ?? "7d";
  if (!["7d", "30d", "90d"].includes(range)) {
    sendError(res, 400, "INVALID_RANGE", "range must be 7d, 30d, or 90d");
    return;
  }
  const summary = await analyticsService.getSummary(uid, range);
  sendSuccess(res, summary);
}

export async function incrementQrController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { uid } = req;
  await analyticsService.incrementQr(uid);
  sendSuccess(res, { incremented: true });
}
