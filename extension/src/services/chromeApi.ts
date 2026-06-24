// Thin, typed wrapper around chrome.* APIs. This is the ONLY file allowed to
// reference `chrome.*` directly outside background/popup/options entry points —
// keeping the boundary here means a future Firefox/Safari port only needs a
// new implementation of this one module's exported functions.

import type { TabInfo } from "../types";

export async function getActiveTab(): Promise<TabInfo> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    throw new Error("No active tab found");
  }
  let domain = "";
  try {
    domain = new URL(tab.url).hostname;
  } catch {
    domain = "";
  }
  return {
    title: tab.title ?? tab.url,
    url: tab.url,
    domain,
    favicon: tab.favIconUrl ?? null,
  };
}

export function onTabChanged(callback: (tab: TabInfo) => void): void {
  const handler = async () => {
    try {
      callback(await getActiveTab());
    } catch {
      // Swallow — e.g. chrome:// pages with no queryable active tab.
    }
  };
  chrome.tabs.onActivated.addListener(handler);
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
    if (changeInfo.status === "complete" || changeInfo.url) {
      handler();
    }
  });
}

export async function sendRuntimeMessage<TResponse>(message: unknown): Promise<TResponse> {
  return chrome.runtime.sendMessage(message) as Promise<TResponse>;
}

export async function storageGet<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as T | undefined;
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function storageRemove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * Injects content.ts on-demand into the active tab using `scripting` +
 * `activeTab` rather than a statically-declared content_script matching
 * every page. This means the extension never has standing host permissions
 * for arbitrary sites — injection only ever happens in direct response to a
 * user gesture in the popup (e.g. "favicon not found, try scraping the page").
 */
export async function injectFaviconFallback(tabId: number): Promise<string | null> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="shortcut icon"]'
      );
      return link?.href ?? null;
    },
  });
  return (result?.result as string | null) ?? null;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
}
