// share.service.ts — persists a share event and orchestrates FCM delivery.
//
// Called by the share controller after validation + dedupe checks.
// Path: users/{uid}/share_history/{shareId}

import { v4 as uuidv4 } from "uuid";
import { getFirestore, serverTimestamp } from "../firebase/admin";
import * as deviceService from "./device.service";
import { sendToDevices, FcmPayload } from "./fcm.service";
import { analyticsService } from "./analytics.service";
import {
  ShareRequestBody,
  ShareResponseData,
  FirestoreShareEvent,
  DeviceDeliveryResult,
} from "../types";
import { extractDomain, toIso } from "../utils/helpers";

export async function processShare(
  uid: string,
  body: ShareRequestBody
): Promise<ShareResponseData> {
  const shareId = uuidv4();
  const domain = extractDomain(body.url);
  const favicon = body.favicon ?? "";
  const timestamp = body.timestamp ?? new Date().toISOString();

  // Resolve target devices: specific list or all registered devices
  const devices = await deviceService.getDevicesByIds(uid, body.deviceIds ?? []);

  const fcmPayload: FcmPayload = {
    title: body.title,
    url: body.url,
    favicon,
    timestamp,
    shareId,
  };

  const delivered: DeviceDeliveryResult[] = await sendToDevices(devices, fcmPayload);

  // Persist the share event
  const event: Omit<FirestoreShareEvent, "createdAt"> & {
    createdAt: FirebaseFirestore.FieldValue;
  } = {
    shareId,
    uid,
    title: body.title,
    url: body.url,
    domain,
    favicon: favicon || null,
    deviceIds: devices.map((d) => d.deviceId),
    delivered,
    duplicate: false,
    createdAt: serverTimestamp(),
  };

  await getFirestore()
    .collection("users")
    .doc(uid)
    .collection("share_history")
    .doc(shareId)
    .set(event);

  // Touch lastUsedAt on each successfully delivered device (fire-and-forget)
  for (const result of delivered) {
    if (result.status === "sent") {
      void deviceService.touchDevice(uid, result.deviceId);
    }
  }

  // Increment analytics counters (fire-and-forget)
  void analyticsService.incrementShares(uid, domain);

  return { shareId, duplicate: false, delivered };
}
