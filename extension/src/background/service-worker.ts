// MV3 service worker — the extension's only persistent-ish execution
// context (in practice, killed and restarted constantly by Chrome). Holds
// NO in-memory state of consequence; everything it needs survives in
// chrome.storage.local (see services/storage.ts).
//
// Responsibilities:
//   1. Watch for active-tab changes, forward TAB_CHANGED to the popup if open.
//   2. Act as the message router for the popup/options pages (SHARE_LINK,
//      auth, device management) — centralizing this here (rather than the
//      popup calling apiClient directly) means the offline queue and retry
//      logic work even if the popup is closed mid-request.
//   3. Drain the offline queue on `online` events / extension startup.

import type { RuntimeMessage, ShareRequestPayload } from "../types";
import { onTabChanged } from "../services/chromeApi";
import * as api from "../services/apiClient";
import * as auth from "../services/auth";
import { enqueueShare, getOfflineQueue, removeFromQueue } from "../services/storage";
import { generateUuid } from "../utils/domain";

onTabChanged((tab) => {
  chrome.runtime.sendMessage({ type: "TAB_CHANGED", payload: tab }).catch(() => {
    // No popup open to receive it — fine, popup re-fetches on open anyway.
  });
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // keep the message channel open for the async response
});

chrome.runtime.onStartup.addListener(() => void drainOfflineQueue());
self.addEventListener("online", () => void drainOfflineQueue());

async function handleMessage(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case "SHARE_LINK":
      return shareLinkWithFallback(message.payload);
    case "GET_AUTH_SESSION":
      return auth.getSession();
    case "SIGN_IN":
      return auth.signIn();
    case "SIGN_OUT":
      return auth.signOut();
    case "DRAIN_OFFLINE_QUEUE":
      return drainOfflineQueue();
    case "REGISTER_DEVICE":
      return api.registerDevice({ deviceId: generateUuid(), ...message.payload });
    case "REMOVE_DEVICE":
      return api.removeDevice(message.payload.deviceId);
    case "GET_DEVICES":
      // Device list comes back attached to history/analytics responses in
      // this slice; a dedicated GET /api/devices is a small follow-up if a
      // standalone device-management view needs it independent of history.
      return [];
    case "TAB_CHANGED":
      return undefined;
    default:
      return undefined;
  }
}

async function shareLinkWithFallback(payload: ShareRequestPayload) {
  try {
    return { status: "sent" as const, result: await api.shareLink(payload) };
  } catch (err) {
    await enqueueShare({
      id: generateUuid(),
      payload,
      attempts: 0,
      createdAt: Date.now(),
    });
    return { status: "queued" as const, error: (err as Error).message };
  }
}

async function drainOfflineQueue(): Promise<{ drained: number; remaining: number }> {
  const queue = await getOfflineQueue();
  let drained = 0;
  for (const item of queue) {
    try {
      await api.shareLink(item.payload);
      await removeFromQueue(item.id);
      drained += 1;
    } catch {
      // Leave it queued; attempts tracking lets a future pass give up after
      // N tries and surface a persistent error state in the popup instead
      // of retrying forever.
      item.attempts += 1;
    }
  }
  const remaining = (await getOfflineQueue()).length;
  return { drained, remaining };
}
