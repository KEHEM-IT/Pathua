// history.service.ts — paginated share history queries.
//
// Path: users/{uid}/share_history/{shareId}
// Uses Firestore cursor-based pagination (startAfter document snapshot)
// so limit/offset doesn't degrade with large collections.

import { getFirestore } from "../firebase/admin";
import { FirestoreShareEvent, HistoryItem } from "../types";
import { toIso } from "../utils/helpers";

const PAGE_SIZE = 20;

function historyCol(uid: string) {
  return getFirestore().collection("users").doc(uid).collection("share_history");
}

export async function getHistory(
  uid: string,
  opts: {
    q?: string;
    domain?: string;
    sharedOnly?: boolean;
    limit?: number;
    cursor?: string;
  }
): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const limit = Math.min(opts.limit ?? PAGE_SIZE, 50);
  let query = historyCol(uid)
    .orderBy("createdAt", "desc")
    .limit(limit + 1); // fetch one extra to detect next page

  if (opts.domain) {
    query = query.where("domain", "==", opts.domain) as typeof query;
  }
  if (opts.sharedOnly) {
    // "sharedOnly" = at least one device was targeted
    query = query.where("deviceIds", "!=", []) as typeof query;
  }

  if (opts.cursor) {
    const cursorDoc = await historyCol(uid).doc(opts.cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc) as typeof query;
    }
  }

  const snap = await query.get();
  const docs = snap.docs.map((d) => d.data() as FirestoreShareEvent);

  // Client-side title/URL substring filter (Firestore doesn't support LIKE)
  const filtered = opts.q
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(opts.q!.toLowerCase()) ||
          d.url.toLowerCase().includes(opts.q!.toLowerCase())
      )
    : docs;

  const hasMore = filtered.length > limit;
  const items = filtered.slice(0, limit).map(toHistoryItem);
  const nextCursor = hasMore ? items[items.length - 1]?.shareId ?? null : null;

  return { items, nextCursor };
}

export async function deleteHistoryItem(uid: string, shareId: string): Promise<boolean> {
  await historyCol(uid).doc(shareId).delete();
  return true;
}

export async function getHistoryItem(
  uid: string,
  shareId: string
): Promise<FirestoreShareEvent | null> {
  const doc = await historyCol(uid).doc(shareId).get();
  return doc.exists ? (doc.data() as FirestoreShareEvent) : null;
}

function toHistoryItem(e: FirestoreShareEvent): HistoryItem {
  return {
    shareId: e.shareId,
    title: e.title,
    url: e.url,
    domain: e.domain,
    favicon: e.favicon,
    sharedTo: e.deviceIds,
    createdAt: toIso(e.createdAt),
  };
}
