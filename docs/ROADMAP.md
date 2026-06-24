# Roadmap & Scalability

## Scalability recommendations

**Firestore read/write hot spots.** `share_history` writes are per-event, not per-second-bucketed,
so there's no monotonic-document-id hot spot to worry about at expected usage (a single user
sharing links). If this ever became multi-tenant-heavy (e.g. a team plan sharing to a shared pool
of devices), shard the dedupe-check index by `domain` as well as `uid` to keep the composite index
small as volume grows.

**FCM fan-out.** `fcm.service` already uses `sendEachForMulticast` (batches up to 500 tokens per
call) rather than looping `send()` per device — matters once "Share To All Devices" users have
more than a couple of registered devices.

**Backend cold starts.** Vercel serverless functions cold-start the Firebase Admin SDK on first
invocation; we initialize it as a module-level singleton (`firebase/admin.ts`) so warm invocations
reuse the same app instance rather than re-parsing the service account JSON every request.

**Analytics.** Daily rollup docs (`analytics/{uid}_{date}`) mean `GET /api/analytics?range=90d`
is at most 90 document reads, never a full collection scan over raw share events — this is the
single most important scalability decision in the schema, since history grows unboundedly but
analytics reads must stay flat.

**Rate limiting at scale.** The current rate limiter is in-memory per serverless instance, which
is fine at current scale but is *not* a global limit across concurrently-cold-started instances.
If abuse becomes a real concern, swap `rateLimit.middleware`'s store for Upstash Redis
(`@upstash/ratelimit`) — same middleware interface, just a different store, no controller changes
needed.

**Multi-region.** Firestore is already regional; if the user base genuinely spans
Bangladesh/South Asia and other regions with latency-sensitive needs, Firestore's
multi-region mode (`nam5`/`eur3`-style) trades a bit of write latency for read availability — not
needed at launch, worth revisiting once there's real traffic data.

## Future roadmap

**Near-term (next few sessions)**
- [ ] Native Android app as an alternative/upgrade to the PWA receiver (richer notification
      actions, foreground service for instant delivery without relying on Chrome's web push
      wake-up latency).
- [ ] Drag-and-drop logo embedding for QR customization (canvas compositing, already stubbed in
      `qrGenerator.ts`'s `EmbeddedLogoOptions` type).
- [ ] Bulk re-share from History (select multiple rows → share all to one device).
- [ ] Bengali (bn) localization of the popup UI — BpyTutor's other projects already target the
      Bangladesh market; `_locales/` structure is ready for this via `chrome.i18n`.

**Mid-term**
- [ ] Team/shared-device plans (`plan: "pro"` already reserved in the user schema) — share to a
      pool of devices owned by teammates, not just your own.
- [ ] Browser-side history sync across multiple Chrome profiles signed into the same Google
      account (currently each install is independent until device registration links them via
      the backend).
- [ ] Public/short-link mode: optionally shorten the shared URL via a `links/{slug}` collection,
      useful when QR-scanning a very long URL produces a dense, hard-to-scan code.

**Long-term**
- [ ] Safari/Firefox extension ports — the `services/` and `types/` layers are already framework-
      agnostic TypeScript with no `chrome.*` calls outside `services/chromeApi.ts`, so a WebExtension
      port is mostly a manifest + `chromeApi.ts` shim rewrite, not a rearchitecture.
- [ ] Self-hosted/BYO-Firebase option for privacy-conscious teams who don't want Google's FCM in
      the loop at all — would require an alternative push transport (e.g. Web Push/VAPID directly)
      behind the same `fcm.service` interface.
