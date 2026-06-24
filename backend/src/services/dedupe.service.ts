// dedupe.service.ts — server-side duplicate share detection.
//
// A share is considered a duplicate if the same uid has shared the same URL
// within the DEDUPE_WINDOW_MS window. We check Firestore directly so the
// guard works across multiple serverless instances (unlike in-memory state).
//
// The check is a lightweight query (no full collection scan) because shares
// are stored under users/{uid}/share_history/{shareId} with a `url` + `createdAt`
// composite index (defined in firestore.indexes.json — see docs/FIRESTORE_SCHEMA.md).

import { getFirestore } from "../firebase/admin";
import * as admin from "firebase-admin";

const DEDUPE_WINDOW_MS = 10_000; // 10 seconds

export async function isDuplicateShare(uid: string, url: string): Promise<boolean> {
  const db = getFirestore();
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("share_history")
    .where("url", "==", url)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(since))
    .limit(1)
    .get();
  return !snapshot.empty;
}
