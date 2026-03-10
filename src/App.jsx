import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  onAuth, signIn, signOut,
  getConfig, setConfig, subscribeConfig,
  getTracks, setTracks, subscribeTracks,
  getSchedule, setSchedule, subscribeSchedule,
  getMember, setMember, deleteMember, subscribeMembers,
  leagueExists, createLeague,
} from "./firebase.js";
import DEFAULT_TRACKS, { normalizeTracks } from "./tracks.js";

const ALL_CATS = ["road", "oval", "dirt-oval", "dirt-road"];
const CAT_LABELS = { all: "All", road: "Road", oval: "Oval", "dirt-oval": "Dirt Oval", "dirt-road": "Dirt Road" };

const C = {
  bg: "#0c0e13", surface: "#14171e", border: "#252a35",
  text: "#e8eaf0", textMuted: "#7a8299", textDim: "#4a5168",
  accent: "#e85d2c", accentGlow: "rgba(232, 93, 44, 0.15)",
  owned: "#22c55e", ownedBg: "rgba(34, 197, 94, 0.1)",
  buy: "#f59e0b", buyBg: "rgba(245, 158, 11, 0.1)",
  danger: "#ef4444", dangerBg: "rgba(239, 68, 68, 0.1)",
  admin: "#a78bfa", adminBg: "rgba(167, 139, 250, 0.1)",
  free: "#38bdf8", freeBg: "rgba(56, 189, 248, 0.1)",
};
const CAT_COLORS = {
  road: { fg: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  oval: { fg: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  "dirt-oval": { fg: "#a78bfa", bg: "rgba(168,85,247,0.12)" },
  "dirt-road": { fg: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

const matchCat = (t, f) => f === "all" || (t.cats || []).includes(f);

// ─── Shared tiny components ───
function CatTags({ cats, size }) {
  const s = size === "md" ? { fontSize: 10, padding: "2px 8px" } : { fontSize: 9, padding: "1px 5px" };
  return <span style={{ display: "inline-flex", gap: 3 }}>{(cats || []).map(c => <span key={c} style={{ ...s, borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: CAT_COLORS[c]?.bg, color: CAT_COLORS[c]?.fg }}>{c}</span>)}</span>;
}
function CfgBadge({ n }) { return n == null ? null : <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: "rgba(255,255,255,0.05)", color: C.textMuted }}>{n}cfg</span>; }
function FreeBadge({ on }) { return on ? <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.freeBg, color: C.free }}>FREE</span> : null; }
function Badges({ t }) { return <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}><CatTags cats={t?.cats} /><CfgBadge n={t?.configs} /><FreeBadge on={t?.free} /></span>; }
function StatCard({ label, value, color }) { return <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16, textAlign: "center" }}><div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: color || C.text }}>{value}</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div></div>; }
function Empty({ icon, title, sub }) { return <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}><div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: C.text }}>{title}</div><div style={{ fontSize: 12 }}>{sub}</div></div>; }

