// iRacing Data API request helper — handles envelope + S3 link resolution.

import { HttpsError } from "firebase-functions/v2/https";

const DATA_BASE = "https://members-ng.iracing.com";

/**
 * Make an authenticated GET to the iRacing Data API.
 * Most endpoints return { link: "https://s3..." } — this follows the link
 * and returns the actual data.
 */
export async function iracingGet(token, path, params = {}) {
  const url = new URL(path, DATA_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    throw new HttpsError("unauthenticated", "iRacing token expired or invalid");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new HttpsError("internal", `iRacing API ${res.status}: ${text}`);
  }

  const envelope = await res.json();

  // Follow S3 data link if present
  if (envelope.link) {
    const dataRes = await fetch(envelope.link);
    if (!dataRes.ok) {
      throw new HttpsError("internal", `iRacing data link ${dataRes.status}`);
    }
    return dataRes.json();
  }

  return envelope;
}
