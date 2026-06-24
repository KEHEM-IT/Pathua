# Security Checklist

## Threat model summary

The two things worth attacking here are: (1) someone else's FCM token / device list (lets an
attacker spam push notifications to a stranger's phone), and (2) someone else's link history
(privacy leak of browsing activity). Both are mitigated by the same rule: **every query is scoped
to `req.uid` derived from a verified Firebase ID token, never from a client-supplied uid field.**

## Authentication

- [x] Firebase ID tokens verified server-side with `firebase-admin/auth` `verifyIdToken()` — never
      trust a `uid` field in a request body; always use the uid decoded from the verified token.
- [x] Token verification happens once, in `auth.middleware`, before any route handler runs.
- [x] Clock-skew tolerant but still rejects tokens whose `exp` has passed — no manual JWT decoding,
      always the Admin SDK's verifier (handles key rotation automatically).
- [x] `chrome.identity` is used for sign-in so no password/credential ever touches our server.

## Authorization

- [x] `deviceId`/`shareId`/`notificationId` ownership is checked against `req.uid` in the
      controller before any read/write/delete — a syntactically valid ID belonging to another
      user returns `403`/`404` (404 specifically when revealing existence would itself be a leak,
      e.g. device lookups — see API_SPEC).
- [x] No endpoint accepts a `uid` in the request body that is then trusted.

## Input validation

- [x] Every route validates `body`/`query`/`params` with a `zod` schema in `validate.middleware`
      before the controller sees the request — malformed input never reaches business logic.
- [x] URL fields are validated as real `http(s)://` URLs with a max length, not just "non-empty
      string", to stop `javascript:`/`data:` URL QR-and-share abuse.
- [x] String length caps everywhere (`title` ≤ 300, `label` ≤ 60, `fcmToken` ≤ 4096) to bound
      Firestore document size and prevent storage-cost abuse.

## Secrets and sensitive data

- [x] `fcmToken` is write-only from the client's perspective — no endpoint ever returns it in a
      response body, including the registration endpoint that just received it. Only the backend
      Admin SDK reads it (to call FCM).
- [x] Firebase service account key lives in a Vercel encrypted environment variable
      (`FIREBASE_SERVICE_ACCOUNT_JSON`, base64-encoded), never committed to the repo. `.env` and
      `*.serviceaccount.json` are in `.gitignore`.
- [x] CORS allow-list is the extension's own origin (`chrome-extension://<id>`) plus, during
      local dev, `http://localhost:*` — never `*`.

## Transport and headers

- [x] `helmet()` applied globally for standard security headers (HSTS, `X-Content-Type-Options`,
      no `X-Powered-By`, etc.).
- [x] All traffic is HTTPS-only (Vercel default); the manifest's host permission is an `https://`
      origin, never `http://`.

## Rate limiting and abuse prevention

- [x] Per-uid + per-IP rate limiting on `POST /api/share` (e.g. 30/min) and
      `POST /api/device/register` (e.g. 10/min) — generous enough for real usage, tight enough to
      stop a runaway loop or malicious script from FCM-bombing a device.
- [x] Backend-side duplicate detection (10s window on `uid + urlHash`) is authoritative —
      independent of and in addition to any client-side debounce, which is purely cosmetic.
- [x] Dead/`NotRegistered` FCM tokens are marked `isActive: false` on first failure rather than
      retried forever — stops wasted FCM calls and alerts the user to re-pair the device.

## Firestore Security Rules

- [x] Default-deny; every collection has an explicit owner-scoped rule (see
      `docs/FIRESTORE_SCHEMA.md` for the summary, `backend/firestore.rules` for the real file).
- [x] `notifications` and `share_history` (top-level) are not client-readable at all — the
      extension only ever sees its own data through the backend API, which applies extra business
      logic (pagination, search, redaction) that raw Firestore Rules can't express.

## Error handling and logging

- [x] A global Express error handler (`errorHandler.middleware`) catches everything, logs with a
      request id, and returns a generic `INTERNAL_ERROR` to the client — stack traces and
      internal error messages never reach the response body.
- [x] No PII (raw URLs, emails) in log lines at `info` level in production — only at `debug`,
      which is off by default.

## Chrome Extension specific

- [x] `manifest.json` requests the minimum permission set (`activeTab`, `storage`, `identity`,
      one explicit host permission for the API origin) — see ARCHITECTURE.md §5 for the full
      justification table.
- [x] Content Security Policy in the manifest disallows remote code execution
      (`script-src 'self'`); Tailwind/FontAwesome are loaded from CDN as **stylesheets**, not
      scripts that execute in the extension's privileged context.
- [x] `popup.html` never uses `eval`/`innerHTML` with untrusted (page-supplied) content — page
      title is inserted via `textContent`, not HTML, to avoid script injection from a malicious
      page's `<title>`.

## Things deliberately out of scope (documented, not silently skipped)

- No anti-abuse CAPTCHA — login is gated by Google's own bot detection on Sign-In, which is the
  appropriate layer for that concern.
- No end-to-end encryption of share payloads — title/URL/favicon are already visible to whoever
  visited the page; the security property we actually need is "only the intended device(s)
  receive it," not confidentiality from Google/Firebase infrastructure itself.
