// Popup entry point. Orchestrates the three panels (Dashboard, Customize,
// History) over a single shared QR/tab state. Kept as one file (rather than
// a component framework) since the popup is small and short-lived — the
// "components" we do split out (toast, qrTypeFields) are the genuinely
// reusable/stateless pieces; everything else is page-specific wiring.

import type {
  AuthSession,
  DeviceSummary,
  HistoryItem,
  QrCustomizationOptions,
  RuntimeMessage,
  SmartQrInput,
  TabInfo,
} from "../types";
import { getActiveTab, copyToClipboard, downloadDataUrl, sendRuntimeMessage } from "../services/chromeApi";
import { buildQrContent, generateQrPngDataUrl, generateQrSvgString, embedLogo } from "../services/qrGenerator";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "../services/storage";
import * as apiClient from "../services/apiClient";
import { showToast } from "./components/toast";
import { renderQrTypeFields, readQrTypeFields } from "./components/qrTypeFields";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let currentTab: TabInfo | null = null;
let currentOptions: QrCustomizationOptions = DEFAULT_SETTINGS.defaultQrOptions;
let currentQrInput: SmartQrInput = { type: "url" };
let session: AuthSession | undefined;
let svgCache = "";
let pendingLogo: { dataUrl: string; sizeRatio: number } | undefined;

init();

async function init(): Promise<void> {
  await applyTheme();
  wireTabs();
  wireDashboard();
  wireCustomize();
  wireHistory();
  wireHeader();

  session = await sendRuntimeMessage<AuthSession | undefined>({ type: "GET_AUTH_SESSION" });
  renderAuthState();

  currentOptions = (await getSettings()).defaultQrOptions;
  try {
    currentTab = await getActiveTab();
    renderTabCard(currentTab);
    currentQrInput = { type: "url", url: currentTab.url };
    await regenerateQr();
  } catch {
    $("tabTitle").textContent = "No active tab";
    $("tabDomain").textContent = "Open a regular webpage to generate a QR code.";
  }

  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "TAB_CHANGED") {
      currentTab = message.payload;
      renderTabCard(currentTab);
      if (currentQrInput.type === "url") {
        currentQrInput = { type: "url", url: currentTab.url };
        void regenerateQr();
      }
    }
  });
}

// ---------------------------------------------------------------- tabs ----

function wireTabs(): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab!;
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
      document.querySelectorAll(".panel").forEach((p) => {
        p.setAttribute("hidden", "");
        p.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      const panel = $(`panel-${target}`);
      panel.removeAttribute("hidden");
      panel.classList.add("is-active");
      if (target === "history") void loadHistory();
    });
  });
}

// ----------------------------------------------------------- dashboard ----

function renderTabCard(tab: TabInfo): void {
  $("tabTitle").textContent = tab.title;
  $("tabDomain").textContent = tab.domain;
  const fav = $<HTMLImageElement>("tabFavicon");
  fav.src = tab.favicon ?? `https://${tab.domain}/favicon.ico`;
  fav.onerror = () => {
    fav.style.visibility = "hidden";
  };
}

async function regenerateQr(): Promise<void> {
  const content = buildQrContent(currentQrInput);
  if (!content) return;
  const skeleton = $("qrSkeleton");
  const img = $<HTMLImageElement>("qrImage");
  skeleton.style.display = "grid";
  img.hidden = true;
  try {
    let png = await generateQrPngDataUrl(content, currentOptions);
    if (pendingLogo) {
      png = await embedLogo(png, pendingLogo, currentOptions.size);
    }
    svgCache = await generateQrSvgString(content, currentOptions);
    img.src = png;
    img.hidden = false;
    skeleton.style.display = "none";
    playScanline();
  } catch (err) {
    showToast("Couldn't generate that QR code", "error");
    skeleton.style.display = "none";
    console.error(err);
  }
}

function playScanline(): void {
  const line = $("qrScanline");
  line.classList.remove("is-playing");
  // restart the CSS animation
  void line.offsetWidth;
  line.classList.add("is-playing");
}

