// Typed chrome.storage.local helpers for the specific pieces of state the
// extension persists across service-worker restarts: offline share queue,
// cached device list (for instant popup paint before the network responds),
// and user settings/theme.

import type { DeviceSummary, QueuedShare, UserSettings } from "../types";
import { storageGet, storageSet } from "./chromeApi";

const QUEUE_KEY = "pathua_offline_queue";
const DEVICES_CACHE_KEY = "pathua_devices_cache";
const SETTINGS_KEY = "pathua_settings";

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  defaultQrOptions: {
    color: "#000000",
    backgroundColor: "#ffffff",
    margin: 4,
    size: 256,
    errorCorrection: "M",
  },
  shareToAllByDefault: false,
};

export async function getOfflineQueue(): Promise<QueuedShare[]> {
  return (await storageGet<QueuedShare[]>(QUEUE_KEY)) ?? [];
}

export async function enqueueShare(item: QueuedShare): Promise<void> {
  const queue = await getOfflineQueue();
  queue.push(item);
  await storageSet(QUEUE_KEY, queue);
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getOfflineQueue();
  await storageSet(QUEUE_KEY, queue.filter((q) => q.id !== id));
}

export async function getCachedDevices(): Promise<DeviceSummary[]> {
  return (await storageGet<DeviceSummary[]>(DEVICES_CACHE_KEY)) ?? [];
}

export async function setCachedDevices(devices: DeviceSummary[]): Promise<void> {
  await storageSet(DEVICES_CACHE_KEY, devices);
}

export async function getSettings(): Promise<UserSettings> {
  return (await storageGet<UserSettings>(SETTINGS_KEY)) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await storageSet(SETTINGS_KEY, settings);
}
