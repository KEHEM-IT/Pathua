// content.ts — minimal content script.
//
// Design decision: we use the `activeTab` + `scripting` permission model
// rather than declaring a static content_script matching every URL. This
// means this file is ONLY injected when the popup explicitly calls
// chrome.scripting.executeScript() — giving us host access only on demand,
// with no standing permissions over arbitrary sites.
//
// Current job: expose a reliable favicon URL as a fallback when
// tab.favIconUrl is missing or an empty string (common on http:// pages
// and some SPAs that set favicons via JS after page load).
//
// The service worker can also send a "PING" message to check whether the
// content script is live in a given tab.

(function () {
  // Guard against double-injection if the popup calls executeScript twice.
  if ((window as Window & { __pathuaInjected?: boolean }).__pathuaInjected) return;
  (window as Window & { __pathuaInjected?: boolean }).__pathuaInjected = true;

  chrome.runtime.onMessage.addListener(
    (message: { type: string }, _sender, sendResponse) => {
      if (message.type === "PING") {
        sendResponse({ alive: true });
        return false;
      }

      if (message.type === "GET_FAVICON") {
        const favicon = resolveFavicon();
        sendResponse({ favicon });
        return false;
      }

      if (message.type === "GET_PAGE_META") {
        sendResponse(getPageMeta());
        return false;
      }
    }
  );

  function resolveFavicon(): string | null {
    // Priority: apple-touch-icon > icon > shortcut icon > og:image fallback
    const selectors = [
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel~="icon"]',
      'link[rel="shortcut icon"]',
    ];
    for (const sel of selectors) {
      const href = document.querySelector<HTMLLinkElement>(sel)?.href;
      if (href) return href;
    }
    // og:image as last resort (gives something recognisable in the notification)
    const og = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
    return og ?? null;
  }

  function getPageMeta(): { title: string; description: string; favicon: string | null } {
    const title = document.title;
    const description =
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ??
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ??
      "";
    return { title, description, favicon: resolveFavicon() };
  }
})();