function wireDashboard(): void {
  $("copyUrlBtn").addEventListener("click", async () => {
    if (!currentTab) return;
    await copyToClipboard(currentTab.url);
    showToast("Link copied", "success");
  });

  $("downloadPngBtn").addEventListener("click", () => {
    const img = $<HTMLImageElement>("qrImage");
    if (!img.src) return;
    downloadDataUrl(img.src, `pathua-qr-${Date.now()}.png`);
  });

  $("downloadSvgBtn").addEventListener("click", () => {
    if (!svgCache) return;
    const blobUrl = `data:image/svg+xml;base64,${btoa(svgCache)}`;
    downloadDataUrl(blobUrl, `pathua-qr-${Date.now()}.svg`);
  });

  $("shareBtn").addEventListener("click", onShareClick);
  $("signInBtn").addEventListener("click", onSignInClick);

  void loadDevices();
}

let selectedDeviceIds = new Set<string>();

async function loadDevices(): Promise<void> {
  if (!session) return;
  const row = $("deviceRow");
  row.innerHTML = "";
  // GET_DEVICES is a stub on the service-worker side pending a dedicated
  // endpoint — see background/service-worker.ts's comment on that branch.
  const devices: DeviceSummary[] = await sendRuntimeMessage({ type: "GET_DEVICES" });
  for (const device of devices) {
    const chip = document.createElement("button");
    chip.className = "device-chip";
    chip.textContent = device.label;
    chip.addEventListener("click", () => {
      if (selectedDeviceIds.has(device.deviceId)) {
        selectedDeviceIds.delete(device.deviceId);
        chip.classList.remove("is-selected");
      } else {
        selectedDeviceIds.add(device.deviceId);
        chip.classList.add("is-selected");
      }
    });
    row.appendChild(chip);
  }
}

async function onShareClick(): Promise<void> {
  if (!currentTab) return;
  if (!session) {
    showToast("Sign in to share to a device", "error");
    return;
  }
  const btn = $<HTMLButtonElement>("shareBtn");
  btn.disabled = true;
  try {
    const result = await apiClient.shareLink({
      title: currentTab.title,
      url: currentTab.url,
      favicon: currentTab.favicon ?? undefined,
      timestamp: new Date().toISOString(),
      deviceIds: selectedDeviceIds.size ? Array.from(selectedDeviceIds) : undefined,
    });
    if (result.duplicate) {
      showToast("Already shared a moment ago", "default");
    } else if (result.delivered.every((d) => d.status === "sent")) {
      showToast(`Sent to ${result.delivered.length || "all"} device(s)`, "success");
    } else {
      showToast("Sent, but one or more devices failed", "error");
    }
  } catch (err) {
    showToast("Couldn't reach the server — queued for retry", "error");
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

async function onSignInClick(): Promise<void> {
  try {
    session = await sendRuntimeMessage({ type: "SIGN_IN" });
    renderAuthState();
    showToast(`Signed in as ${session?.email ?? "Google account"}`, "success");
    void loadDevices();
  } catch (err) {
    showToast("Sign-in failed", "error");
    console.error(err);
  }
}

function renderAuthState(): void {
  $("signedOutState").hidden = Boolean(session);
  $<HTMLButtonElement>("shareBtn").disabled = !session;
}

// ----------------------------------------------------------- customize ----

function wireCustomize(): void {
  const typeSelect = $<HTMLSelectElement>("qrTypeSelect");
  const fieldsContainer = $("qrTypeFields");
  renderQrTypeFields(fieldsContainer, "url");

  typeSelect.addEventListener("change", () => {
    renderQrTypeFields(fieldsContainer, typeSelect.value as SmartQrInput["type"]);
  });

  $<HTMLInputElement>("qrSize").addEventListener("input", (e) => {
    $("qrSizeValue").textContent = (e.target as HTMLInputElement).value;
  });
  $<HTMLInputElement>("qrMargin").addEventListener("input", (e) => {
    $("qrMarginValue").textContent = (e.target as HTMLInputElement).value;
  });

  $<HTMLInputElement>("qrLogoInput").addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      pendingLogo = undefined;
      return;
    }
    pendingLogo = { dataUrl: await fileToDataUrl(file), sizeRatio: 0.2 };
  });

  $("applyCustomizationBtn").addEventListener("click", async () => {
    const type = typeSelect.value as SmartQrInput["type"];
    currentQrInput =
      type === "url" && currentTab ? { type: "url", url: currentTab.url } : readQrTypeFields(fieldsContainer, type);

    currentOptions = {
      color: $<HTMLInputElement>("qrColor").value,
      backgroundColor: $<HTMLInputElement>("qrBgColor").value,
      margin: Number($<HTMLInputElement>("qrMargin").value),
      size: Number($<HTMLInputElement>("qrSize").value),
      errorCorrection: $<HTMLSelectElement>("qrErrorCorrection").value as QrCustomizationOptions["errorCorrection"],
      embeddedLogo: pendingLogo,
    };
    await saveSettings({ ...(await getSettings()), defaultQrOptions: currentOptions });
    await regenerateQr();
    document.querySelector<HTMLButtonElement>('.tab[data-tab="dashboard"]')?.click();
    showToast("QR updated", "success");
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// -------------------------------------------------------------- history ----

function wireHistory(): void {
  let activeFilter: "all" | "shared" = "all";
  $<HTMLInputElement>("historySearch").addEventListener("input", debounce(() => loadHistory(activeFilter), 250));
  document.querySelectorAll<HTMLButtonElement>(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      activeFilter = chip.dataset.filter as "all" | "shared";
      void loadHistory(activeFilter);
    });
  });
}