const pill = (on) => ({ padding: "5px 12px", fontSize: 11, fontWeight: on ? 600 : 400, background: on ? C.accentGlow : C.surface, color: on ? C.accent : C.textMuted, border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 5, cursor: "pointer", fontFamily: "inherit" });
const inp = { padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" };
const btnP = { padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const thS = { padding: "10px 8px", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" };
const tdS = { padding: "7px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const mbtn = { background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 12, padding: "2px 4px", fontFamily: "inherit" };

// ─── App Root ───
export default function App() {
  const [user, setUser] = useState(undefined); // undefined=loading, null=signed out, object=signed in
  const [config, setConfigState] = useState(null);
  const [tracks, setTracksState] = useState(DEFAULT_TRACKS);
  const [schedule, setScheduleState] = useState([]);
  const [members, setMembersState] = useState({}); // {uid: {displayName, ownership, ...}}
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("grid");
  const [saveStatus, setSaveStatus] = useState("");

  // Auth listener
  useEffect(() => onAuth(u => setUser(u || null)), []);

  // Once authed, load data + subscribe
  useEffect(() => {
    if (!user) return;
    let unsubs = [];
    (async () => {
      // Load initial
      const [cfg, trk, sch] = await Promise.all([getConfig(), getTracks(), getSchedule()]);
      if (cfg) setConfigState(cfg);
      if (trk) setTracksState(normalizeTracks(trk));
      if (sch) setScheduleState(sch);
      setLoading(false);

      // Subscribe for real-time
      unsubs.push(subscribeConfig(v => { if (v) setConfigState(v); }));
      unsubs.push(subscribeTracks(v => { if (v) setTracksState(normalizeTracks(v)); }));
      unsubs.push(subscribeSchedule(v => { if (v) setScheduleState(v); }));
      unsubs.push(subscribeMembers(v => setMembersState(v)));
    })();
    return () => unsubs.forEach(fn => fn?.());
  }, [user]);

  // Debounced save helper
  const timers = useRef({});
  const persist = useCallback((key, fn) => {
    setSaveStatus("saving...");
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try { await fn(); setSaveStatus("saved " + new Date().toLocaleTimeString()); }
      catch (e) { console.error(e); setSaveStatus("save failed"); }
    }, 400);
  }, []);

  const isAdmin = config?.adminUids?.includes(user?.uid);
  const myMember = members[user?.uid];

  // ─── Derived data in the old format for component compatibility ───
  const memberList = useMemo(() =>
    Object.entries(members).map(([uid, m]) => ({ uid, name: m.displayName })).sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );
  const memberNames = useMemo(() => memberList.map(m => m.name), [memberList]);
  const uidByName = useMemo(() => Object.fromEntries(memberList.map(m => [m.name, m.uid])), [memberList]);
  const nameByUid = useMemo(() => Object.fromEntries(memberList.map(m => [m.uid, m.name])), [memberList]);

  // Merged ownership: { memberName: { trackName: status } }
  const ownership = useMemo(() => {
    const o = {};
    for (const [uid, m] of Object.entries(members)) {
      o[m.displayName] = m.ownership || {};
    }
    return o;
  }, [members]);

  // Racing status: { memberName: boolean }
  const racingStatus = useMemo(() => {
    const r = {};
    for (const [uid, m] of Object.entries(members)) {
      r[m.displayName] = m.racing !== false; // default true
    }
    return r;
  }, [members]);

  // Members who count toward calculations
  const racingNames = useMemo(() => memberNames.filter(n => racingStatus[n]), [memberNames, racingStatus]);

  const trackNames = useMemo(() => tracks.map(t => t.name).sort(), [tracks]);
  const trackMap = useMemo(() => Object.fromEntries(tracks.map(t => [t.name, t])), [tracks]);

  // Save helpers
  const saveOwnership = useCallback((memberName, newOwnership) => {
    const uid = uidByName[memberName];
    if (!uid) return;
    const updated = { ...members[uid], ownership: newOwnership };
    setMembersState(prev => ({ ...prev, [uid]: updated }));
    persist(`member-${uid}`, () => setMember(uid, { ownership: newOwnership }));
  }, [members, uidByName, persist]);

  const saveScheduleFn = useCallback((rounds) => {
    setScheduleState(rounds);
    persist('schedule', () => setSchedule(rounds));
  }, [persist]);

  const saveTracksFn = useCallback((list) => {
    setTracksState(list);
    persist('tracks', () => setTracks(list));
  }, [persist]);

  // ─── Auth screen ───
  if (user === undefined) return <FullScreen>Loading...</FullScreen>;
  if (user === null) return <SignInScreen />;

  // ─── First-run: create league ───
  if (!loading && !config) return <CreateLeagueScreen user={user} onCreated={(cfg) => setConfigState(cfg)} />;

  // ─── Claim screen: user is authed but has no member doc ───
  if (!loading && !myMember) return <ClaimScreen user={user} members={members} config={config} />;

  if (loading) return <FullScreen>Loading league data...</FullScreen>;

  // ─── Data helpers for child components ───
  const data = { members: memberNames, racingMembers: racingNames, racing: racingStatus, ownership, schedule };

  const save = (newData) => {
    // Handle schedule changes
    if (newData.schedule !== data.schedule) {
      saveScheduleFn(newData.schedule);
    }
    // Handle ownership changes
    for (const name of newData.members) {
      if (newData.ownership[name] !== data.ownership[name]) {
        saveOwnership(name, newData.ownership[name]);
      }
    }
  };

  const mainTabs = [
    { id: "grid", label: "Ownership Grid", icon: "▦" },
    { id: "schedule", label: "Schedule Builder", icon: "📅" },
    { id: "buy", label: "Buy Recs", icon: "🛒" },
    { id: "stats", label: "Overview", icon: "📊" },
  ];
  const admTabs = isAdmin ? [{ id: "trackeditor", label: "Track Editor", icon: "🔧" }, { id: "leagueadmin", label: "League", icon: "⚙️" }] : [];
  const allTabs = [...mainTabs, ...admTabs];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${C.accent}, #f59e0b)`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>T</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{config?.name || "TrackBlender"}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{racingNames.length}/{memberNames.length} racing · {trackNames.length} tracks</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{saveStatus}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>{myMember?.displayName}</span>
            {isAdmin && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>}
            <button onClick={signOut} style={{ ...mbtn, color: C.textMuted, fontSize: 11 }}>Sign Out</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, padding: "12px 24px 0", borderBottom: `1px solid ${C.border}`, background: C.surface, flexWrap: "wrap" }}>
        {allTabs.map(t => {
          const isA = admTabs.some(a => a.id === t.id); const on = tab === t.id;
          return <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "10px 16px", fontSize: 13, fontWeight: on ? 600 : 400, color: on ? (isA ? C.admin : C.accent) : C.textMuted, background: on ? (isA ? C.adminBg : C.accentGlow) : "transparent", border: "none", borderBottom: on ? `2px solid ${isA ? C.admin : C.accent}` : "2px solid transparent", cursor: "pointer", borderRadius: "8px 8px 0 0", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}><span>{t.icon}</span> {t.label}</button>;
        })}
      </div>

      <div style={{ padding: "20px 24px" }}>
        {tab === "grid" && <Grid data={data} save={save} names={trackNames} map={trackMap} currentUser={myMember?.displayName} isAdmin={isAdmin} />}
        {tab === "schedule" && <Schedule data={data} save={save} names={trackNames} map={trackMap} isAdmin={isAdmin} />}
        {tab === "buy" && <BuyRecs data={data} save={save} names={trackNames} map={trackMap} />}
        {tab === "stats" && <Stats data={data} names={trackNames} map={trackMap} />}
        {tab === "trackeditor" && isAdmin && <Editor tracks={tracks} save={saveTracksFn} />}
        {tab === "leagueadmin" && isAdmin && <LeagueAdmin config={config} members={members} nameByUid={nameByUid} />}
      </div>
    </div>
  );
}

