// Shared domain types for the Pathua extension.
// Kept framework-agnostic (no chrome.* references) so they're reusable from
// popup, background, options and (eventually) a Safari/Firefox port.

export type QrContentType =
  | "url"
  | "text"
  | "email"
  | "phone"
  | "whatsapp"
  | "sms"
  | "wifi"
  | "vcard"
  | "event";

export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";

export interface QrCustomizationOptions {
  color: string; // foreground, hex e.g. "#000000"
  backgroundColor: string; // hex e.g. "#ffffff"
  margin: number; // modules of whitespace border
  size: number; // px, square
  errorCorrection: ErrorCorrectionLevel;
  embeddedLogo?: EmbeddedLogoOptions;
}

export interface EmbeddedLogoOptions {
  dataUrl: string; // base64 image, drawn centered over the QR
  sizeRatio: number; // 0-1, fraction of the QR's width the logo occupies
}

export interface TabInfo {
  title: string;
  url: string;
  domain: string;
  favicon: string | null;
}

export interface WifiQrFields {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export interface VCardFields {
  firstName: string;
  lastName: string;
  org?: string;
  phone?: string;
  email?: string;
  url?: string;
}

export interface EventQrFields {
  title: string;
  start: string; // ISO date
  end: string; // ISO date
  location?: string;
  description?: string;
}

export interface SmartQrInput {
  type: QrContentType;
  url?: string;
  text?: string;
  email?: string;
  phone?: string;
  whatsappMessage?: string;
  smsMessage?: string;
  wifi?: WifiQrFields;
  vcard?: VCardFields;
  event?: EventQrFields;
}

export type DevicePlatform = "android-web" | "android";

export interface DeviceSummary {
  deviceId: string;
  label: string;
  platform: DevicePlatform;
}

export interface ShareRequestPayload {
  title: string;
  url: string;
  favicon?: string;
  timestamp: string;
  deviceIds?: string[];
}

export interface DeviceDeliveryResult {
  deviceId: string;
  label: string;
  status: "sent" | "failed";
}

export interface ShareResponseData {
  shareId: string;
  duplicate: boolean;
  delivered: DeviceDeliveryResult[];
}

export interface HistoryItem {
  shareId: string;
  title: string;
  url: string;
  domain: string;
  favicon: string | null;
  qrGenerated: boolean;
  sharedTo: string[];
  createdAt: string;
}

export interface AnalyticsSummary {
  totalQrGenerated: number;
  totalShared: number;
  topDomains: { domain: string; count: number }[];
  daily: { date: string; qrGenerated: number; shares: number }[];
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string> };
}

export type ApiResult<T> = ApiSuccess<T> | ApiError;

export interface AuthSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  idToken: string;
  expiresAt: number; // epoch ms
}

export type Theme = "light" | "dark" | "system";

export interface UserSettings {
  theme: Theme;
  defaultQrOptions: QrCustomizationOptions;
  shareToAllByDefault: boolean;
}

// ---- Runtime messaging contract between popup/options and the service worker ----

export type RuntimeMessage =
  | { type: "TAB_CHANGED"; payload: TabInfo }
  | { type: "SHARE_LINK"; payload: ShareRequestPayload }
  | { type: "GET_AUTH_SESSION" }
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" }
  | { type: "GET_DEVICES" }
  | { type: "REGISTER_DEVICE"; payload: { label: string; platform: DevicePlatform; fcmToken: string } }
  | { type: "REMOVE_DEVICE"; payload: { deviceId: string } }
  | { type: "DRAIN_OFFLINE_QUEUE" };

export interface QueuedShare {
  id: string; // local uuid, not the server shareId
  payload: ShareRequestPayload;
  attempts: number;
  createdAt: number;
}
