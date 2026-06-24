# Architecture

## 1. Design decisions (and the alternatives we rejected)

**Why Manifest V3 service worker instead of a persistent background page?**
MV3 is mandatory for new Chrome Web Store listings; persistent background pages are gone. The service worker is event-driven and can be killed by Chrome at any time, so we never hold state in module-level variables — everything that must survive a restart lives in `chrome.storage.local` (device list, last-shared cache for dedupe) or Firestore (history, devices, analytics). The popup talks to the service worker only via `chrome.runtime.sendMessage`, never by assuming it's "already running."

**Why QRCode.js client-side instead of a backend QR endpoint?**
QR generation is pure, fast, and has zero need for secrets — doing it in the popup means zero network round-trip, works offline, and removes an entire API surface (and its abuse vector: someone hammering a public QR-render endpoint). The backend never generates QR images; it only ever handles auth, history, devices, and push.

**Why Firebase Auth + Google Sign-In instead of a custom email/password system?**
The extension's only consumer is the popup; we don't want to own password resets, email verification, or credential storage. `chrome.identity.getAuthToken` (or `launchWebAuthFlow` for the OAuth code flow) gets a Google ID token, which the backend verifies with `firebase-admin`'s `verifyIdToken`. No password ever touches our server.

**Why Firestore instead of a relational DB?**
Data is naturally document-shaped and per-user-partitioned (`users/{uid}/devices`, `users/{uid}/history`). Security Rules let us enforce "a user can only ever read/write their own subtree" at the database layer, as defense-in-depth even if a backend bug leaked another user's UID. Firestore also gives us free real-time listeners later (e.g. live "delivered" status on a share) without adding a websocket server.

**Why Vercel for the backend instead of Cloud Functions?**
The spec calls for Express + Vercel explicitly. Vercel's Node serverless functions run our Express app via a single catch-all handler. Trade-off accepted: cold starts and a 10s default execution limit (acceptable — every route here is a quick Firestore/FCM call), in exchange for git-push deploys, preview URLs per PR, and not having to learn GCF's separate deploy story. If usage ever needs background workers (e.g. batch analytics rollups), that becomes a separate Cloud Function or Vercel Cron — not a reason to move the whole API.

**Why dedupe in the backend, not the extension?**
The extension is stateless across browser restarts. A user could trigger "Share" from two devices logged into the same account, or rapid double-clicks. We do an optimistic client-side debounce (UI-level, cosmetic) *and* an authoritative backend check (Firestore query on `share_history` for the same `uid+url` within a 10s window) before writing or sending FCM — the client-side guard is just to keep the UI feeling instant, never the source of truth.

## 2. High-level system diagram

```
┌─────────────────────────────┐
│        Chrome Browser        │
│  ┌────────────┐  ┌────────┐ │
│  │ Popup (UI) │  │Content │ │
│  │  popup.ts  │  │ script │ │
│  └─────┬──────┘  └────┬───┘ │
│        │ runtime msg   │     │
│  ┌─────▼─────────────▼───┐  │
│  │ Service Worker (MV3)   │  │
│  │ background/service-    │  │
│  │ worker.ts               │  │
│  │ - tab change listener   │  │
│  │ - message router        │  │
│  │ - offline queue drain   │  │
│  └─────────┬───────────────┘  │
└────────────┼──────────────────┘
             │ HTTPS (Firebase ID token in Authorization header)
             ▼
┌─────────────────────────────────────┐
│     Backend API (Express on Vercel)  │
│  routes → middleware → controllers   │
│  - auth.middleware (verifyIdToken)   │
│  - rateLimit.middleware              │
│  - validate.middleware (zod)         │
│        │                              │
│        ▼                              │
│  services/                            │
│   firestore.service  fcm.service      │
│   dedupe.service     firebaseAdmin    │
└────────┬───────────────────┬──────────┘
         │                   │
         ▼                   ▼
  ┌─────────────┐    ┌──────────────────┐
  │  Firestore  │    │ Firebase Cloud    │
  │  users/     │    │ Messaging (FCM)   │
  │  devices/   │    └─────────┬─────────┘
  │  history/   │              │
  │  analytics/ │              ▼
  └─────────────┘   ┌────────────────────┐
                     │ Android (PWA/Chrome)│
                     │ receives push,       │
                     │ taps → opens URL      │
                     └────────────────────┘
```

## 3. Request lifecycle: "Share To Phone" (the critical path)

1. User clicks **Share To Phone** in the popup for a specific device (or "All").
2. `popup.ts` calls `apiClient.shareLink()` → `chrome.runtime.sendMessage({type: 'SHARE_LINK', payload})`.
3. Service worker checks `chrome.storage.local` offline queue; if no network, enqueues and returns immediately with `status: 'queued'`.
4. If online, service worker calls `POST /api/share` with the Firebase ID token (refreshed via `chrome.identity` if expired).
5. `auth.middleware` verifies the token → attaches `req.uid`.
6. `validate.middleware` validates the body against a `zod` schema (`title`, `url`, `favicon`, `timestamp`, optional `deviceId`).
7. `share.controller` calls `dedupe.service.isDuplicate(uid, url)` — queries `share_history` for a matching `urlHash` in the last 10s.
8. If not a duplicate: `firestore.service` writes a `share_history` doc, then `fcm.service` sends the push (single device, or fan-out to all of the user's registered tokens).
9. Response returns `{ shareId, delivered: DeviceDeliveryResult[] }` — per-device success/failure (a dead token doesn't fail the whole request).
10. Popup shows a toast per result; failed sends are retried via the offline queue once, then surfaced as an error state.

## 4. Extension-side data flow

```
chrome.tabs.query({active:true,currentWindow:true})
        │
        ▼
  TabInfo {title, url, domain, favicon}
        │
        ▼
  qrGenerator.generate(content, options) ──► QRCode.js ──► canvas/SVG
        │
        ▼
  popup renders preview, enables Download PNG/SVG, Copy, Share
```

Tab-change detection uses `chrome.tabs.onActivated` + `chrome.tabs.onUpdated` (for in-tab navigation) in the service worker, which forwards a `TAB_CHANGED` message to an open popup if one exists; the popup re-fetches the active tab on its own `DOMContentLoaded` regardless, so it's correct even if the service worker missed an event (e.g. it had been killed).

## 5. Why these specific Chrome permissions (see `manifest.json`)

| Permission | Why | Why not broader |
|---|---|---|
| `activeTab` | Read URL/title/favicon of the tab the user is *currently looking at* in the popup | Avoids `tabs` + host permissions for all sites, which would let the extension read every open tab silently |
| `storage` | Offline queue, cached device list, theme preference | — |
| `identity` | Google Sign-In via `chrome.identity` | Avoids shipping our own OAuth redirect dance |
| `scripting` | One-shot favicon-fallback scrape, injected only on a user gesture via `activeTab` | No statically-declared content script matching every page, so no standing host permission for arbitrary sites |
| `downloads` | "Download QR as PNG/SVG" button | — |
| host permission: backend API origin | Backend API calls | We do **not** request `<all_urls>` |

No `tabs` (plural, all-tabs) permission, no `webNavigation`, no `history`, no `bookmarks` — the extension cannot see anything about tabs the user hasn't actively surfaced to the popup.

## 6. Status

Architecture finalized. Implementation in progress — see `STATUS.md` at the repo root for the live checklist of what's coded vs. scaffolded.