// ─── Sign In Screen ───
function SignInScreen() {
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

// ─── Create League Screen (first-run) ───
function CreateLeagueScreen({ user, onCreated }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const doCreate = async () => {
    const n = name.trim(); if (!n) return;
    setCreating(true);
    try {
      await createLeague(n, user.uid);
      // Also create this user as the first member
      await setMember(user.uid, { displayName: user.displayName || user.email, ownership: {}, joinedAt: new Date().toISOString() });
      // Seed default tracks
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
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 24 }}>You're the first one here! Name your league to get started. You'll be the admin.</p>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && doCreate()}
          placeholder="League name..." style={{ ...inp, width: "100%", marginBottom: 12, textAlign: "center", fontSize: 16, boxSizing: "border-box" }} autoFocus />
        <button onClick={doCreate} disabled={creating} style={{ ...btnP, padding: "12px 32px", fontSize: 15, opacity: creating ? 0.5 : 1 }}>
          {creating ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}

// ─── Claim Screen (authed user, no member doc) ───
function ClaimScreen({ user, members, config }) {
  const [driverName, setDriverName] = useState(user.displayName || "");
  const [claiming, setClaiming] = useState(false);
  const doClaim = async () => {
    const n = driverName.trim(); if (!n) return;
    setClaiming(true);
    try {
      await setMember(user.uid, { displayName: n, ownership: {}, joinedAt: new Date().toISOString() });
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

function FullScreen({ children }) {
  return <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, fontFamily: "monospace" }}><div>{children}</div></div>;
}

// ─── Ownership Grid ───
function Grid({ data, save, names, map, currentUser, isAdmin }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [hideFree, setHideFree] = useState(false);

  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);
  const filtered = useMemo(() => {
    let t = names;
    if (filter !== "all") t = t.filter(n => map[n] && matchCat(map[n], filter));
    if (search) { const q = search.toLowerCase(); t = t.filter(n => n.toLowerCase().includes(q)); }
    if (hideEmpty && data.members.length > 0) t = t.filter(n => data.members.some(m => getS(m, n) !== "unowned") || map[n]?.free);
    if (hideFree) t = t.filter(n => !map[n]?.free);
    return t;
  }, [filter, search, hideEmpty, hideFree, data.members, getS, names, map]);

  const toggle = (m, t) => {
    // Members can only edit their own row, admins can edit anyone
    if (m !== currentUser && !isAdmin) return;
    const cur = getS(m, t);
    const next = cur === "unowned" ? "owned" : cur === "owned" ? "buy" : "unowned";
    save({ ...data, ownership: { ...data.ownership, [m]: { ...(data.ownership[m] || {}), [t]: next } } });
  };
  const ownCount = useCallback((t) => data.racingMembers.filter(m => getS(m, t) === "owned").length, [data.racingMembers, getS]);

  const hasBuys = useMemo(() => data.members.some(m => Object.values(data.ownership[m] || {}).some(v => v === "buy")), [data]);
  const clearBuys = () => {
    const newOwnership = {};
    for (const m of data.members) {
      const mo = data.ownership[m] || {};
      const cleaned = {};
      for (const [t, v] of Object.entries(mo)) { cleaned[t] = v === "buy" ? "unowned" : v; }
      newOwnership[m] = cleaned;
    }
    save({ ...data, ownership: newOwnership });
  };

  return (
    <div>
      <div style={{ marginBottom: 14, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tracks..." style={{ ...inp, width: 200 }} />
        {Object.entries(CAT_LABELS).map(([k, v]) => <button key={k} onClick={() => setFilter(k)} style={pill(filter === k)}>{v}</button>)}
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textMuted, cursor: "pointer" }}><input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} /> Hide empty</label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.free, cursor: "pointer" }}><input type="checkbox" checked={hideFree} onChange={e => setHideFree(e.target.checked)} /> Hide free</label>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace" }}>{isAdmin ? "admin: edit any row" : "click your column to edit"}</span>
        {hasBuys && isAdmin && <button onClick={clearBuys} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: C.buyBg, color: C.buy, border: `1px solid ${C.buy}`, borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>Clear All Buys</button>}
      </div>
      {data.members.length === 0 ? <Empty icon="🏁" title="No members yet" sub="Invite people to join your league" /> : (
        <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${C.border}` }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead><tr style={{ background: C.surface }}>
              <th style={{ ...thS, minWidth: 280, textAlign: "left", position: "sticky", left: 0, background: C.surface, zIndex: 10 }}>Track</th>
              <th style={{ ...thS, width: 30, color: C.textDim, fontSize: 10 }}>#</th>
              {data.members.map(m => {
                const isRacing = data.racing[m] !== false;
                return <th key={m} style={{ ...thS, minWidth: 70, color: m === currentUser ? C.accent : isRacing ? C.textMuted : C.textDim, opacity: isRacing ? 1 : 0.5 }}>
                <span style={{ fontSize: 11, fontWeight: 600, maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{m}</span>
                {m === currentUser && <span style={{ fontSize: 8, color: C.accent }}>you</span>}
                {!isRacing && <span style={{ fontSize: 8, color: C.textDim }}>not racing</span>}
              </th>;
              })}
            </tr></thead>
            <tbody>
              {filtered.map((track, i) => {
                const tr = map[track]; const isFree = tr?.free;
                const count = ownCount(track); const allOwn = !isFree && count === data.racingMembers.length && data.racingMembers.length > 0;
                const bg = allOwn ? "rgba(34,197,94,0.04)" : isFree ? "rgba(56,189,248,0.02)" : (i % 2 === 0 ? "transparent" : C.surface);
                const stickyBg = allOwn ? "rgba(34,197,94,0.06)" : isFree ? "rgba(56,189,248,0.03)" : (i % 2 === 0 ? C.bg : C.surface);
                return (
                  <tr key={track} style={{ background: bg }}>
                    <td style={{ ...tdS, fontWeight: 500, position: "sticky", left: 0, background: stickyBg, zIndex: 5, borderRight: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Badges t={tr} /><span>{track}</span></div>
                    </td>
                    <td style={{ ...tdS, textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: isFree ? C.free : count === 0 ? C.textDim : allOwn ? C.owned : C.text, fontSize: 11 }}>{isFree ? "—" : count}</td>
                    {data.members.map(m => {
                      const isRacing = data.racing[m] !== false;
                      if (isFree) return <td key={m} style={{ ...tdS, textAlign: "center", opacity: isRacing ? 1 : 0.4 }}><span style={{ color: C.free, fontSize: 10 }}>✓</span></td>;
                      const s = getS(m, track);
                      const canEdit = m === currentUser || isAdmin;
                      return <td key={m} onClick={() => canEdit && toggle(m, track)} style={{ ...tdS, textAlign: "center", cursor: canEdit ? "pointer" : "default", userSelect: "none", background: s === "owned" ? C.ownedBg : s === "buy" ? C.buyBg : "transparent", opacity: isRacing ? (canEdit ? 1 : 0.8) : 0.4 }}>
                        {s === "owned" ? <span style={{ color: C.owned, fontWeight: 700, fontSize: 14 }}>✓</span> : s === "buy" ? <span style={{ color: C.buy, fontWeight: 700, fontSize: 11 }}>BUY</span> : <span style={{ color: C.textDim }}>·</span>}
                      </td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: C.textDim }}>{filtered.length} of {names.length} tracks</div>
    </div>
  );
}

// ─── Schedule Builder ───
function Schedule({ data, save, names, map, isAdmin }) {
  const [minOwn, setMinOwn] = useState(Math.max(1, data.racingMembers.length));
  const [catF, setCatF] = useState("all");
  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);
  const effOwn = useCallback((t) => map[t]?.free ? data.racingMembers.length : data.racingMembers.filter(m => getS(m, t) === "owned").length, [map, data.racingMembers, getS]);
  const buyN = useCallback((t) => map[t]?.free ? 0 : data.racingMembers.filter(m => getS(m, t) === "buy").length, [map, data.racingMembers, getS]);

  const eligible = useMemo(() => {
    return names.filter(t => map[t] && matchCat(map[t], catF))
      .map(t => ({ name: t, owners: effOwn(t), buyers: buyN(t), track: map[t] }))
      .filter(t => t.owners >= minOwn)
      .sort((a, b) => b.owners - a.owners || (b.owners + b.buyers) - (a.owners + a.buyers));
  }, [data, minOwn, catF, names, map, effOwn, buyN]);

  const sched = data.schedule || [];
  const add = (t) => { if (!isAdmin) return; if (!sched.includes(t)) save({ ...data, schedule: [...sched, t] }); };
  const rem = (i) => { if (!isAdmin) return; const s = [...sched]; s.splice(i, 1); save({ ...data, schedule: s }); };
  const move = (i, d) => { if (!isAdmin) return; const s = [...sched]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; save({ ...data, schedule: s }); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Season ({sched.length} rounds)</h3>
        {!isAdmin && sched.length > 0 && <p style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>Only admins can edit the schedule</p>}
        {sched.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: C.textMuted, background: C.surface, borderRadius: 8, border: `1px dashed ${C.border}` }}>{isAdmin ? "Add tracks →" : "No schedule yet"}</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {sched.map((track, i) => {
              const ow = effOwn(track); const tr = map[track];
              return <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: C.textDim, width: 24 }}>R{i + 1}</span>
                <Badges t={tr} />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{track}</span>
                <span style={{ fontSize: 10, fontFamily: "monospace", color: ow === data.racingMembers.length ? C.owned : C.buy }}>{ow}/{data.racingMembers.length}</span>
                {isAdmin && <><button onClick={() => move(i, -1)} style={mbtn}>↑</button><button onClick={() => move(i, 1)} style={mbtn}>↓</button><button onClick={() => rem(i)} style={{ ...mbtn, color: C.danger }}>×</button></>}
              </div>;
            })}
          </div>
        )}
        {sched.length > 0 && data.members.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: C.textMuted }}>Who needs what</h4>
            {data.members.map(m => {
              const miss = sched.filter(t => !map[t]?.free && getS(m, t) === "unowned");
              const buying = sched.filter(t => getS(m, t) === "buy");
              if (!miss.length && !buying.length) return <div key={m} style={{ padding: "6px 0", fontSize: 12, color: C.owned }}>✓ {m} — all set</div>;
              return <div key={m} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{m}</div>
                {buying.length > 0 && <div style={{ fontSize: 11, color: C.buy, marginLeft: 12 }}>Buying: {buying.join(", ")}</div>}
                {miss.length > 0 && <div style={{ fontSize: 11, color: C.danger, marginLeft: 12 }}>Missing: {miss.join(", ")}</div>}
              </div>;
            })}
          </div>
        )}
      </div>
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginRight: 8 }}>Available</h3>
          <label style={{ fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
            Min: <input type="range" min={0} max={data.racingMembers.length} value={minOwn} onChange={e => setMinOwn(+e.target.value)} style={{ width: 80 }} />
            <span style={{ fontFamily: "monospace", color: C.accent, fontWeight: 700 }}>{minOwn}</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {Object.entries(CAT_LABELS).map(([k, v]) => <button key={k} onClick={() => setCatF(k)} style={{ ...pill(catF === k), fontSize: 10, padding: "4px 10px" }}>{v}</button>)}
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          {eligible.map(t => {
            const inS = sched.includes(t.name);
            return <div key={t.name} onClick={() => isAdmin && !inS && add(t.name)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: inS ? "rgba(34,197,94,0.06)" : C.surface, borderRadius: 5, border: `1px solid ${inS ? "rgba(34,197,94,0.2)" : C.border}`, cursor: isAdmin && !inS ? "pointer" : "default", opacity: inS ? 0.5 : 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace", fontSize: 11, fontWeight: 800, background: t.owners === data.racingMembers.length ? C.ownedBg : C.surface, color: t.owners === data.racingMembers.length ? C.owned : C.text, border: `1px solid ${t.owners === data.racingMembers.length ? "rgba(34,197,94,0.3)" : C.border}` }}>{t.owners}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500 }}>{t.name} <CfgBadge n={t.track?.configs} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><CatTags cats={t.track?.cats} /><FreeBadge on={t.track?.free} />{t.buyers > 0 && <span style={{ fontSize: 10, color: C.textDim }}>{t.buyers} buying</span>}</div>
              </div>
              {inS && <span style={{ fontSize: 10, color: C.owned }}>added</span>}
            </div>;
          })}
          {eligible.length === 0 && <div style={{ padding: 30, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Lower min owners</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Purchase Optimizer Solver ───
function solvePurchases(members, ownership, paidTracks, maxBuys) {
  const missing = {};
  for (const t of paidTracks) {
    const m = members.filter(m => (ownership[m] || {})[t] !== "owned");
    if (m.length > 0 && m.length <= members.length) missing[t] = m;
  }
  const budget = {}; members.forEach(m => { budget[m] = maxBuys; });
  const assignments = [];
  let improved = true;
  while (improved) {
    improved = false;
    const candidates = Object.entries(missing)
      .map(([track, mm]) => ({ track, missing: mm }))
      .filter(c => c.missing.every(m => budget[m] > 0))
      .sort((a, b) => a.missing.length - b.missing.length);
    if (candidates.length > 0) {
      const best = candidates[0];
      for (const m of best.missing) { assignments.push({ member: m, track: best.track }); budget[m]--; }
      delete missing[best.track];
      improved = true;
    }
  }
  return { assignments, promotedTracks: [...new Set(assignments.map(a => a.track))], budget };
}

// ─── Buy Recs ───
function BuyRecs({ data, save, names, map }) {
  const [maxBuys, setMaxBuys] = useState(2);
  const [solverResult, setSolverResult] = useState(null);
  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);
  const paidNames = useMemo(() => names.filter(t => !map[t]?.free), [names, map]);

  const recs = useMemo(() => {
    if (data.racingMembers.length < 2) return [];
    return data.racingMembers.map(mem => {
      const scored = paidNames.filter(t => getS(mem, t) !== "owned").map(t => {
        const oth = data.racingMembers.filter(m => m !== mem && getS(m, t) === "owned").length;
        return { track: t, oth, total: oth + 1, cov: (oth + 1) / data.racingMembers.length, cfg: map[t]?.configs };
      }).filter(t => t.oth >= Math.ceil(data.racingMembers.length * 0.5)).sort((a, b) => b.oth - a.oth);
      return { member: mem, recs: scored.slice(0, 10) };
    });
  }, [data, paidNames, getS, map]);

  const hasBuys = useMemo(() => data.members.some(m => Object.values(data.ownership[m] || {}).some(v => v === "buy")), [data]);

  const runSolver = () => {
    const result = solvePurchases(data.racingMembers, data.ownership, paidNames, maxBuys);
    setSolverResult(result);
    const newOwnership = { ...data.ownership };
    // Clear existing buys for all members (racing or not)
    for (const m of data.members) { const mo = { ...(newOwnership[m] || {}) }; for (const [t, v] of Object.entries(mo)) { if (v === "buy") mo[t] = "unowned"; } newOwnership[m] = mo; }
    for (const { member, track } of result.assignments) { newOwnership[member] = { ...(newOwnership[member] || {}), [track]: "buy" }; }
    save({ ...data, ownership: newOwnership });
  };

  const clearBuys = () => {
    const newOwnership = {};
    for (const m of data.members) { const mo = data.ownership[m] || {}; const cleaned = {}; for (const [t, v] of Object.entries(mo)) { cleaned[t] = v === "buy" ? "unowned" : v; } newOwnership[m] = cleaned; }
    save({ ...data, ownership: newOwnership });
    setSolverResult(null);
  };

  if (data.racingMembers.length < 2) return <Empty icon="🛒" title="Need 2+ racing members" sub="Add members in the Grid" />;

  const solverByMember = solverResult ? data.racingMembers.map(m => ({ member: m, buys: solverResult.assignments.filter(a => a.member === m).map(a => a.track), remaining: solverResult.budget[m] })) : null;

  return (
    <div>
      {/* Optimizer */}
      <div style={{ marginBottom: 30, padding: 20, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>Optimize Purchases</h3>
            <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Maximize tracks promotable to universal within a per-member buy limit</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {hasBuys && <button onClick={clearBuys} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: C.buyBg, color: C.buy, border: `1px solid ${C.buy}`, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>Clear All Buys</button>}
            <button onClick={runSolver} style={{ ...btnP, padding: "7px 18px" }}>Run Optimizer</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: solverResult ? 20 : 0 }}>
          <label style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
            Max buys per member:
            <input type="range" min={1} max={10} value={maxBuys} onChange={e => setMaxBuys(+e.target.value)} style={{ width: 120 }} />
            <span style={{ fontFamily: "monospace", color: C.accent, fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: "center" }}>{maxBuys}</span>
          </label>
        </div>
        {solverResult && (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ padding: "10px 16px", background: C.ownedBg, borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.owned }}>{solverResult.promotedTracks.length}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>tracks → universal</div>
              </div>
              <div style={{ padding: "10px 16px", background: C.buyBg, borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.buy }}>{solverResult.assignments.length}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>total purchases</div>
              </div>
            </div>
            {solverResult.promotedTracks.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Newly Universal</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {solverResult.promotedTracks.map(t => <span key={t} style={{ padding: "5px 10px", background: C.ownedBg, border: "1px solid rgba(34,197,94,0.2)", borderRadius: 5, fontSize: 11, color: C.owned, fontWeight: 500 }}>{t}</span>)}
                </div>
              </div>
            )}
            <h4 style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>Assignments</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {solverByMember.map(r => (
                <div key={r.member} style={{ padding: 12, background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{r.member}</span>
                    <span style={{ fontSize: 10, fontFamily: "monospace", color: r.buys.length === 0 ? C.textDim : C.buy }}>{r.buys.length}/{maxBuys}</span>
                  </div>
                  {r.buys.length === 0 ? <div style={{ fontSize: 11, color: C.textDim }}>No purchases</div>
                    : r.buys.map(t => <div key={t} style={{ fontSize: 11, color: C.buy, padding: "2px 0" }}>🟡 {t}</div>)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* General recs */}
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Best Value Purchases</h3>
      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>Paid tracks where buying gets closest to full coverage</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {recs.map(r => <div key={r.member} style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{r.member}</div>
          {r.recs.length === 0 ? <div style={{ fontSize: 11, color: C.textMuted }}>No high-value recs</div>
            : r.recs.map((t, i) => <div key={t.track} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: i < r.recs.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ width: 22, height: 22, borderRadius: 4, background: t.cov >= 0.9 ? C.ownedBg : C.surface, border: `1px solid ${t.cov >= 0.9 ? "rgba(34,197,94,0.3)" : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, fontFamily: "monospace", color: t.cov >= 0.9 ? C.owned : C.text }}>{t.total}</div>
              <span style={{ flex: 1, fontSize: 11 }}>{t.track} {t.cfg != null && <span style={{ color: C.textDim, fontSize: 9 }}>({t.cfg}cfg)</span>}</span>
              <span style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace" }}>{t.oth}/{data.racingMembers.length - 1}</span>
            </div>)}
        </div>)}
      </div>
    </div>
  );
}

