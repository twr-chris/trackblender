import { useState } from "react";
import { signIn, setMember, setTracks, createLeague } from "../firebase.js";
import DEFAULT_TRACKS from "../tracks.js";
import { C, inp, btnP, mbtn } from "../lib/shared.js";

export function SignInScreen() {
  const [error, setError] = useState(null);
  const doSignIn = async () => {
    try { await signIn(); } catch (e) { setError(e.message); }
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ width: 64, height: 64, background: `linear-gradient(135deg, ${C.accent}, #f59e0b)`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 800, color: "#fff", margin: "0 auto 20px" }}>T</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, marginBottom: 8 }}>TrackBlender</h1>
        <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 30 }}>iRacing league track ownership manager</p>
        <button onClick={doSignIn} style={{ ...btnP, padding: "12px 32px", fontSize: 15, display: "flex", alignItems: "center", gap: 10, margin: "0 auto" }}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>
        {error && <p style={{ color: C.danger, fontSize: 12, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

export function CreateLeagueScreen({ user, onCreated }) {
  const [name, setName] = useState("");
  const [driverName, setDriverName] = useState(user.displayName || "");
  const [creating, setCreating] = useState(false);
  const doCreate = async () => {
    const n = name.trim(); const dn = driverName.trim();
    if (!n || !dn) return;
    setCreating(true);
    try {
      await createLeague(n, user.uid);
      await setMember(user.uid, { displayName: dn, email: user.email || "", ownership: {}, joinedAt: new Date().toISOString() });
      await setTracks(DEFAULT_TRACKS);
      onCreated({ name: n, adminUids: [user.uid] });
    } catch (e) { console.error(e); }
    setCreating(false);
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Create Your League</h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>You're the first one here! Name your league and pick your driver name.</p>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="League name..." style={{ ...inp, width: "100%", marginBottom: 12, textAlign: "center", fontSize: 16, boxSizing: "border-box" }} autoFocus />
        <input value={driverName} onChange={e => setDriverName(e.target.value)} onKeyDown={e => e.key === "Enter" && doCreate()}
          placeholder="Your driver name..." style={{ ...inp, width: "100%", marginBottom: 12, textAlign: "center", fontSize: 16, boxSizing: "border-box" }} />
        <button onClick={doCreate} disabled={creating} style={{ ...btnP, padding: "12px 32px", fontSize: 15, opacity: creating ? 0.5 : 1 }}>
          {creating ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}

export function ClaimScreen({ user, members, config }) {
  const [driverName, setDriverName] = useState(user.displayName || "");
  const [claiming, setClaiming] = useState(false);
  const doClaim = async () => {
    const n = driverName.trim(); if (!n) return;
    setClaiming(true);
    try {
      await setMember(user.uid, { displayName: n, email: user.email || "", ownership: {}, joinedAt: new Date().toISOString() });
    } catch (e) { console.error(e); }
    setClaiming(false);
  };
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>Welcome to {config?.name || "TrackBlender"}</h2>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>Pick your driver name. This is what other league members will see.</p>
        <input value={driverName} onChange={e => setDriverName(e.target.value)} onKeyDown={e => e.key === "Enter" && doClaim()}
          placeholder="Driver name..." style={{ ...inp, width: "100%", marginBottom: 12, textAlign: "center", fontSize: 16, boxSizing: "border-box" }} autoFocus />
        {Object.keys(members).length > 0 && (
          <p style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
            Current members: {Object.values(members).map(m => m.displayName).join(", ")}
          </p>
        )}
        <button onClick={doClaim} disabled={claiming} style={{ ...btnP, padding: "12px 32px", fontSize: 15, opacity: claiming ? 0.5 : 1 }}>
          {claiming ? "Joining..." : "Join League"}
        </button>
      </div>
    </div>
  );
}

export function FullScreen({ children }) {
  return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontFamily: "monospace" }}><div>{children}</div></div>;
}

export function UserName({ user, myMember, renameMember }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  const startEdit = () => { setName(myMember?.displayName || ""); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = () => {
    const n = name.trim();
    if (!n || n === myMember?.displayName) { setEditing(false); return; }
    renameMember(user.uid, n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          style={{ ...inp, padding: "4px 8px", fontSize: 12, width: 120 }} autoFocus />
        <button onClick={save} style={{ ...mbtn, color: C.owned, fontWeight: 700, fontSize: 11 }}>✓</button>
        <button onClick={cancel} style={{ ...mbtn, fontSize: 11 }}>✗</button>
      </div>
    );
  }

  return (
    <button onClick={startEdit} title="Click to change driver name"
      style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: "2px 4px", borderRadius: 3, borderBottom: `1px dashed ${C.textDim}` }}>
      {myMember?.displayName}
    </button>
  );
}
