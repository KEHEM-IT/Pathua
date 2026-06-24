// analytics.service.ts — increments per-user daily counters in Firestore.
//
// Schema path: users/{uid}/analytics/{YYYY-MM-DD}
// Uses Firestore FieldValue.increment() so concurrent serverless invocations
// are safe (no read-modify-write race condition).

import { getFirestore, increment, serverTimestamp } from "../firebase/admin";
import { AnalyticsSummary, FirestoreAnalytics } from "../types";
import { todayUtc, toIso } from "../utils/helpers";

function analyticsCol(uid: string) {
  return getFirestore().collection("users").doc(uid).collection("analytics");
}

async function incrementQr(uid: string): Promise<void> {
  const date = todayUtc();
  const ref = analyticsCol(uid).doc(date);
  await ref.set(
    { uid, date, qrGenerated: increment(1), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

async function incrementShares(uid: string, domain: string): Promise<void> {
  const date = todayUtc();
  const ref = analyticsCol(uid).doc(date);
  const domainKey = `domains.${domain.replace(/\./g, "_")}`;
  await ref.set(
    { uid, date, shares: increment(1), [domainKey]: increment(1), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

async function getSummary(uid: string, range: "7d" | "30d" | "90d"): Promise<AnalyticsSummary> {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const snap = await analyticsCol(uid)
    .where("date", ">=", sinceStr)
    .orderBy("date", "asc")
    .get();

  const docs = snap.docs.map((d) => d.data() as FirestoreAnalytics);

  let totalQrGenerated = 0;
  let totalShared = 0;
  const domainTotals: Record<string, number> = {};

  const daily = docs.map((d) => {
    totalQrGenerated += d.qrGenerated ?? 0;
    totalShared += d.shares ?? 0;
    const domains = d.domains ?? {};
    for (const [k, v] of Object.entries(domains)) {
      const dk = k.replace(/_/g, ".");
      domainTotals[dk] = (domainTotals[dk] ?? 0) + v;
    }
    return { date: d.date, qrGenerated: d.qrGenerated ?? 0, shares: d.shares ?? 0 };
  });

  const topDomains = Object.entries(domainTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return { totalQrGenerated, totalShared, topDomains, daily };
}

export const analyticsService = { incrementQr, incrementShares, getSummary };
