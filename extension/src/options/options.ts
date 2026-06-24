// options.ts — settings page logic.
// Handles: theme, default QR options, device list, sign-out.

import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../services/storage";
import { getSession, signOut } from "../services/auth";
import * as apiClient from "../services/apiClient";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function init() {
  const settings = await getSettings();
  const session = await getSession();

  // ---- Appearance ----
  const themeSelect = $<HTMLSelectElement>("themeSelect");
  themeSelect.value = settings.theme;

  // ---- Default QR ----
  $<HTMLInputElement>("defaultColor").value = settings.defaultQrOptions.color;
  $<HTMLInputElement>("defaultBg").value = settings.defaultQrOptions.backgroundColor;
  $<HTMLSelectElement>("defaultErrorCorrection").value = settings.defaultQrOptions.errorCorrection;
  $<HTMLInputElement>("shareToAllDefault").checked = settings.shareToAllByDefault;

  // ---- Account ----
  if (session) {
    $("accountStatus").textContent = `Signed in as ${session.email ?? session.displayName ?? "Google account"}`;
  } else {
    $("accountStatus").textContent = "Not signed in";
    $<HTMLButtonElement>("signOutBtn").disabled = true;
  }

  // ---- Devices ----
  if (session) {
    await renderDevices();
  }

  // ---- Save ----
  $<HTMLButtonElement>("saveBtn").addEventListener("click", async () => {
    await saveSettings({
      theme: themeSelect.value as typeof settings.theme,
      defaultQrOptions: {
        ...DEFAULT_SETTINGS.defaultQrOptions,
        color: $<HTMLInputElement>("defaultColor").value,
        backgroundColor: $<HTMLInputElement>("defaultBg").value,
        errorCorrection: $<HTMLSelectElement>("defaultErrorCorrection").value as
          typeof settings.defaultQrOptions.errorCorrection,
      },
      shareToAllByDefault: $<HTMLInputElement>("shareToAllDefault").checked,
    });
    showStatus("Settings saved");
  });

  // ---- Sign out ----
  $<HTMLButtonElement>("signOutBtn").addEventListener("click", async () => {
    await signOut();
    $("accountStatus").textContent = "Not signed in";
    $<HTMLButtonElement>("signOutBtn").disabled = true;
    showStatus("Signed out");
  });
}

async function renderDevices() {
  const list = $("deviceList");
  list.innerHTML = "<li>Loading…</li>";
  try {
    const { items } = await apiClient.getHistory({ limit: 0 });
    // Use devices from storage (populated by service worker)
    const { getCachedDevices } = await import("../services/storage");
    const devices = await getCachedDevices();
    list.innerHTML = "";
    if (devices.length === 0) {
      list.innerHTML = '<li class="device-item">No devices registered yet</li>';
      return;
    }
    for (const device of devices) {
      const li = document.createElement("li");
      li.className = "device-item";
      li.innerHTML = `
        <span>${device.label}</span>
        <button class="btn btn--ghost btn--sm" data-id="${device.deviceId}">Remove</button>
      `;
      li.querySelector("button")?.addEventListener("click", async (e) => {
        const id = (e.currentTarget as HTMLButtonElement).dataset.id!;
        await apiClient.removeDevice(id);
        li.remove();
      });
      list.appendChild(li);
    }
  } catch {
    list.innerHTML = '<li class="device-item">Could not load devices</li>';
  }
}

function showStatus(msg: string) {
  const el = document.createElement("p");
  el.textContent = msg;
  el.style.cssText = "color:var(--success);font-size:12px;margin-top:8px";
  $<HTMLButtonElement>("saveBtn").insertAdjacentElement("afterend", el);
  setTimeout(() => el.remove(), 2500);
}

void init();
