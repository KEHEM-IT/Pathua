# API Specification

Base URL: `https://pathua-api.vercel.app/api` (placeholder — set via `EXTENSION_API_BASE_URL` build env)

All endpoints except none require `Authorization: Bearer <Firebase ID token>`. There is no
unauthenticated endpoint in this API — even a health check returns 401 without a token, by design
(no need to leak server existence/version info publicly).

## Conventions

- All responses are JSON, `Content-Type: application/json`.
- Success shape: `{ "ok": true, "data": <T> }`
- Error shape: `{ "ok": false, "error": { "code": "string", "message": "string" } }`
- Validation errors use `code: "VALIDATION_ERROR"` and include a `fields` map.
- All timestamps are ISO-8601 UTC strings.

---

## `POST /api/share`

Create a share event and fan out an FCM push to the target device(s).

**Request body**
```jsonc
{
  "title": "Vue 3 Docs",
  "url": "https://vuejs.org/guide/",
  "favicon": "https://vuejs.org/favicon.ico",   // optional
  "timestamp": "2026-06-24T22:10:00Z",
  "deviceIds": ["dev_8f2c91"]                    // omit or [] => fan out to ALL active devices
}
```

**Validation** (`zod`): `title` 1-300 chars, `url` must be a valid `https?://` URL ≤ 2048 chars,
`favicon` optional valid URL, `timestamp` ISO date not more than 60s in the future/past (clock
skew guard), `deviceIds` array of strings, each must belong to `req.uid` (checked server-side,
not just shaped-checked — a deviceId belonging to another user is a 403, not silently ignored).

**Response `200`**
```jsonc
{
  "ok": true,
  "data": {
    "shareId": "shr_3c91ab",
    "duplicate": false,
    "delivered": [
      { "deviceId": "dev_8f2c91", "label": "Samsung Phone", "status": "sent" }
    ]
  }
}
```

**Response `200` (duplicate suppressed)**
```jsonc
{ "ok": true, "data": { "shareId": "shr_3c91ab", "duplicate": true, "delivered": [] } }
```
A duplicate is **not** an error — it's a normal, successful no-op so the extension UI doesn't
show a scary red toast for double-clicking a button.

**Errors**: `401 UNAUTHENTICATED`, `400 VALIDATION_ERROR`, `403 FORBIDDEN` (deviceId not owned),
`404 NO_DEVICES` (deviceIds empty and user has zero active devices), `429 RATE_LIMITED`,
`502 FCM_UPSTREAM_ERROR` (Firestore write succeeded but FCM call itself failed — `delivered`
reflects per-device failures so the share is still recorded).

---

## `POST /api/device/register`

Register or refresh an FCM token for a device.

**Request body**
```jsonc
{ "deviceId": "dev_8f2c91", "label": "Samsung Phone", "platform": "android-web", "fcmToken": "dEf456..." }
```
`deviceId` is client-generated (UUID) and stable per install; if it already exists for this uid,
this call **upserts** (refreshes the token + `lastSeenAt`) rather than creating a duplicate device.

**Validation**: `deviceId` UUID-ish string, `label` 1-60 chars, `platform` enum
(`"android-web" | "android"`), `fcmToken` non-empty string ≤ 4096 chars.

**Response `201` (created) / `200` (updated)**
```jsonc
{ "ok": true, "data": { "deviceId": "dev_8f2c91", "label": "Samsung Phone", "platform": "android-web" } }
```
Note `fcmToken` is **never echoed back** in the response body, even though the caller just sent
it — see `docs/SECURITY.md`.

**Errors**: `401`, `400 VALIDATION_ERROR`, `429 RATE_LIMITED`.

---

## `POST /api/device/remove`

**Request body**: `{ "deviceId": "dev_8f2c91" }`

**Response `200`**: `{ "ok": true, "data": { "deviceId": "dev_8f2c91", "removed": true } }`

**Errors**: `401`, `404 DEVICE_NOT_FOUND` (or not owned by caller — same error either way, to avoid
leaking existence of other users' device IDs).

---

## `GET /api/history`

Paginated, searchable, filterable list of the caller's share history.

**Query params**: `q` (search title/url/domain, optional), `domain` (exact filter, optional),
`sharedOnly` (`"true"` to only return rows with `sharedTo.length > 0`), `limit` (default 20, max
100), `cursor` (opaque, from previous response's `data.nextCursor`).

**Response `200`**
```jsonc
{
  "ok": true,
  "data": {
    "items": [
      {
        "shareId": "shr_3c91ab", "title": "Vue 3 Docs", "url": "https://vuejs.org/guide/",
        "domain": "vuejs.org", "favicon": "https://vuejs.org/favicon.ico",
        "qrGenerated": true, "sharedTo": ["dev_8f2c91"], "createdAt": "2026-06-24T22:10:00Z"
      }
    ],
    "nextCursor": "eyJjcmVhdGVkQXQiOi..."   // null when no more pages
  }
}
```

**Errors**: `401`, `400 VALIDATION_ERROR` (bad `limit`/`cursor`).

Also: `DELETE /api/history/:shareId` — removes one entry (`200 { removed: true }` or `404`), and
`POST /api/history/:shareId/reshare` — re-runs the share flow (same dedupe rules apply, body is
just `{ "deviceIds": [...] }`) without the caller having to resend `title`/`url`/`favicon`.

---

## `GET /api/analytics`

**Query params**: `range` = `"7d" | "30d" | "90d"` (default `"7d"`).

**Response `200`**
```jsonc
{
  "ok": true,
  "data": {
    "totalQrGenerated": 41,
    "totalShared": 12,
    "topDomains": [ { "domain": "vuejs.org", "count": 9 }, { "domain": "github.com", "count": 6 } ],
    "daily": [ { "date": "2026-06-24", "qrGenerated": 5, "shares": 2 } ]
  }
}
```

**Errors**: `401`, `400 VALIDATION_ERROR` (bad `range`).

---

## `POST /api/notification/send`

Internal/admin-only re-send hook (e.g. retry a `failed` notification from the offline queue
without re-running dedupe). Requires the caller's own `uid` to match the notification's `uid` —
this is not a privileged admin role, just an explicit "retry mine" endpoint.

**Request body**: `{ "notificationId": "ntf_a01" }`

**Response `200`**: `{ "ok": true, "data": { "notificationId": "ntf_a01", "status": "sent" } }`

**Errors**: `401`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 ALREADY_DELIVERED`.

---

## Error code reference

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | Missing/invalid/expired Firebase ID token |
| `VALIDATION_ERROR` | 400 | Body/query failed zod schema |
| `FORBIDDEN` | 403 | Resource exists but isn't owned by caller |
| `NOT_FOUND` / `DEVICE_NOT_FOUND` / `NO_DEVICES` | 404 | — |
| `RATE_LIMITED` | 429 | Too many requests — see `docs/SECURITY.md` for limits |
| `FCM_UPSTREAM_ERROR` | 502 | FCM API call itself failed (network/quota) |
| `INTERNAL_ERROR` | 500 | Unhandled — logged with a request id, never leaks stack traces to the client |
