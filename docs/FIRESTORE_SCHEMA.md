# Firestore Data Model

## Collections overview

```
users/{uid}
  └─ devices/{deviceId}
  └─ history/{shareId}
  └─ settings/{settingsId}   (singleton doc, id = "default")

share_history/{shareId}        (top-level, for backend dedupe queries across the whole DB)
notifications/{notificationId} (delivery log, separate from share_history for retry/audit)
analytics/{uid}_{yyyymmdd}     (daily rollup doc per user)
```

We keep a **top-level `share_history`** collection (queryable by `uid` + `urlHash` + `createdAt`) for the dedupe check, rather than only a subcollection under `users/{uid}/history`, because Firestore subcollection queries still need a collection-group index either way — making it top-level keeps the dedupe query and the security rule for it simple and explicit, and avoids a collection-group index on every deploy.

## `users/{uid}`

```jsonc
{
  "uid": "f3a1...",                 // Firebase Auth UID, doc id == uid
  "email": "user@example.com",
  "displayName": "BpyTutor",
  "photoURL": "https://...",
  "createdAt": "2026-01-04T10:00:00Z",
  "lastActiveAt": "2026-06-25T09:12:00Z",
  "plan": "free",                    // "free" | "pro" — reserved for future gating
  "stats": {                         // denormalized counters, updated via transaction
    "totalQrGenerated": 142,
    "totalShared": 38
  }
}
```

No password, no payment info — never stored. `email`/`displayName`/`photoURL` are mirrored from the Google ID token at first sign-in only (not re-synced on every login) to avoid surprising writes.

## `users/{uid}/devices/{deviceId}`

```jsonc
{
  "deviceId": "dev_8f2c91",
  "label": "Samsung Phone",          // user-editable
  "platform": "android",             // "android" (native, future) | "android-web" (PWA receiver)
  "fcmToken": "dEf456...",            // current FCM registration token
  "tokenUpdatedAt": "2026-06-20T08:00:00Z",
  "createdAt": "2026-05-01T12:00:00Z",
  "lastSeenAt": "2026-06-24T22:10:00Z",
  "isActive": true                    // false if token invalidated (NotRegistered from FCM)
}
```

`fcmToken` is never returned to any client other than the owning device's own registration flow — list/history endpoints only ever return `deviceId` + `label` + `platform`, never the raw token (see `docs/SECURITY.md`).

## `share_history/{shareId}` (and mirrored at `users/{uid}/history/{shareId}`)

```jsonc
{
  "shareId": "shr_3c91ab",
  "uid": "f3a1...",
  "title": "Vue 3 Docs",
  "url": "https://vuejs.org/guide/",
  "urlHash": "9c1f...sha256",         // sha256(url) — indexed for dedupe + dedupe range query
  "domain": "vuejs.org",
  "favicon": "https://vuejs.org/favicon.ico",
  "qrGenerated": true,
  "sharedTo": ["dev_8f2c91"],          // empty array if only QR'd, never shared
  "delivery": [
    { "deviceId": "dev_8f2c91", "status": "sent", "sentAt": "2026-06-24T22:10:01Z" }
  ],
  "createdAt": "2026-06-24T22:10:00Z"
}
```

`urlHash` (not the raw `url`) is the field actually indexed for the duplicate-detection query (`where uid == :uid and urlHash == :hash and createdAt > now-10s`) — keeps the composite index small and avoids ever needing a full-text-style index on long URLs.

## `notifications/{notificationId}`

```jsonc
{
  "notificationId": "ntf_a01",
  "shareId": "shr_3c91ab",
  "uid": "f3a1...",
  "deviceId": "dev_8f2c91",
  "fcmMessageId": "projects/.../messages/0:172...",
  "status": "delivered",              // "sent" | "delivered" | "failed" | "token_invalid"
  "errorCode": null,
  "createdAt": "2026-06-24T22:10:01Z"
}
```

Separated from `share_history` because one share can fan out to N devices → N notification docs, and because retry logic needs to mutate `status` independently without touching the immutable share record.

## `users/{uid}/settings/default`

```jsonc
{
  "theme": "system",                  // "light" | "dark" | "system"
  "defaultQrOptions": {
    "color": "#000000",
    "backgroundColor": "#ffffff",
    "margin": 4,
    "size": 256,
    "errorCorrection": "M"
  },
  "shareToAllByDefault": false
}
```

## `analytics/{uid}_{yyyymmdd}`

```jsonc
{
  "uid": "f3a1...",
  "date": "2026-06-24",
  "qrGenerated": 5,
  "shares": 2,
  "domains": { "vuejs.org": 3, "github.com": 2 }
}
```

Written via an incrementing transaction from `share.controller` / a future `qr.controller`, never recomputed from scratch on read — `GET /api/analytics` just ranges over the last N daily docs and sums client-side, keeping reads O(days) not O(events).

## Composite indexes required

| Collection | Fields | Used by |
|---|---|---|
| `share_history` | `uid` ASC, `urlHash` ASC, `createdAt` DESC | Dedupe check |
| `share_history` | `uid` ASC, `createdAt` DESC | History list + search/filter |
| `analytics` | `uid` ASC, `date` DESC | Analytics range query |

## Firestore Security Rules (summary — full file ships at `backend/firestore.rules`)

```
- users/{uid}: read/write only if request.auth.uid == uid
- users/{uid}/devices/{id}: read/write only if request.auth.uid == uid; fcmToken never readable
  by rules to anyone but the owner (rules can't redact fields, so the backend, not the client
  SDK, is the only writer/reader of devices in practice — Firestore Rules here are defense in
  depth, the extension talks to devices exclusively through the backend API)
- share_history/{id}: create only via backend (Admin SDK bypasses rules); client reads of their
  own history go through users/{uid}/history mirror, read-only, owner-only
- notifications/{id}: no client access at all — backend/Admin SDK only
- analytics/{uid}_{date}: read-only, owner-only; writes are Admin SDK only
```

We deliberately route almost everything through the backend (Admin SDK) rather than letting the
extension talk to Firestore directly with the client SDK — this keeps the dedupe check, FCM
fan-out, and analytics increments atomic and server-authoritative, and means Security Rules only
need to gate *reads*, which is a much simpler rule surface to get right than read+write rules for
every collection.
