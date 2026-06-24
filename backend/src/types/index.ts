// Backend-only types. These mirror (but are NOT imported from) the extension
// types to avoid coupling the two packages — the backend owns its own schema.

export type DevicePlatform = "android" | "android-web";
export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

// ---- Firestore document shapes ----

export interface FirestoreUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface FirestoreDevice {
  deviceId: string;
  uid: string;
  label: string;
  platform: DevicePlatform;
  fcmToken: string;
  createdAt: FirebaseFirestore.Timestamp;
  lastUsedAt: FirebaseFirestore.Timestamp;
}

export interface DeviceDeliveryResult {
  deviceId: string;
  label: string;
  status: "sent" | "failed";
  error?: string;
}

export interface FirestoreShareEvent {
  shareId: string;
  uid: string;
  title: string;
  url: string;
  domain: string;
  favicon: string | null;
  deviceIds: string[];
  delivered: DeviceDeliveryResult[];
  duplicate: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface FirestoreAnalytics {
  uid: string;
  date: string; // YYYY-MM-DD
  qrGenerated: number;
  shares: number;
  domains: Record<string, number>; // domain → count
}

export interface FirestoreUserSettings {
  uid: string;
  theme: "light" | "dark" | "system";
  shareToAllByDefault: boolean;
  updatedAt: FirebaseFirestore.Timestamp;
}

// ---- API request/response shapes ----

export interface ShareRequestBody {
  title: string;
  url: string;
  favicon?: string;
  timestamp: string;
  deviceIds?: string[];
}

export interface ShareResponseData {
  shareId: string;
  duplicate: boolean;
  delivered: DeviceDeliveryResult[];
}

export interface DeviceRegisterBody {
  deviceId: string;
  label: string;
  platform: DevicePlatform;
  fcmToken: string;
}

export interface DeviceSummary {
  deviceId: string;
  label: string;
  platform: DevicePlatform;
  lastUsedAt: string; // ISO
}

export interface HistoryItem {
  shareId: string;
  title: string;
  url: string;
  domain: string;
  favicon: string | null;
  sharedTo: string[];
  createdAt: string; // ISO
}

export interface AnalyticsSummary {
  totalQrGenerated: number;
  totalShared: number;
  topDomains: { domain: string; count: number }[];
  daily: { date: string; qrGenerated: number; shares: number }[];
}

// ---- API envelope ----

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

// ---- Augmented Express Request ----

import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  uid: string;
}
