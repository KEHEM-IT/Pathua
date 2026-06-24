// Google Sign-In via chrome.identity, exchanged for a Firebase ID token.
//
// Approach: `chrome.identity.getAuthToken` only works for Chrome-signed-in
// users and is Manifest V3's simplest path, but it returns a Google OAuth
// access token, not a Firebase ID token. We exchange that access token for
// Firebase credentials using the Firebase Auth REST
// `signInWithIdp`/`signInWithGoogleAccessToken` flow client-side (no backend
// involvement needed for sign-in itself — the backend only ever verifies the
// resulting Firebase ID token on each API call).

import type { AuthSession } from "../types";
import { storageGet, storageRemove, storageSet } from "./chromeApi";

const SESSION_KEY = "pathua_auth_session";
// Reads from .env.local at build time via Vite's import.meta.env injection.
// Falls back to the placeholder so a build without an env file still compiles.
const FIREBASE_API_KEY =
  (typeof import.meta !== "undefined" && (import.meta as { env?: Record<string, string> }).env?.VITE_FIREBASE_API_KEY) ||
  "REPLACE_WITH_FIREBASE_WEB_API_KEY";

interface FirebaseSignInResponse {
  localId: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string; // seconds, as a string
  email?: string;
  displayName?: string;
  photoUrl?: string;
}

export async function signIn(): Promise<AuthSession> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${accessToken}&providerId=google.com`,
        requestUri: "https://pathua.app",
        returnSecureToken: true,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Firebase sign-in failed: ${res.status}`);
  }
  const data = (await res.json()) as FirebaseSignInResponse;
  const session: AuthSession = {
    uid: data.localId,
    email: data.email ?? null,
    displayName: data.displayName ?? null,
    photoURL: data.photoUrl ?? null,
    idToken: data.idToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
  await storageSet(SESSION_KEY, session);
  return session;
}

export async function signOut(): Promise<void> {
  await new Promise<void>((resolve) => {
    chrome.identity.clearAllCachedAuthTokens(() => resolve());
  });
  await storageRemove(SESSION_KEY);
}

export async function getSession(): Promise<AuthSession | undefined> {
  const session = await storageGet<AuthSession>(SESSION_KEY);
  if (!session) return undefined;
  // Firebase ID tokens are short-lived (~1hr); if expired, the caller should
  // prompt a fresh signIn() rather than silently failing API calls. A future
  // iteration can use the stored refreshToken against the `securetoken`
  // endpoint to refresh silently — left as a roadmap item to keep this file
  // small and auditable for now.
  if (session.expiresAt < Date.now()) return undefined;
  return session;
}

function getGoogleAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? "No auth token returned"));
        return;
      }
      resolve(typeof token === "string" ? token : (token as { token: string }).token);
    });
  });
}
