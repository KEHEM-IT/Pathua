// share.controller.ts

import { Response } from "express";
import { AuthenticatedRequest, ShareRequestBody, ShareResponseData } from "../types";
import { isDuplicateShare } from "../services/dedupe.service";
import { processShare } from "../services/share.service";
import { sendSuccess, sendError } from "../utils/helpers";

export async function shareController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const body = req.body as ShareRequestBody;
  const { uid } = req;

  // Server-side duplicate guard (10-second window, same url × uid)
  const isDup = await isDuplicateShare(uid, body.url);
  if (isDup) {
    const dupResult: ShareResponseData = {
      shareId: "",
      duplicate: true,
      delivered: [],
    };
    sendSuccess(res, dupResult);
    return;
  }

  try {
    const result = await processShare(uid, body);
    sendSuccess(res, result, 201);
  } catch (err) {
    console.error("[share] processShare error:", err);
    sendError(res, 502, "FCM_ERROR", "Failed to send notification to one or more devices");
  }
}

export async function reshareController(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { shareId } = req.params;
  const { deviceIds } = req.body as { deviceIds: string[] };
  const { uid } = req;

  const { getHistoryItem } = await import("../services/history.service");
  const existing = await getHistoryItem(uid, shareId);
  if (!existing) {
    sendError(res, 404, "NOT_FOUND", "Share event not found");
    return;
  }

  const body: ShareRequestBody = {
    title: existing.title,
    url: existing.url,
    favicon: existing.favicon ?? undefined,
    timestamp: new Date().toISOString(),
    deviceIds: deviceIds.length > 0 ? deviceIds : undefined,
  };

  const result = await processShare(uid, body);
  sendSuccess(res, result, 201);
}
