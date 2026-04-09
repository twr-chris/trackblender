// iRacing OAuth2 Password Limited Flow — token acquisition, refresh, and Firestore caching.

import { createHash } from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const AUTH_BASE = "https://oauth.iracing.com/oauth2";
const TOKEN_DOC = "_system/iracingTokens";

// SHA-256 mask: hash(secret + lowercase(id)), base64-encoded
function mask(secret, id) {
  const hash = createHash("sha256");
  hash.update(`${secret}${id.trim().toLowerCase()}`);
  return hash.digest("base64");
}

// Full password_limited grant
async function authenticate(clientId, clientSecret, username, password) {
  const body = new URLSearchParams({
    grant_type: "password_limited",
    client_id: clientId,
    client_secret: mask(clientSecret, clientId),
    username,
    password: mask(password, username),
    scope: "iracing.auth",
  });

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iRacing auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessExpiresAt: Date.now() + data.expires_in * 1000,
    refreshExpiresAt: Date.now() + (data.refresh_token_expires_in || 604800) * 1000,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// Refresh using single-use refresh token
async function refresh(clientId, clientSecret, refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: mask(clientSecret, clientId),
    refresh_token: refreshToken,
  });

  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`iRacing refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessExpiresAt: Date.now() + data.expires_in * 1000,
    refreshExpiresAt: Date.now() + (data.refresh_token_expires_in || 604800) * 1000,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Get a valid iRacing access token. Reads cached tokens from Firestore,
 * refreshes or re-authenticates as needed. Uses a transaction to prevent
 * concurrent refresh of the single-use refresh token.
 */
export async function getIracingToken({ clientId, clientSecret, username, password }) {
  const db = getFirestore();
  const tokenRef = db.doc(TOKEN_DOC);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    const cached = snap.data();

    // Valid access token — use it
    if (cached?.accessToken && cached.accessExpiresAt > Date.now() + 30_000) {
      return cached.accessToken;
    }

    let tokens;

    // Expired access but valid refresh — refresh
    if (cached?.refreshToken && cached.refreshExpiresAt > Date.now() + 60_000) {
      tokens = await refresh(clientId, clientSecret, cached.refreshToken);
    } else {
      // Nothing valid — full auth
      tokens = await authenticate(clientId, clientSecret, username, password);
    }

    tx.set(tokenRef, tokens);
    return tokens.accessToken;
  });
}