async function loadHistory(filter: "all" | "shared" = "all"): Promise<void> {
  if (!session) {
    $("historyEmptyState").hidden = false;
    return;
  }
  const q = $<HTMLInputElement>("historySearch").value.trim();
  try {
    const { items } = await apiClient.getHistory({ q: q || undefined, sharedOnly: filter === "shared" });
    renderHistory(items);
  } catch (err) {
    showToast("Couldn't load history", "error");
    console.error(err);
  }
}

function renderHistory(items: HistoryItem[]): void {
  const list = $("historyList");
  list.innerHTML = "";
  $("historyEmptyState").hidden = items.length > 0;
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "history-item";
    const img = document.createElement("img");
    img.className = "history-favicon";
    img.src = item.favicon ?? `https://${item.domain}/favicon.ico`;
    const meta = document.createElement("div");
    meta.className = "history-meta";
    const title = document.createElement("p");
    title.className = "history-title";
    title.textContent = item.title;
    const domain = document.createElement("p");
    domain.className = "history-domain";
    domain.textContent = item.domain;
    meta.append(title, domain);
    const actions = document.createElement("div");
    actions.className = "history-actions";
    const reshareBtn = document.createElement("button");
    reshareBtn.className = "icon-btn";
    reshareBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
    reshareBtn.addEventListener("click", async () => {
      try {
        await apiClient.reshare(item.shareId, []);
        showToast("Re-shared", "success");
      } catch {
        showToast("Re-share failed", "error");
      }
    });
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn";
    deleteBtn.innerHTML = '<i class="fa-regular fa-trash-can"></i>';
    deleteBtn.addEventListener("click", async () => {
      await apiClient.deleteHistoryItem(item.shareId);
      li.remove();
    });
    actions.append(reshareBtn, deleteBtn);
    li.append(img, meta, actions);
    list.appendChild(li);
  }
}

// --------------------------------------------------------------- header ----

function wireHeader(): void {
  $("themeToggle").addEventListener("click", async () => {
    const app = $("app");
    const order = ["system", "light", "dark"] as const;
    const next = order[(order.indexOf(app.dataset.theme as (typeof order)[number]) + 1) % order.length]!;
    app.dataset.theme = next;
    const settings = await getSettings();
    await saveSettings({ ...settings, theme: next });
  });

  $("authBtn").addEventListener("click", async () => {
    if (session) {
      await sendRuntimeMessage({ type: "SIGN_OUT" });
      session = undefined;
      renderAuthState();
      showToast("Signed out");
    } else {
      void onSignInClick();
    }
  });
}

async function applyTheme(): Promise<void> {
  const settings = await getSettings();
  $("app").dataset.theme = settings.theme;
}

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: never[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

