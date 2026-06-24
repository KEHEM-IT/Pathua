# Deployment Guide

## 1. Firebase project setup

1. Create a project at console.firebase.google.com (e.g. `pathua-prod`); create a second one
   (`pathua-dev`) for local/staging — never develop against prod data.
2. **Authentication** → Sign-in method → enable **Google**.
3. **Firestore Database** → create in production mode, pick a region close to your users
   (e.g. `asia-south1` for a Bangladesh-heavy user base).
4. **Cloud Messaging** → note the **Server key**/Sender ID is legacy; we use the Admin SDK, which
   only needs the service account, not a separate FCM key.
5. **Project settings → Service accounts → Generate new private key** — downloads a JSON file.
   This is the credential the backend uses; never commit it.
6. **Project settings → General → Your apps → Web app** — register a web app (used by the popup's
   Firebase client SDK for Google Sign-In) and note the `firebaseConfig` object.
7. Deploy Firestore rules and indexes:
   ```
   firebase deploy --only firestore:rules,firestore:indexes --project pathua-prod
   ```

## 2. Backend environment variables (Vercel)

In the Vercel project → Settings → Environment Variables, set (per environment: Preview uses
`pathua-dev`, Production uses `pathua-prod`):

| Key | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | base64 of the downloaded service account JSON: `base64 -w0 serviceAccount.json` |
| `FIREBASE_PROJECT_ID` | e.g. `pathua-prod` |
| `ALLOWED_ORIGIN` | `chrome-extension://<published-extension-id>` |
| `NODE_ENV` | `production` |

`backend/src/firebase/admin.ts` reads `FIREBASE_SERVICE_ACCOUNT_JSON`, base64-decodes it, and
calls `initializeApp({ credential: cert(JSON.parse(decoded)) })` — see that file for the exact
code. Decoding to base64 avoids fighting Vercel's env var UI with multi-line JSON and embedded
quotes/newlines in the private key.

## 3. Deploying the backend

```bash
cd backend
npm install
vercel link        # first time only, links to the Vercel project
vercel --prod       # deploy
```

`vercel.json` routes all `/api/*` requests to the single Express handler in
`backend/api/index.ts` (Vercel's Node serverless function entrypoint). Every push to `main`
auto-deploys to production; every PR gets its own Preview URL automatically — use the Preview URL
+ the `pathua-dev` Firebase project for testing the extension end-to-end before merging.

## 4. Building and loading the Chrome Extension (development)

```bash
cd extension
npm install
npm run build        # esbuild/vite bundles src/*.ts -> dist/
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** → **Load unpacked** →
select `extension/dist`.

Set `EXTENSION_API_BASE_URL` (build-time env, injected by the bundler — see
`extension/vite.config.ts`) to the Vercel Preview/Production URL before building.

## 5. Publishing to the Chrome Web Store

1. `npm run build:prod` in `extension/` (production API URL, minified).
2. Zip the `dist/` folder contents (not the folder itself).
3. Chrome Web Store Developer Dashboard → upload the zip, fill in listing assets (icons,
   screenshots, privacy policy URL — required since we touch user data).
4. Once you have the **published** extension ID, go back and set `ALLOWED_ORIGIN` in Vercel to
   the real `chrome-extension://<id>` (you can only know the final id after first upload, or by
   reserving a key pair ahead of time and setting `"key"` in `manifest.json` to pin the ID before
   publishing — recommended so you don't have a chicken-and-egg CORS gap on first release).

## 6. Post-deploy smoke test

- [ ] Sign in with Google from the popup → `users/{uid}` doc appears in Firestore.
- [ ] Register a device (open the PWA receiver on an Android phone, allow notifications) →
      `users/{uid}/devices/{id}` appears with a fresh `fcmToken`.
- [ ] Click Share To Phone on any tab → notification arrives on the phone within a few seconds,
      tapping it opens the URL.
- [ ] Double-click Share To Phone within 10s → second click is silently treated as a duplicate
      (`data.duplicate: true`), no second notification.
