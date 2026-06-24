// Backend API client. Every call attaches the current Firebase ID token and
// normalizes the {ok:true/false} envelope into a thrown ApiClientError on
// failure, so callers (popup, service worker) just `await` and `catch`.

import type {
  AnalyticsSummary,
  ApiResult,
  DeviceSummary,
  HistoryItem,
  ShareRequestPayload,
  ShareResponseData,
} from "../types";
import { getSession } from "./auth";

const API_BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ||
  "https://pathua-api.vercel.app/api";

export class ApiClientError extends Error {
  constructor(public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  if (!session) {
    throw new ApiClientError("UNAUTHENTICATED", "Not signed in");
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.idToken}`,
      ...init.headers,
    },
  });
  const json = (await res.json()) as ApiResult<T>;
  if (!json.ok) {
    throw new ApiClientError(json.error.code, json.error.message, json.error.fields);
  }
  return json.data;
}

export function shareLink(payload: ShareRequestPayload): Promise<ShareResponseData> {
  return request("/share", { method: "POST", body: JSON.stringify(payload) });
}

export function registerDevice(input: {
  deviceId: string;
  label: string;
  platform: "android-web" | "android";
  fcmToken: string;
}): Promise<DeviceSummary> {
  return request("/device/register", { method: "POST", body: JSON.stringify(input) });
}

export function removeDevice(deviceId: string): Promise<{ deviceId: string; removed: boolean }> {
  return request("/device/remove", { method: "POST", body: JSON.stringify({ deviceId }) });
}

export function getHistory(params: {
  q?: string;
  domain?: string;
  sharedOnly?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.domain) qs.set("domain", params.domain);
  if (params.sharedOnly) qs.set("sharedOnly", "true");
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", params.cursor);
  return request(`/history?${qs.toString()}`);
}

export function deleteHistoryItem(shareId: string): Promise<{ removed: boolean }> {
  return request(`/history/${shareId}`, { method: "DELETE" });
}

export function reshare(
  shareId: string,
  deviceIds: string[]
): Promise<ShareResponseData> {
  return request(`/history/${shareId}/reshare`, {
    method: "POST",
    body: JSON.stringify({ deviceIds }),
  });
}

export function getAnalytics(range: "7d" | "30d" | "90d" = "7d"): Promise<AnalyticsSummary> {
  return request(`/analytics?range=${range}`);
}
