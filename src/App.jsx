import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  onAuth, signOut,
  getConfig, subscribeConfig,
  getTracks, setTracks, subscribeTracks,
  getSchedule, setSchedule, subscribeSchedule,
  setMember, subscribeMembers,
} from "./firebase.js";
import DEFAULT_TRACKS, { normalizeTracks } from "./tracks.js";
import { C, mbtn } from "./lib/shared.js";
import { SignInScreen, CreateLeagueScreen, ClaimScreen, FullScreen, UserName } from "./components/auth.jsx";
import { Grid } from "./components/Grid.jsx";
import { Schedule } from "./components/Schedule.jsx";
import { BuyRecs } from "./components/BuyRecs.jsx";
import { Stats } from "./components/Stats.jsx";
import { Editor } from "./components/Editor.jsx";
import { LeagueAdmin } from "./components/LeagueAdmin.jsx";

export default function App() {
  const [user, setUser] = useState(undefined);
  const [config, setConfigState] = useState(null);
  const [tracks, setTracksState] = useState(DEFAULT_TRACKS);
  const [schedule, setScheduleState] = useState([]);
  const [members, setMembersState] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("grid");
  const [saveStatus, setSaveStatus] = useState("");

  const pendingWrites = useRef(new Set());

  // Auth listener
  useEffect(() => onAuth(u => setUser(u || null)), []);

  // Once authed, load data + subscribe
  useEffect(() => {
    if (!user) return;
    let unsubs = [];
    (async () => {
      const [cfg, trk, sch] = await Promise.all([getConfig(), getTracks(), getSchedule()]);
      if (cfg) setConfigState(cfg);
      if (trk) setTracksState(normalizeTracks(trk));
      if (sch) setScheduleState(sch);
      setLoading(false);

      unsubs.push(subscribeConfig(v => { if (v) setConfigState(v); }));
      unsubs.push(subscribeTracks(v => { if (v) setTracksState(normalizeTracks(v)); }));
      unsubs.push(subscribeSchedule(v => { if (v) setScheduleState(v); }));
      unsubs.push(subscribeMembers(v => {
        setMembersState(prev => {
          if (pendingWrites.current.size === 0) return v;
          const merged = { ...v };
          for (const uid of pendingWrites.current) {
            if (uid in prev) merged[uid] = prev[uid];
          }
          return merged;
        });
      }));
    })();
    return () => unsubs.forEach(fn => fn?.());
  }, [user]);

  // Debounced save helper
  const timers = useRef({});
  const persist = useCallback((key, fn, pendingUid) => {
    setSaveStatus("saving...");
    if (pendingUid) pendingWrites.current.add(pendingUid);
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async () => {
      try {
        await fn();
        setSaveStatus("saved " + new Date().toLocaleTimeString());
      } catch (e) {
        console.error(e);
        setSaveStatus("save failed");
      }
      if (pendingUid) {
        setTimeout(() => pendingWrites.current.delete(pendingUid), 1000);
      }
    }, 400);
  }, []);

  const isAdmin = config?.adminUids?.includes(user?.uid);
  const myMember = members[user?.uid];

  // Backfill email if missing
  useEffect(() => {
    if (user?.email && myMember && !myMember.email) {
      setMember(user.uid, { email: user.email });
    }
  }, [user, myMember]);

  // Derived data
  const memberList = useMemo(() =>
    Object.entries(members).map(([uid, m]) => ({ uid, name: m.displayName })).sort((a, b) => a.name.localeCompare(b.name)),
    [members]
  );
  const memberNames = useMemo(() => memberList.map(m => m.name), [memberList]);
  const uidByName = useMemo(() => Object.fromEntries(memberList.map(m => [m.name, m.uid])), [memberList]);
  const nameByUid = useMemo(() => Object.fromEntries(memberList.map(m => [m.uid, m.name])), [memberList]);

  const ownership = useMemo(() => {
    const o = {};
    for (const [uid, m] of Object.entries(members)) {
      o[m.displayName] = m.ownership || {};
    }
    return o;
  }, [members]);

  const racingStatus = useMemo(() => {
    const r = {};
    for (const [uid, m] of Object.entries(members)) {
      r[m.displayName] = m.racing !== false;
    }
    return r;
  }, [members]);

  const racingNames = useMemo(() => memberNames.filter(n => racingStatus[n]), [memberNames, racingStatus]);
  const trackNames = useMemo(() => tracks.map(t => t.name).sort(), [tracks]);
  const trackMap = useMemo(() => Object.fromEntries(tracks.map(t => [t.name, t])), [tracks]);

  // Save helpers
  const saveOwnership = useCallback((memberName, newOwnership) => {
    const uid = uidByName[memberName];
    if (!uid) return;
    pendingWrites.current.add(uid);
    const updated = { ...members[uid], ownership: newOwnership };
    setMembersState(prev => ({ ...prev, [uid]: updated }));
    persist(`member-${uid}`, () => setMember(uid, { ownership: newOwnership }), uid);
  }, [members, uidByName, persist]);

  const renameMember = useCallback((uid, newName) => {
    pendingWrites.current.add(uid);
    setMembersState(prev => ({ ...prev, [uid]: { ...prev[uid], displayName: newName } }));
    persist(`member-${uid}`, () => setMember(uid, { displayName: newName }), uid);
  }, [persist]);

  const saveScheduleFn = useCallback((rounds) => {
    setScheduleState(rounds);
    persist('schedule', () => setSchedule(rounds));
  }, [persist]);

  const saveTracksFn = useCallback((list) => {
    setTracksState(list);
    persist('tracks', () => setTracks(list));
  }, [persist]);

  // Auth screens
  if (user === undefined) return <FullScreen>Loading...</FullScreen>;
  if (user === null) return <SignInScreen />;
  if (!loading && !config) return <CreateLeagueScreen user={user} onCreated={(cfg) => setConfigState(cfg)} />;
  if (!loading && !myMember) return <ClaimScreen user={user} members={members} config={config} />;
  if (loading) return <FullScreen>Loading league data...</FullScreen>;

  // Data bundle for child components
  const data = { members: memberNames, racingMembers: racingNames, racing: racingStatus, ownership, schedule };

  const save = (newData) => {
    if (newData.schedule !== data.schedule) {
      saveScheduleFn(newData.schedule);
    }
    for (const name of newData.members) {
      if (newData.ownership[name] !== data.ownership[name]) {
        saveOwnership(name, newData.ownership[name]);
      }
    }
  };

  const mainTabs = [
    { id: "grid", label: "Ownership Grid", icon: "🏎️" },
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
          <UserName user={user} myMember={myMember} renameMember={renameMember} />
          {isAdmin && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>}
          <button onClick={signOut} style={{ ...mbtn, color: C.textMuted, fontSize: 11 }}>Sign Out</button>
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

      {/* Footer */}
      <div style={{ padding: "20px 24px", borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
        <a href="https://github.com/twr-chris/trackblender" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, color: C.textDim, textDecoration: "none", fontFamily: "monospace" }}>
          powered by TrackBlender
        </a>
      </div>
    </div>
  );
}
