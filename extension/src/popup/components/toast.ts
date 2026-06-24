// Toast notifications — in-page (not chrome.notifications), since these are
// transient confirmations scoped to the popup's own lifetime, not something
// that needs to survive the popup closing.

export type ToastVariant = "default" | "success" | "error";

export function showToast(message: string, variant: ToastVariant = "default"): void {
  const stack = document.getElementById("toastStack");
  if (!stack) return;
  const el = document.createElement("div");
  el.className = `toast${variant !== "default" ? ` toast--${variant}` : ""}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
