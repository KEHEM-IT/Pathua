// Small, framework-agnostic helpers. Kept separate from chromeApi.ts because
// these have zero chrome.* dependency and are unit-testable in plain Node.

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Cosmetic, client-side-only debounce so the UI doesn't fire two requests on
 * a double-click. This is NOT the authoritative dedupe — see
 * docs/SECURITY.md and dedupe.service.ts on the backend for the real check.
 */
export function createDebounceGuard(windowMs: number) {
  const lastFiredAt = new Map<string, number>();
  return (key: string): boolean => {
    const now = Date.now();
    const last = lastFiredAt.get(key) ?? 0;
    if (now - last < windowMs) return true; // is a duplicate, caller should skip
    lastFiredAt.set(key, now);
    return false;
  };
}
