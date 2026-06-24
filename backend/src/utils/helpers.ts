// Utility helpers used across middleware and services.

import { Response } from "express";
import { ApiResult } from "../types";

/** Send a well-formed success envelope. */
export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  const body: ApiResult<T> = { ok: true, data };
  res.status(status).json(body);
}

/** Send a well-formed error envelope. */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): void {
  const body: ApiResult<never> = { ok: false, error: { code, message, fields } };
  res.status(status).json(body);
}

/** Extract hostname from a URL string, safely. */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** Format a Firestore Timestamp (or Date) to an ISO string. */
export function toIso(ts: FirebaseFirestore.Timestamp | Date | undefined | null): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Date) return ts.toISOString();
  return (ts as FirebaseFirestore.Timestamp).toDate().toISOString();
}

/** Today's date as YYYY-MM-DD (UTC). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