// ─── Stats ───
function Stats({ data, names, map }) {
  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);
  const paidNames = useMemo(() => names.filter(t => !map[t]?.free), [names, map]);
  const freeCount = useMemo(() => names.filter(t => map[t]?.free).length, [names, map]);
  const effOwn = useCallback((t) => map[t]?.free ? data.racingMembers.length : data.racingMembers.filter(m => getS(m, t) === "owned").length, [map, data.racingMembers, getS]);

  const stats = useMemo(() => {
    if (!data.racingMembers.length) return null;
    const ms = data.racingMembers.map(m => {
      const owned = paidNames.filter(t => getS(m, t) === "owned").length;
      const buying = paidNames.filter(t => getS(m, t) === "buy").length;
      return { name: m, owned, buying, total: owned + freeCount };
    }).sort((a, b) => b.owned - a.owned);
    return { ms, uni: paidNames.filter(t => effOwn(t) === data.racingMembers.length), almost: paidNames.filter(t => effOwn(t) === data.racingMembers.length - 1) };
  }, [data, paidNames, freeCount, effOwn, getS]);

  if (!stats) return <Empty icon="📊" title="No data" sub="Add members first" />;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Racing" value={data.racingMembers.length} />
        <StatCard label="Free Tracks" value={freeCount} color={C.free} />
        <StatCard label="Paid Tracks" value={paidNames.length} />
        <StatCard label="Universal" value={stats.uni.length} color={C.owned} />
        <StatCard label="One Away" value={stats.almost.length} color={C.buy} />
        <StatCard label="Rounds" value={(data.schedule || []).length} color={C.accent} />
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Member Libraries</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
        {stats.ms.map(m => <div key={m.name} style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{m.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: C.owned }}>{m.total}</span>
            <span style={{ fontSize: 11, color: C.textMuted }}>tracks</span>
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{m.owned} paid + {freeCount} free{m.buying > 0 ? ` + ${m.buying} buying` : ""}</div>
          <div style={{ marginTop: 8, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", width: `${(m.total / names.length) * 100}%`, background: C.owned, borderRadius: 2 }} /></div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 3, fontFamily: "monospace" }}>{Math.round((m.total / names.length) * 100)}%</div>
        </div>)}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Universal <span style={{ fontWeight: 400, color: C.textMuted, fontSize: 12 }}>— all own (paid only)</span></h3>
      {stats.uni.length === 0 ? <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 20 }}>None</div> : <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>{stats.uni.map(t => <span key={t} style={{ padding: "5px 10px", background: C.ownedBg, border: "1px solid rgba(34,197,94,0.2)", borderRadius: 5, fontSize: 11, color: C.owned, fontWeight: 500 }}>{t}</span>)}</div>}
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>One Away <span style={{ fontWeight: 400, color: C.textMuted, fontSize: 12 }}>— one purchase to full</span></h3>
      {stats.almost.length === 0 ? <div style={{ color: C.textMuted, fontSize: 12 }}>None</div> : <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{stats.almost.map(t => {
        const miss = data.members.find(m => getS(m, t) !== "owned");
        return <span key={t} style={{ padding: "5px 10px", background: C.buyBg, border: "1px solid rgba(245,158,11,0.2)", borderRadius: 5, fontSize: 11, color: C.buy }}>{t} <span style={{ color: C.textMuted }}>({miss})</span></span>;
      })}</div>}
    </div>
  );
}

