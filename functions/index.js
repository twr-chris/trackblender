// Firebase Cloud Function — proxies iRacing Data API requests for authenticated admins.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getIracingToken } from "./lib/iracing-auth.js";
import { iracingGet } from "./lib/iracing-api.js";

initializeApp();

const iracingClientId = defineSecret("IRACING_CLIENT_ID");
const iracingClientSecret = defineSecret("IRACING_CLIENT_SECRET");
const iracingUsername = defineSecret("IRACING_USERNAME");
const iracingPassword = defineSecret("IRACING_PASSWORD");

/** Verify the caller is an authenticated admin. */
async function assertAdmin(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Not signed in");
  const db = getFirestore();
  const snap = await db.doc("leagues/default/data/config").get();
  const adminUids = snap.data()?.adminUids || [];
  if (!adminUids.includes(auth.uid)) {
    throw new HttpsError("permission-denied", "Not an admin");
  }
}

/** Read the iRacing league ID from config. */
async function getLeagueId() {
  const db = getFirestore();
  const snap = await db.doc("leagues/default/data/config").get();
  const id = snap.data()?.iracingLeagueId;
  if (!id) throw new HttpsError("failed-precondition", "iRacing League ID not configured. Set it in League Admin.");
  return Number(id);
}

export const iracingProxy = onCall(
  {
    secrets: [iracingClientId, iracingClientSecret, iracingUsername, iracingPassword],
    region: "us-central1",
    maxInstances: 3,
    timeoutSeconds: 30,
  },
  async (request) => {
    await assertAdmin(request.auth);

    const token = await getIracingToken({
      clientId: iracingClientId.value(),
      clientSecret: iracingClientSecret.value(),
      username: iracingUsername.value(),
      password: iracingPassword.value(),
    });

    const { action } = request.data;
    const leagueId = await getLeagueId();

    switch (action) {
      case "leagueSeasons":
        return iracingGet(token, "/data/league/seasons", {
          league_id: leagueId,
          retired: true,
        });

      case "seasonSessions":
        if (!request.data.seasonId) throw new HttpsError("invalid-argument", "seasonId required");
        return iracingGet(token, "/data/league/season_sessions", {
          league_id: leagueId,
          season_id: request.data.seasonId,
          results_only: false,
        });

      case "raceResult":
        if (!request.data.subsessionId) throw new HttpsError("invalid-argument", "subsessionId required");
        return iracingGet(token, "/data/results/get", {
          subsession_id: request.data.subsessionId,
        });

      default:
        throw new HttpsError("invalid-argument", `Unknown action: ${action}`);
    }
  }
);
