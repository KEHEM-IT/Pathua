# Pathua

> Instantly turn the page you're on into a QR code — and beam the link straight to your phone.

Pathua ("পাঠানো" — "to send", Bengali) is a production-grade Chrome Extension (Manifest V3) paired with a Firebase-backed Node.js API. It detects the active tab, generates a customizable QR code on the spot, and can push the link to one or more registered Android devices via Firebase Cloud Messaging (FCM).

This repository is a monorepo with two independently deployable packages:

```
Sitara/
├── extension/     Chrome Extension (MV3) — TypeScript, Tailwind (CDN), QRCode.js
├── backend/       REST API — Node.js, Express, TypeScript, Firebase Admin SDK
└── docs/          Architecture, schema, API spec, security, deployment, roadmap
```

## Quick links

| Doc | Purpose |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System diagram, design decisions, data flow |
| [`docs/FIRESTORE_SCHEMA.md`](docs/FIRESTORE_SCHEMA.md) | Full Firestore data model + indexes + rules |
| [`docs/API_SPEC.md`](docs/API_SPEC.md) | Every backend endpoint, request/response, errors |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Threat model + security checklist |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Firebase + Vercel deployment, step by step |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Scalability notes + future features |

## Status

This is being built incrementally. See the bottom of each doc and the `STATUS.md` checklist for what's implemented vs. scaffolded.

## Why "Android Flow" means Web Push, not a native app

The original spec describes an "Android Flow" receiving FCM notifications. Building a native Android app is out of scope for this repo (it's a separate deliverable with its own build/release pipeline). Instead, device registration targets **FCM via Web Push to a minimal installable PWA receiver** running in Chrome for Android — same FCM payload, same notification UX (title, URL, favicon, Open/Copy actions, tap-to-launch), zero Play Store dependency. The backend and data model are written so swapping in a native Android client later is a drop-in change (it already only deals in raw FCM tokens + payloads).