// ─── Track Editor (Admin) ───
function Editor({ tracks, save }) {
  const [newName, setNewName] = useState("");
  const [newCats, setNewCats] = useState(["road"]);
  const [newCfg, setNewCfg] = useState("");
  const [newFree, setNewFree] = useState(false);
  const [search, setSearch] = useState("");
  const [eidx, setEidx] = useState(null);
  const [eName, setEName] = useState("");
  const [eCats, setECats] = useState([]);
  const [eCfg, setECfg] = useState("");
  const [eFree, setEFree] = useState(false);

  const sorted = useMemo(() => {
    let l = tracks.map((t, i) => ({ ...t, idx: i }));
    if (search) { const q = search.toLowerCase(); l = l.filter(t => t.name.toLowerCase().includes(q)); }
    return l.sort((a, b) => a.name.localeCompare(b.name));
  }, [tracks, search]);

  const togCat = (arr, set, c) => { if (arr.includes(c)) { if (arr.length > 1) set(arr.filter(x => x !== c)); } else set([...arr, c]); };
  const parseCfg = (s) => s.trim() === "" ? null : parseInt(s) || null;

  const addTrack = () => {
    const n = newName.trim(); if (!n || tracks.some(t => t.name === n)) return;
    save([...tracks, { name: n, cats: [...newCats], configs: parseCfg(newCfg), free: newFree }]);
    setNewName(""); setNewCfg(""); setNewFree(false);
  };
  const remTrack = (i) => { if (!confirm(`Remove "${tracks[i].name}"?`)) return; const t = [...tracks]; t.splice(i, 1); save(t); };
  const startE = (t) => { setEidx(t.idx); setEName(t.name); setECats([...(t.cats || [])]); setECfg(t.configs != null ? String(t.configs) : ""); setEFree(!!t.free); };
  const saveE = () => { if (eidx === null) return; const n = eName.trim(); if (!n) return; const t = [...tracks]; t[eidx] = { name: n, cats: [...eCats], configs: parseCfg(eCfg), free: eFree }; save(t); setEidx(null); };
  const cancelE = () => setEidx(null);
  const reset = () => { if (confirm("Reset to defaults?")) save([...DEFAULT_TRACKS]); };

  const catBtn = (arr, set, c, sz) => {
    const on = arr.includes(c);
    return <button key={c} onClick={() => togCat(arr, set, c)} style={{ padding: sz === "sm" ? "3px 6px" : "3px 8px", fontSize: sz === "sm" ? 9 : 10, fontWeight: 600, fontFamily: "monospace", borderRadius: 3, cursor: "pointer", border: `1px solid ${on ? CAT_COLORS[c].fg : C.border}`, background: on ? CAT_COLORS[c].bg : "transparent", color: on ? CAT_COLORS[c].fg : C.textDim }}>{c}</button>;
  };
  const freeBtn = (on, set, sz) => <button onClick={() => set(!on)} style={{ padding: sz === "sm" ? "3px 6px" : "3px 8px", fontSize: sz === "sm" ? 9 : 10, fontWeight: 700, fontFamily: "monospace", borderRadius: 3, cursor: "pointer", border: `1px solid ${on ? C.free : C.border}`, background: on ? C.freeBg : "transparent", color: on ? C.free : C.textDim }}>FREE</button>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: C.admin }}>Track List Editor</h3>
          <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{tracks.length} tracks · {tracks.filter(t => t.free).length} free · {tracks.filter(t => t.configs != null).length} with configs</p>
        </div>
        <button onClick={reset} style={{ padding: "6px 12px", background: C.dangerBg, color: C.danger, border: `1px solid ${C.danger}`, borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 11 }}>Reset</button>
      </div>
      <div style={{ padding: 14, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTrack()} placeholder="New track..." style={{ ...inp, flex: 1 }} />
          <input value={newCfg} onChange={e => setNewCfg(e.target.value.replace(/\D/g, ""))} placeholder="# cfg" style={{ ...inp, width: 60, textAlign: "center" }} />
          <button onClick={addTrack} style={btnP}>+ Add</button>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.textMuted, marginRight: 4 }}>Types:</span>
          {ALL_CATS.map(c => catBtn(newCats, setNewCats, c))}
          <span style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />
          {freeBtn(newFree, setNewFree)}
        </div>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ ...inp, width: "100%", marginBottom: 12, boxSizing: "border-box" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {sorted.map(t => (
          <div key={t.idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: t.free ? "rgba(56,189,248,0.03)" : C.surface, borderRadius: 6, border: `1px solid ${eidx === t.idx ? C.admin : C.border}` }}>
            {eidx === t.idx ? (<>
              <input value={eName} onChange={e => setEName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveE()} style={{ ...inp, flex: 1 }} autoFocus />
              <div style={{ display: "flex", gap: 3 }}>{ALL_CATS.map(c => catBtn(eCats, setECats, c, "sm"))}</div>
              {freeBtn(eFree, setEFree, "sm")}
              <input value={eCfg} onChange={e => setECfg(e.target.value.replace(/\D/g, ""))} placeholder="cfg" style={{ ...inp, width: 44, textAlign: "center", fontSize: 11 }} />
              <button onClick={saveE} style={{ ...mbtn, color: C.owned, fontWeight: 700 }}>Save</button>
              <button onClick={cancelE} style={mbtn}>Cancel</button>
            </>) : (<>
              <Badges t={t} />
              <span style={{ flex: 1, fontSize: 13 }}>{t.name}</span>
              <button onClick={() => startE(t)} style={{ ...mbtn, color: C.admin }}>edit</button>
              <button onClick={() => remTrack(t.idx)} style={{ ...mbtn, color: C.danger }}>remove</button>
            </>)}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.textDim }}>{sorted.length} of {tracks.length}</div>
    </div>
  );
}

