// fcm.service.ts — Firebase Cloud Messaging delivery.
//
// Sends a DATA-only message (no notification block) so the Android app can
// build a rich notification with custom actions (Open / Copy Link) instead
// of the system default. The `data` payload is string-only per FCM spec.
//
// Multi-device: we fan out with sendEach() which sends in a single HTTP
// request to FCM but gets per-token results — lets us mark individual
// devices as failed without aborting the whole batch.

import * as admin from "firebase-admin";
import { getMessaging } from "../firebase/admin";
import { DeviceDeliveryResult, FirestoreDevice } from "../types";

export interface FcmPayload {
  title: string;
  url: string;
  favicon: string;
  timestamp: string;
  shareId: string;
}

export async function sendToDevices(
  devices: FirestoreDevice[],
  payload: FcmPayload
): Promise<DeviceDeliveryResult[]> {
  if (devices.length === 0) return [];

  const messages: admin.messaging.Message[] = devices.map((device) => ({
    token: device.fcmToken,
    data: {
      title: payload.title,
      url: payload.url,
      favicon: payload.favicon,
      timestamp: payload.timestamp,
      shareId: payload.shareId,
      type: "SHARE_LINK",
    },
    android: {
      priority: "high",
      ttl: 60 * 60 * 1000, // 1 hour in ms
    },
  }));

  const batchResponse = await getMessaging().sendEach(messages);

  return batchResponse.responses.map((resp, idx) => {
    const device = devices[idx]!;
    if (resp.success) {
      return { deviceId: device.deviceId, label: device.label, status: "sent" };
    }
    return {
      deviceId: device.deviceId,
      label: device.label,
      status: "failed",
      error: resp.error?.message ?? "Unknown FCM error",
    };
  });
}
