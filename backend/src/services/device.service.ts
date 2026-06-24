// device.service.ts — CRUD for Firestore devices sub-collection.
//
// Path: users/{uid}/devices/{deviceId}
// Each document holds the FCM token plus metadata.
// Tokens are stored server-side (not in the extension) so a compromised
// extension bundle can't enumerate other users' device tokens.

import { getFirestore, serverTimestamp } from "../firebase/admin";
import { FirestoreDevice, DevicePlatform, DeviceSummary } from "../types";
import { toIso } from "../utils/helpers";

function devicesCol(uid: string) {
  return getFirestore().collection("users").doc(uid).collection("devices");
}

export async function registerDevice(
  uid: string,
  deviceId: string,
  label: string,
  platform: DevicePlatform,
  fcmToken: string
): Promise<DeviceSummary> {
  const ref = devicesCol(uid).doc(deviceId);
  const now = serverTimestamp();
  const data: Omit<FirestoreDevice, "createdAt" | "lastUsedAt"> & {
    createdAt: FirebaseFirestore.FieldValue;
    lastUsedAt: FirebaseFirestore.FieldValue;
  } = { deviceId, uid, label, platform, fcmToken, createdAt: now, lastUsedAt: now };
  await ref.set(data, { merge: true });
  return { deviceId, label, platform, lastUsedAt: new Date().toISOString() };
}

export async function removeDevice(uid: string, deviceId: string): Promise<boolean> {
  await devicesCol(uid).doc(deviceId).delete();
  return true;
}

export async function getDevices(uid: string): Promise<FirestoreDevice[]> {
  const snap = await devicesCol(uid).orderBy("lastUsedAt", "desc").get();
  return snap.docs.map((d) => d.data() as FirestoreDevice);
}

export async function getDevicesByIds(
  uid: string,
  deviceIds: string[]
): Promise<FirestoreDevice[]> {
  if (deviceIds.length === 0) return getDevices(uid);
  const snap = await devicesCol(uid).where("deviceId", "in", deviceIds).get();
  return snap.docs.map((d) => d.data() as FirestoreDevice);
}

export async function touchDevice(uid: string, deviceId: string): Promise<void> {
  await devicesCol(uid).doc(deviceId).update({ lastUsedAt: serverTimestamp() });
}

export function toDeviceSummary(d: FirestoreDevice): DeviceSummary {
  return {
    deviceId: d.deviceId,
    label: d.label,
    platform: d.platform,
    lastUsedAt: toIso(d.lastUsedAt),
  };
}