// ─── League Admin Panel ───
function LeagueAdmin({ config, members, nameByUid }) {
  const [newAdmin, setNewAdmin] = useState("");
  const adminUids = config?.adminUids || [];

  const addAdmin = async () => {
    // Find UID by display name
    const uid = Object.entries(nameByUid).find(([u, n]) => n.toLowerCase() === newAdmin.trim().toLowerCase())?.[0];
    if (!uid || adminUids.includes(uid)) return;
    await setConfig({ adminUids: [...adminUids, uid] });
    setNewAdmin("");
  };

  const removeAdmin = async (uid) => {
    if (adminUids.length <= 1) return; // must keep at least one
    if (!confirm(`Remove admin: ${nameByUid[uid]}?`)) return;
    await setConfig({ adminUids: adminUids.filter(u => u !== uid) });
  };

  const removeMemberFn = async (uid) => {
    if (adminUids.includes(uid)) { alert("Remove admin status first"); return; }
    if (!confirm(`Remove member ${members[uid]?.displayName}? Their data will be deleted.`)) return;
    await deleteMember(uid);
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: C.admin }}>League Administration</h3>
      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>{config?.name}</p>

      {/* Admins */}
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Admins</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {adminUids.map(uid => (
          <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.adminBg, borderRadius: 6, border: `1px solid rgba(167,139,250,0.2)` }}>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>
            <span style={{ flex: 1, fontSize: 13 }}>{nameByUid[uid] || uid}</span>
            {adminUids.length > 1 && <button onClick={() => removeAdmin(uid)} style={{ ...mbtn, color: C.danger }}>remove admin</button>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 30 }}>
        <input value={newAdmin} onChange={e => setNewAdmin(e.target.value)} onKeyDown={e => e.key === "Enter" && addAdmin()}
          placeholder="Member name to make admin..." style={{ ...inp, flex: 1 }} />
        <button onClick={addAdmin} style={btnP}>+ Add Admin</button>
      </div>

      {/* Members */}
      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Members ({Object.keys(members).length})</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(members).map(([uid, m]) => {
          const isRacing = m.racing !== false;
          return (
          <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: isRacing ? C.surface : "rgba(255,255,255,0.02)", borderRadius: 6, border: `1px solid ${C.border}`, opacity: isRacing ? 1 : 0.6 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{m.displayName}</span>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{Object.values(m.ownership || {}).filter(v => v === "owned").length} tracks</span>
            <button onClick={async () => { await setMember(uid, { racing: !isRacing }); }} style={{ padding: "3px 8px", fontSize: 9, fontWeight: 700, fontFamily: "monospace", borderRadius: 3, cursor: "pointer", border: `1px solid ${isRacing ? C.owned : C.textDim}`, background: isRacing ? C.ownedBg : "transparent", color: isRacing ? C.owned : C.textDim }}>{isRacing ? "RACING" : "NOT RACING"}</button>
            {adminUids.includes(uid) && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>}
            {!adminUids.includes(uid) && <button onClick={() => removeMemberFn(uid)} style={{ ...mbtn, color: C.danger }}>remove</button>}
          </div>
          );
        })}
      </div>
    </div>
  );
}
