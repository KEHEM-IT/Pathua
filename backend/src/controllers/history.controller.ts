// history.controller.ts

import { Response } from "express";
import { AuthenticatedRequest } from "../types";
import * as historyService from "../services/history.service";
import { sendSuccess, sendError } from "../utils/helpers";

export async function getHistoryController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { uid } = req;
  const q = req.query.q as string | undefined;
  const domain = req.query.domain as string | undefined;
  const sharedOnly = req.query.sharedOnly === "true";
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const cursor = req.query.cursor as string | undefined;

  const result = await historyService.getHistory(uid, { q, domain, sharedOnly, limit, cursor });
  sendSuccess(res, result);
}

export async function deleteHistoryController(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const { uid } = req;
  const { shareId } = req.params;
  const removed = await historyService.deleteHistoryItem(uid, shareId);
  if (!removed) {
    sendError(res, 404, "NOT_FOUND", "History item not found");
    return;
  }
  sendSuccess(res, { removed });
}
