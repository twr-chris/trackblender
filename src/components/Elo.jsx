import { useState, useMemo, useCallback } from "react";
import { C, inp, btnP, mbtn, thS, tdS } from "../lib/shared.js";
import { StatCard, Empty } from "./shared.jsx";
import { calculateElo } from "../lib/elo.js";
import { parseIracingResult } from "../lib/iracing-parser.js";
import { setMember } from "../firebase.js";

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Display a date string in local time. Handles both full ISO ("2026-01-29T03:00:15Z")
// and plain date ("2026-01-29") for backward compat with manually entered races.
function displayDate(d) {
  if (!d) return "no date";
  if (d.includes("T")) {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-CA"); // "YYYY-MM-DD" format in local tz
  }
  return d;
}

// Deterministic color from string — pleasant pastel palette
const CLASS_PALETTE = [
  { fg: "#60a5fa", bg: "rgba(96,165,250,0.12)" },   // blue
  { fg: "#f472b6", bg: "rgba(244,114,182,0.12)" },   // pink
  { fg: "#34d399", bg: "rgba(52,211,153,0.12)" },     // emerald
  { fg: "#fb923c", bg: "rgba(251,146,60,0.12)" },     // orange
  { fg: "#a78bfa", bg: "rgba(167,139,250,0.12)" },    // violet
  { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)" },     // amber
  { fg: "#2dd4bf", bg: "rgba(45,212,191,0.12)" },     // teal
  { fg: "#f87171", bg: "rgba(248,113,113,0.12)" },    // red
];
function classColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return CLASS_PALETTE[Math.abs(h) % CLASS_PALETTE.length];
}

export function Elo({ races, eloRatings, members, nameByUid, isAdmin, addRace, setRace, deleteRace, setEloRatings, persist, trackNames, currentUid }) {
  const [view, setView] = useState("standings"); // standings | races | settings
  const [expandedRace, setExpandedRace] = useState(null);
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);

  // Build alias map: lowercased name/alias -> uid
  const aliasMap = useMemo(() => {
    const map = {};
    for (const [uid, m] of Object.entries(members)) {
      map[m.displayName.toLowerCase()] = uid;
      for (const alias of (m.aliases || [])) {
        map[alias.toLowerCase()] = uid;
      }
    }
    return map;
  }, [members]);

  // All known driver names for autocomplete
  const knownNames = useMemo(() => {
    const names = new Set();
    for (const m of Object.values(members)) {
      names.add(m.displayName);
      for (const alias of (m.aliases || [])) names.add(alias);
    }
    // External names from existing races
    for (const r of Object.values(races)) {
      for (const res of r.results || []) {
        if (res.driverKey?.startsWith("ext_")) names.add(res.name);
      }
    }
    return [...names].sort();
  }, [members, races]);

  // Sorted race list
  const raceList = useMemo(() =>
    Object.entries(races).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.raceNumber || 1) - (b.raceNumber || 1) || (a.raceClass || "").localeCompare(b.raceClass || "")),
    [races]
  );

  // Unique seasons and classes
  const seasons = useMemo(() => {
    const s = new Set(raceList.map(r => r.season).filter(Boolean));
    return [...s].sort();
  }, [raceList]);

  const classes = useMemo(() => {
    const c = new Set(raceList.map(r => r.raceClass).filter(Boolean));
    return [...c].sort();
  }, [raceList]);

  const filteredRaces = raceList.filter(r =>
    (seasonFilter === "all" || r.season === seasonFilter) &&
    (classFilter === "all" || r.raceClass === classFilter)
  );

  // Standings data
  const standings = useMemo(() => {
    if (!eloRatings?.ratings) return [];
    return Object.entries(eloRatings.ratings)
      .map(([key, r]) => ({
        driverKey: key,
        name: nameByUid[key] || (key.startsWith("ext_") ? findExtName(key) : key),
        elo: Math.round(r.elo),
        racesPlayed: r.racesPlayed,
        isMember: !!nameByUid[key],
      }))
      .sort((a, b) => b.elo - a.elo);
  }, [eloRatings, nameByUid]);

  function findExtName(key) {
    for (const r of Object.values(races)) {
      const found = (r.results || []).find(res => res.driverKey === key);
      if (found) return found.name;
    }
    return key.replace("ext_", "").replace(/-/g, " ");
  }

  // Resolve a typed name to a driverKey
  const resolveDriver = useCallback((name) => {
    const uid = aliasMap[name.toLowerCase()];
    if (uid) return { driverKey: uid, name: members[uid]?.displayName || name };
    return { driverKey: "ext_" + slugify(name), name };
  }, [aliasMap, members]);

  // Calculate ELO
  const handleCalculate = async (kFactor) => {
    const sorted = Object.entries(races)
      .map(([id, r]) => r)
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.raceNumber || 1) - (b.raceNumber || 1) || (a.raceClass || "").localeCompare(b.raceClass || ""));
    const ratings = calculateElo(sorted, kFactor);
    await setEloRatings({ ratings, kFactor, lastCalculatedAt: new Date().toISOString() });
  };

  const subTabs = [
    { id: "standings", label: "Standings" },
    { id: "races", label: "Race Results" },
    { id: "mystats", label: "My Stats" },
    ...(isAdmin ? [{ id: "settings", label: "Settings" }] : []),
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: C.elo, margin: 0 }}>League ELO</h3>
        <div style={{ display: "flex", gap: 2 }}>
          {subTabs.map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              padding: "5px 12px", fontSize: 11, fontWeight: view === t.id ? 600 : 400,
              background: view === t.id ? C.eloBg : "transparent", color: view === t.id ? C.elo : C.textMuted,
              border: `1px solid ${view === t.id ? C.elo : C.border}`, borderRadius: 5,
              cursor: "pointer", fontFamily: "inherit",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {view === "standings" && <StandingsView standings={standings} eloRatings={eloRatings} raceCount={raceList.length} isAdmin={isAdmin} members={members} races={races} setRace={setRace} nameByUid={nameByUid} />}
      {view === "races" && <RacesView races={filteredRaces} seasons={seasons} classes={classes} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} classFilter={classFilter} setClassFilter={setClassFilter} expandedRace={expandedRace} setExpandedRace={setExpandedRace} isAdmin={isAdmin} showAddForm={showAddForm} setShowAddForm={setShowAddForm} members={members} knownNames={knownNames} resolveDriver={resolveDriver} addRace={addRace} deleteRace={deleteRace} setRace={setRace} nameByUid={nameByUid} eloRatings={eloRatings} trackNames={trackNames} />}
      {view === "mystats" && <MyStatsView currentUid={currentUid} races={raceList} eloRatings={eloRatings} nameByUid={nameByUid} />}
      {view === "settings" && isAdmin && <SettingsView eloRatings={eloRatings} handleCalculate={handleCalculate} raceCount={raceList.length} />}
    </div>
  );
}

// ─── Standings ───
function StandingsView({ standings, eloRatings, raceCount, isAdmin, members, races, setRace, nameByUid }) {
  const [hideProvisional, setHideProvisional] = useState(true);
  const PROVISIONAL_THRESHOLD = 6;

  const filtered = hideProvisional ? standings.filter(s => s.racesPlayed >= PROVISIONAL_THRESHOLD) : standings;
  const provisionalCount = standings.length - standings.filter(s => s.racesPlayed >= PROVISIONAL_THRESHOLD).length;
  const highest = filtered.length > 0 ? filtered[0] : null;

  if (!eloRatings?.ratings || standings.length === 0) {
    return <Empty icon="🏆" title="No ELO Ratings Yet" sub="Add race results and calculate ELO from the Settings tab." />;
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Races" value={raceCount} color={C.elo} />
        <StatCard label="Drivers Rated" value={filtered.length} color={C.accent} />
        <StatCard label="Highest ELO" value={highest ? `${highest.elo}` : "-"} color={C.owned} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textMuted, cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={hideProvisional} onChange={e => setHideProvisional(e.target.checked)} />
          Hide provisional (&lt;{PROVISIONAL_THRESHOLD} races)
        </label>
        {hideProvisional && provisionalCount > 0 && <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{provisionalCount} hidden</span>}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thS, textAlign: "center", width: 40 }}>#</th>
            <th style={thS}>Driver</th>
            <th style={{ ...thS, textAlign: "right" }}>ELO</th>
            <th style={{ ...thS, textAlign: "right" }}>Races</th>
            {isAdmin && <th style={{ ...thS, width: 80 }}></th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((s, i) => (
            <tr key={s.driverKey}>
              <td style={{ ...tdS, textAlign: "center", color: C.textMuted, fontFamily: "monospace", fontSize: 12 }}>{i + 1}</td>
              <td style={tdS}>
                <span style={{ fontSize: 13 }}>{s.name}</span>
                {s.isMember && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: C.ownedBg, color: C.owned }}>TB</span>}
                {!s.isMember && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: "rgba(255,255,255,0.05)", color: C.textDim }}>EXT</span>}
              </td>
              <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: s.elo >= 1000 ? C.owned : C.danger }}>{s.elo}</td>
              <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: C.textMuted }}>{s.racesPlayed}</td>
              {isAdmin && !s.isMember && (
                <td style={tdS}>
                  <LinkDriverButton driverKey={s.driverKey} driverName={s.name} members={members} races={races} setRace={setRace} nameByUid={nameByUid} />
                </td>
              )}
              {isAdmin && s.isMember && <td style={tdS}></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {eloRatings?.lastCalculatedAt && (
        <div style={{ marginTop: 12, fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>
          Last calculated: {new Date(eloRatings.lastCalculatedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}

// ─── Link external driver to TB member ───
function LinkDriverButton({ driverKey, driverName, members, races, setRace, nameByUid }) {
  const [show, setShow] = useState(false);
  const [search, setSearch] = useState("");

  const unlinkedMembers = useMemo(() => {
    return Object.entries(members)
      .map(([uid, m]) => ({ uid, name: m.displayName }))
      .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, search]);

  const handleLink = async (targetUid) => {
    // Rewrite all race results that reference the old ext_ key to the member UID
    for (const [raceId, race] of Object.entries(races)) {
      const hasDriver = (race.results || []).some(r => r.driverKey === driverKey);
      if (hasDriver) {
        const newResults = race.results.map(r =>
          r.driverKey === driverKey ? { ...r, driverKey: targetUid, name: nameByUid[targetUid] || r.name } : r
        );
        await setRace(raceId, { results: newResults });
      }
    }
    setShow(false);
  };

  if (!show) {
    return <button onClick={() => setShow(true)} style={{ ...mbtn, color: C.elo, fontSize: 10 }}>link</button>;
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search member..." style={{ ...inp, padding: "3px 8px", fontSize: 11, width: 120 }} />
      {unlinkedMembers.slice(0, 3).map(m => (
        <button key={m.uid} onClick={() => handleLink(m.uid)} style={{ ...mbtn, color: C.owned, fontSize: 10 }}>{m.name}</button>
      ))}
      <button onClick={() => setShow(false)} style={{ ...mbtn, color: C.danger, fontSize: 10 }}>x</button>
    </div>
  );
}

// ─── Race Results ───
function RacesView({ races, seasons, classes, seasonFilter, setSeasonFilter, classFilter, setClassFilter, expandedRace, setExpandedRace, isAdmin, showAddForm, setShowAddForm, members, knownNames, resolveDriver, addRace, deleteRace, setRace, nameByUid, eloRatings, trackNames }) {
  const [showImport, setShowImport] = useState(false);
  const [collapsedSeasons, setCollapsedSeasons] = useState({}); // season → bool

  const toggleSeason = (s) => setCollapsedSeasons(prev => ({ ...prev, [s]: !prev[s] }));

  // Group races by season
  const racesBySeason = useMemo(() => {
    const groups = {};
    for (const r of races) {
      const s = r.season || "Untagged";
      if (!groups[s]) groups[s] = [];
      groups[s].push(r);
    }
    return groups;
  }, [races]);

  if (races.length === 0 && !showAddForm) {
    return (
      <div>
        <Empty icon="🏁" title="No Race Results" sub="Add your first race to start tracking ELO." />
        {isAdmin && <div style={{ textAlign: "center", marginTop: 12 }}><button onClick={() => setShowAddForm(true)} style={btnP}>+ Add Race</button></div>}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <select value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)} style={{ ...inp, padding: "6px 10px" }}>
          <option value="all">All Seasons</option>
          {seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {classes.length > 0 && <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ ...inp, padding: "6px 10px" }}>
          <option value="all">All Classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>}
        {isAdmin && <button onClick={() => setShowAddForm(!showAddForm)} style={btnP}>{showAddForm ? "Cancel" : "+ Add Race"}</button>}
        {isAdmin && <button onClick={() => setShowImport(true)} style={{ ...btnP, background: C.free }}>Import iRacing JSON</button>}
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{races.length} race{races.length !== 1 ? "s" : ""}</span>
      </div>

      {showAddForm && isAdmin && <AddRaceForm members={members} knownNames={knownNames} resolveDriver={resolveDriver} addRace={addRace} onDone={() => setShowAddForm(false)} eloRatings={eloRatings} trackNames={trackNames} />}
      {showImport && isAdmin && <ImportRaceModal members={members} addRace={addRace} onClose={() => setShowImport(false)} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(racesBySeason).map(([seasonName, seasonRaces]) => {
          const collapsed = !!collapsedSeasons[seasonName];
          return (
            <div key={seasonName}>
              <div onClick={() => toggleSeason(seasonName)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer", userSelect: "none" }}>
                <span style={{ color: C.textDim, fontSize: 12 }}>{collapsed ? "▶" : "▼"}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.elo }}>Season {seasonName}</span>
                <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{seasonRaces.length} race{seasonRaces.length !== 1 ? "s" : ""}</span>
                <div style={{ flex: 1, height: 1, background: C.border, marginLeft: 8 }} />
              </div>
              {!collapsed && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {seasonRaces.map(r => (
                    <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
                      <div onClick={() => setExpandedRace(expandedRace === r.id ? null : r.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer" }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", color: C.textMuted, minWidth: 80 }}>{displayDate(r.date)}</span>
                        <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim, minWidth: 20 }}>R{r.raceNumber || 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{r.trackName || "Race"}</span>
                        {r.raceClass && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: classColor(r.raceClass).bg, color: classColor(r.raceClass).fg }}>{r.raceClass}</span>}
                        <span style={{ fontSize: 11, color: C.textMuted }}>{(r.results || []).length} drivers</span>
                        <span style={{ color: C.textDim }}>{expandedRace === r.id ? "▲" : "▼"}</span>
                      </div>
                      {expandedRace === r.id && <RaceDetail race={r} isAdmin={isAdmin} setRace={setRace} deleteRace={deleteRace} setExpandedRace={setExpandedRace} nameByUid={nameByUid} trackNames={trackNames} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Race Detail (expanded view with editable properties) ───
function RaceDetail({ race, isAdmin, setRace, deleteRace, setExpandedRace, nameByUid, trackNames }) {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(race.date || "");
  const [editRaceNum, setEditRaceNum] = useState(race.raceNumber || 1);
  const [editTrack, setEditTrack] = useState(race.trackName || "");
  const [editSeason, setEditSeason] = useState(race.season || "");
  const [editClass, setEditClass] = useState(race.raceClass || "");

  const handleSave = async () => {
    await setRace(race.id, { date: editDate, raceNumber: editRaceNum, trackName: editTrack.trim() || null, season: editSeason.trim(), raceClass: editClass.trim() || null });
    setEditing(false);
  };

  return (
    <div style={{ padding: "0 14px 12px", borderTop: `1px solid ${C.border}` }}>
      {isAdmin && editing ? (
        <div style={{ display: "flex", gap: 6, marginTop: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ ...inp, padding: "4px 8px", fontSize: 12 }} />
          <input type="number" value={editRaceNum} onChange={e => setEditRaceNum(Number(e.target.value))} min={1} style={{ ...inp, width: 50, padding: "4px 8px", fontSize: 12, textAlign: "center" }} title="Race #" />
          <select value={editTrack} onChange={e => setEditTrack(e.target.value)} style={{ ...inp, flex: 1, padding: "4px 8px", fontSize: 12, minWidth: 120 }}>
            <option value="">— Select track —</option>
            {(trackNames || []).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={editSeason} onChange={e => setEditSeason(e.target.value)} placeholder="Season" style={{ ...inp, width: 80, padding: "4px 8px", fontSize: 12 }} />
          <input value={editClass} onChange={e => setEditClass(e.target.value)} placeholder="Class (optional)" style={{ ...inp, width: 100, padding: "4px 8px", fontSize: 12 }} />
          <button onClick={handleSave} style={{ ...btnP, padding: "4px 12px", fontSize: 11 }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ ...mbtn, color: C.textMuted, fontSize: 11 }}>Cancel</button>
        </div>
      ) : (
        isAdmin && <button onClick={() => setEditing(true)} style={{ ...mbtn, color: C.elo, fontSize: 10, marginTop: 8, marginBottom: 4 }}>Edit Properties</button>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ ...thS, width: 40, textAlign: "center" }}>Pos</th>
            <th style={thS}>Driver</th>
          </tr>
        </thead>
        <tbody>
          {(race.results || []).sort((a, b) => a.position - b.position).map((res, i) => (
            <tr key={i}>
              <td style={{ ...tdS, textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: res.position <= 3 ? C.elo : C.textMuted }}>{res.position}</td>
              <td style={tdS}>
                <span style={{ fontSize: 13 }}>{nameByUid[res.driverKey] || res.name}</span>
                {nameByUid[res.driverKey] && <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: C.ownedBg, color: C.owned }}>TB</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && (
        <button onClick={async () => { if (confirm("Delete this race?")) { await deleteRace(race.id); setExpandedRace(null); } }} style={{ ...mbtn, color: C.danger, marginTop: 8 }}>Delete Race</button>
      )}
    </div>
  );
}

// ─── Add Race Form ───
function AddRaceForm({ members, knownNames, resolveDriver, addRace, onDone, eloRatings, trackNames }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [raceNumber, setRaceNumber] = useState(1);
  const [trackName, setTrackName] = useState("");
  const [season, setSeason] = useState("");
  const [raceClass, setRaceClass] = useState("");
  const [newDriver, setNewDriver] = useState("");

  // Positioned = finished order (top = P1). Available = not yet placed.
  const [positioned, setPositioned] = useState([]);
  const [available, setAvailable] = useState(() => {
    const racing = Object.values(members).filter(m => m.racing !== false).sort((a, b) => a.displayName.localeCompare(b.displayName));
    return racing.map(m => ({ name: m.displayName, id: crypto.randomUUID() }));
  });
  const [availSort, setAvailSort] = useState("name"); // "name" | "elo"

  const sortedAvailable = useMemo(() => {
    if (availSort === "elo" && eloRatings?.ratings) {
      return [...available].sort((a, b) => {
        const resolved_a = resolveDriver(a.name);
        const resolved_b = resolveDriver(b.name);
        const eloA = eloRatings.ratings[resolved_a.driverKey]?.elo || 0;
        const eloB = eloRatings.ratings[resolved_b.driverKey]?.elo || 0;
        return eloB - eloA;
      });
    }
    return [...available].sort((a, b) => a.name.localeCompare(b.name));
  }, [available, availSort, eloRatings, resolveDriver]);

  const getElo = (name) => {
    if (!eloRatings?.ratings) return null;
    const resolved = resolveDriver(name);
    const r = eloRatings.ratings[resolved.driverKey];
    return r ? Math.round(r.elo) : null;
  };

  // Drag state: tracks source pool and index
  const [drag, setDrag] = useState(null); // { pool: "pos"|"avail", id }
  const [overTarget, setOverTarget] = useState(null); // { pool, index }

  const handleDragStart = (pool, id) => setDrag({ pool, id });
  const handleDragEnd = () => { setDrag(null); setOverTarget(null); };

  const handleDragOverPositioned = (e, index) => {
    e.preventDefault();
    setOverTarget({ pool: "pos", index });
  };

  const handleDropOnPositioned = (index) => {
    if (!drag) return;
    if (drag.pool === "pos") {
      // Reorder within positioned
      setPositioned(prev => {
        const fromIdx = prev.findIndex(r => r.id === drag.id);
        if (fromIdx === -1 || fromIdx === index) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(index > fromIdx ? index - 1 : index, 0, moved);
        return next;
      });
    } else {
      // Move from available to positioned at index
      const item = available.find(r => r.id === drag.id);
      if (!item) return;
      setAvailable(prev => prev.filter(r => r.id !== drag.id));
      setPositioned(prev => { const next = [...prev]; next.splice(index, 0, item); return next; });
    }
    setDrag(null);
    setOverTarget(null);
  };

  // Drop zone at end of positioned list (or empty state)
  const handleDropOnPositionedEnd = () => {
    if (!drag) return;
    if (drag.pool === "avail") {
      const item = available.find(r => r.id === drag.id);
      if (!item) return;
      setAvailable(prev => prev.filter(r => r.id !== drag.id));
      setPositioned(prev => [...prev, item]);
    } else if (drag.pool === "pos") {
      setPositioned(prev => {
        const fromIdx = prev.findIndex(r => r.id === drag.id);
        if (fromIdx === -1) return prev;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.push(moved);
        return next;
      });
    }
    setDrag(null);
    setOverTarget(null);
  };

  // Send back from positioned to available
  const unposition = (id) => {
    const item = positioned.find(r => r.id === id);
    if (!item) return;
    setPositioned(prev => prev.filter(r => r.id !== id));
    setAvailable(prev => [...prev, item]);
  };

  // Add a custom driver name to available pool
  const addDriver = () => {
    const trimmed = newDriver.trim();
    if (!trimmed) return;
    setAvailable(prev => [...prev, { name: trimmed, id: crypto.randomUUID() }]);
    setNewDriver("");
  };

  const handleSave = async () => {
    const results = positioned.filter(r => r.name.trim()).map((r, i) => {
      const resolved = resolveDriver(r.name.trim());
      return { ...resolved, position: i + 1 };
    });
    if (results.length < 2) return;
    await addRace({ date, raceNumber, trackName: trackName.trim() || null, season: season.trim(), raceClass: raceClass.trim() || null, results });
    onDone();
  };

  const sectionHead = { fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 };
  const driverTile = (isDragging) => ({
    display: "flex", gap: 6, alignItems: "center", padding: "5px 8px", borderRadius: 4,
    background: isDragging ? C.eloBg : C.surface, border: `1px solid ${isDragging ? C.elo : C.border}`,
    cursor: "grab", transition: "background 0.1s", userSelect: "none",
  });

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inp, padding: "6px 10px" }} />
        <input type="number" value={raceNumber} onChange={e => setRaceNumber(Number(e.target.value))} min={1} style={{ ...inp, width: 60, padding: "6px 10px", textAlign: "center" }} title="Race # (order within same night)" />
        <select value={trackName} onChange={e => setTrackName(e.target.value)} style={{ ...inp, flex: 1, minWidth: 150 }}>
          <option value="">— Select track —</option>
          {(trackNames || []).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={season} onChange={e => setSeason(e.target.value)} placeholder="Season (e.g. S1)" style={{ ...inp, width: 100 }} />
        <input value={raceClass} onChange={e => setRaceClass(e.target.value)} placeholder="Class (optional)" style={{ ...inp, width: 120 }} />
      </div>

      {/* Positioned pool — finish order */}
      <div style={sectionHead}>
        <span>🏁 Finish Order</span>
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{positioned.length} placed</span>
      </div>
      <div
        onDragOver={e => { e.preventDefault(); if (positioned.length === 0) setOverTarget({ pool: "pos", index: 0 }); }}
        onDrop={() => positioned.length === 0 && handleDropOnPositionedEnd()}
        style={{
          display: "flex", flexDirection: "column", gap: 2, marginBottom: 14, padding: 6, borderRadius: 6,
          minHeight: 40, border: `1px dashed ${positioned.length === 0 ? C.elo : C.border}`,
          background: positioned.length === 0 ? "rgba(251,191,36,0.03)" : "transparent",
        }}>
        {positioned.length === 0 && <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", padding: 8 }}>Drag drivers here to place them</div>}
        {positioned.map((r, i) => (
          <div key={r.id} draggable onDragStart={() => handleDragStart("pos", r.id)} onDragOver={e => handleDragOverPositioned(e, i)} onDrop={() => handleDropOnPositioned(i)} onDragEnd={handleDragEnd}
            style={{
              ...driverTile(drag?.id === r.id),
              borderColor: overTarget?.pool === "pos" && overTarget?.index === i && drag?.id !== r.id ? C.elo : drag?.id === r.id ? C.elo : C.border,
              borderTopWidth: overTarget?.pool === "pos" && overTarget?.index === i && drag?.id !== r.id ? 2 : 1,
              borderTopStyle: overTarget?.pool === "pos" && overTarget?.index === i && drag?.id !== r.id ? "dashed" : "solid",
            }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: i < 3 ? C.elo : C.textDim, fontWeight: 700, minWidth: 24, textAlign: "right" }}>P{i + 1}</span>
            <span style={{ color: C.textDim, fontSize: 12 }}>⠿</span>
            <span style={{ flex: 1, fontSize: 13 }}>{r.name}</span>
            {getElo(r.name) !== null && <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim }}>{getElo(r.name)}</span>}
            <button onClick={() => unposition(r.id)} style={{ ...mbtn, color: C.textMuted, fontSize: 10 }} title="Send back">↩</button>
          </div>
        ))}
        {/* Drop zone at end */}
        {positioned.length > 0 && (
          <div onDragOver={e => { e.preventDefault(); setOverTarget({ pool: "pos", index: positioned.length }); }}
            onDrop={handleDropOnPositionedEnd}
            style={{ height: overTarget?.pool === "pos" && overTarget?.index === positioned.length ? 28 : 8, borderRadius: 4, border: overTarget?.pool === "pos" && overTarget?.index === positioned.length ? `1px dashed ${C.elo}` : "none", transition: "height 0.1s" }} />
        )}
      </div>

      {/* Available pool */}
      <div style={sectionHead}>
        <span>👥 Available Drivers</span>
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{available.length} remaining</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setAvailSort(availSort === "name" ? "elo" : "name")} style={{ ...mbtn, fontSize: 10, color: C.elo }}>
          sort: {availSort === "name" ? "A-Z" : "ELO"}
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12, padding: 6, borderRadius: 6, border: `1px solid ${C.border}`, minHeight: 32 }}>
        {sortedAvailable.map(r => (
          <div key={r.id} draggable onDragStart={() => handleDragStart("avail", r.id)} onDragEnd={handleDragEnd}
            style={{ ...driverTile(drag?.id === r.id), padding: "4px 10px" }}>
            <span style={{ fontSize: 12 }}>{r.name}</span>
            {availSort === "elo" && getElo(r.name) !== null && <span style={{ fontSize: 9, fontFamily: "monospace", color: C.textDim }}>{getElo(r.name)}</span>}
          </div>
        ))}
        {available.length === 0 && <div style={{ fontSize: 11, color: C.textDim, padding: 4 }}>All drivers placed</div>}
      </div>

      {/* Add custom driver */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <input value={newDriver} onChange={e => setNewDriver(e.target.value)} onKeyDown={e => e.key === "Enter" && addDriver()}
          placeholder="Add external driver..." list="elo-driver-names" style={{ ...inp, flex: 1, padding: "5px 10px" }} />
        <button onClick={addDriver} style={{ ...mbtn, color: C.elo }}>+ Add</button>
      </div>
      <datalist id="elo-driver-names">
        {knownNames.map(n => <option key={n} value={n} />)}
      </datalist>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }} />
        <button onClick={onDone} style={{ ...mbtn, color: C.textMuted }}>Cancel</button>
        <button onClick={handleSave} style={btnP}>Save Race ({positioned.length} drivers)</button>
      </div>
    </div>
  );
}

// ─── iRacing JSON Import Modal (multi-file) ───
function ImportRaceModal({ members, addRace, onClose }) {
  const [events, setEvents] = useState([]); // [{ parsed, raceNumber, fileName }]
  const [error, setError] = useState("");
  const [season, setSeason] = useState("");
  const [importing, setImporting] = useState(false);
  const [linkMap, setLinkMap] = useState({}); // custId → uid
  const [overrideMap, setOverrideMap] = useState({}); // "eventIdx-raceIdx-driverIdx" → uid
  const [collapsedEvents, setCollapsedEvents] = useState({});
  const [forceSingleClass, setForceSingleClass] = useState(false);

  const handleFiles = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setError("");
    const results = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const result = parseIracingResult(json, members);
        if (result.error) { setError(prev => prev ? prev + "\n" + file.name + ": " + result.error : file.name + ": " + result.error); continue; }
        if (result.races.length === 0) continue;
        results.push({ parsed: result, raceNumber: 1, fileName: file.name });
      } catch (err) {
        setError(prev => prev ? prev + "\n" + file.name + ": " + err.message : file.name + ": " + err.message);
      }
    }
    // Sort by date for sensible race number defaults
    results.sort((a, b) => (a.parsed.date || "").localeCompare(b.parsed.date || ""));
    // Auto-assign race numbers: group by date, increment within same date
    const dateCounts = {};
    for (const r of results) {
      const d = displayDate(r.parsed.date);
      dateCounts[d] = (dateCounts[d] || 0) + 1;
      r.raceNumber = dateCounts[d];
    }
    setEvents(results);
  };

  const setEventRaceNumber = (i, n) => setEvents(prev => prev.map((ev, j) => j === i ? { ...ev, raceNumber: n } : ev));

  const handleLink = (custId, uid) => setLinkMap(prev => ({ ...prev, [custId]: uid }));

  // When forcing single class, merge all class results into one race per event
  const effectiveEvents = useMemo(() => {
    if (!forceSingleClass) return events;
    return events.map(ev => {
      if (ev.parsed.races.length <= 1) return ev;
      const allResults = ev.parsed.races.flatMap(r => r.results);
      // Re-sort by overall position and re-number
      allResults.sort((a, b) => a.position - b.position);
      const merged = allResults.map((r, i) => ({ ...r, position: i + 1 }));
      return {
        ...ev,
        parsed: {
          ...ev.parsed,
          races: [{ ...ev.parsed.races[0], raceClass: null, results: merged }],
        },
      };
    });
  }, [events, forceSingleClass]);

  const totalRaces = effectiveEvents.reduce((n, ev) => n + ev.parsed.races.length, 0);

  const handleImport = async () => {
    setImporting(true);
    try {
      // Save custId links (skip virtual members — their pod mapping is managed manually)
      for (const [custId, uid] of Object.entries(linkMap)) {
        if (uid && !members[uid]?.virtual) await setMember(uid, { iracingCustId: custId });
      }

      // Auto-save custId for matched non-virtual drivers (always overwrite so stale pod IDs get replaced)
      for (const ev of effectiveEvents) {
        for (const race of ev.parsed.races) {
          for (const r of race.results) {
            if ((r.matchType === "alias" || r.matchType === "custId") && r.custId && !members[r.driverKey]?.virtual && members[r.driverKey]?.iracingCustId !== r.custId) {
              await setMember(r.driverKey, { iracingCustId: r.custId });
            }
          }
        }
      }

      // Create race records
      for (const [ei, ev] of effectiveEvents.entries()) {
        for (const [ri, race] of ev.parsed.races.entries()) {
          const updatedResults = race.results.map((r, di) => {
            const overrideKey = `${ei}-${ri}-${di}`;
            if (overrideMap[overrideKey]) {
              const uid = overrideMap[overrideKey];
              return { ...r, driverKey: uid, name: members[uid]?.displayName || r.name };
            }
            if (r.matchType === "unmatched" && linkMap[r.custId]) {
              const uid = linkMap[r.custId];
              return { ...r, driverKey: uid, name: members[uid]?.displayName || r.name };
            }
            return r;
          });
          const cleanResults = updatedResults.map(({ matchType, custId, iracingName, ...rest }) => rest);
          await addRace({
            date: race.date,
            raceNumber: ev.raceNumber,
            trackName: race.trackName,
            season: season.trim(),
            raceClass: race.raceClass,
            results: cleanResults,
          });
        }
      }
      onClose();
    } catch (err) {
      setError("Import failed: " + err.message);
    }
    setImporting(false);
  };

  const memberOptions = Object.entries(members)
    .map(([uid, m]) => ({ uid, name: m.displayName }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const matchColor = { custId: C.owned, alias: C.elo, unmatched: C.danger, linked: C.owned, override: C.admin };
  const matchLabel = { custId: "ID", alias: "name", unmatched: "?", linked: "linked", override: "reassigned" };

  const overlay = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" };
  const modal = { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24, maxWidth: 700, width: "90%", maxHeight: "85vh", overflow: "auto" };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: C.free, margin: 0 }}>Import iRacing Results</h3>
          <button onClick={onClose} style={{ ...mbtn, color: C.textMuted, fontSize: 16 }}>x</button>
        </div>

        {events.length === 0 ? (
          <div>
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Select one or more iRacing event result JSON files.</p>
            <input type="file" accept=".json" multiple onChange={handleFiles} style={{ fontSize: 13, color: C.text, marginBottom: 12 }} />
            {error && <div style={{ color: C.danger, fontSize: 12, marginTop: 8, whiteSpace: "pre-line" }}>{error}</div>}
          </div>
        ) : (
          <div>
            {/* Shared season */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}>
              <input value={season} onChange={e => setSeason(e.target.value)} placeholder="Season (e.g. 6)" style={{ ...inp, width: 100, padding: "4px 8px", fontSize: 12 }} />
              <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.textMuted, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={forceSingleClass} onChange={e => setForceSingleClass(e.target.checked)} />
                Force single class
              </label>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{effectiveEvents.length} file{effectiveEvents.length !== 1 ? "s" : ""} · {totalRaces} race{totalRaces !== 1 ? "s" : ""}</span>
            </div>

            {/* Per-file event groups */}
            {effectiveEvents.map((ev, ei) => {
              const collapsed = !!collapsedEvents[ei];
              return (
                <div key={ei} style={{ marginBottom: 10 }}>
                  <div onClick={() => setCollapsedEvents(prev => ({ ...prev, [ei]: !prev[ei] }))}
                    style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", cursor: "pointer", userSelect: "none" }}>
                    <span style={{ color: C.textDim, fontSize: 11 }}>{collapsed ? "▶" : "▼"}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{ev.parsed.trackName}</span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>{displayDate(ev.parsed.date)}</span>
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>R</span>
                    <input type="number" value={ev.raceNumber} onChange={e => { e.stopPropagation(); setEventRaceNumber(ei, Number(e.target.value)); }}
                      onClick={e => e.stopPropagation()} min={1} style={{ ...inp, width: 40, padding: "2px 6px", fontSize: 11, textAlign: "center" }} />
                    <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>{ev.parsed.races.length} class{ev.parsed.races.length !== 1 ? "es" : ""}</span>
                    <div style={{ flex: 1, height: 1, background: C.border, marginLeft: 4 }} />
                  </div>

                  {!collapsed && ev.parsed.races.map((race, ri) => (
                    <div key={ri} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, marginBottom: 6, marginLeft: 16 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                        {race.raceClass && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: classColor(race.raceClass).bg, color: classColor(race.raceClass).fg }}>{race.raceClass}</span>}
                        <span style={{ fontSize: 11, color: C.textMuted }}>{race.results.length} drivers</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {race.results.map((r, di) => {
                          const overrideKey = `${ei}-${ri}-${di}`;
                          const hasOverride = !!overrideMap[overrideKey];
                          const hasLink = r.matchType === "unmatched" && !!linkMap[r.custId];
                          const effectiveMatch = hasOverride ? "override" : hasLink ? "linked" : r.matchType;
                          const driverDisplayName = hasOverride ? members[overrideMap[overrideKey]]?.displayName
                            : hasLink ? members[linkMap[r.custId]]?.displayName
                            : r.name;
                          return (
                            <div key={di} style={{ display: "flex", gap: 6, alignItems: "center", padding: "3px 6px", borderRadius: 3 }}>
                              <span style={{ fontSize: 11, fontFamily: "monospace", color: r.position <= 3 ? C.elo : C.textDim, fontWeight: 700, minWidth: 24, textAlign: "right" }}>P{r.position}</span>
                              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: (matchColor[effectiveMatch] || C.owned) + "22", color: matchColor[effectiveMatch] || C.owned }}>{matchLabel[effectiveMatch] || "ok"}</span>
                              <span style={{ fontSize: 12, flex: 1 }}>
                                {driverDisplayName}
                                {r.iracingName !== driverDisplayName && <span style={{ fontSize: 10, color: C.textDim, marginLeft: 6 }}>({r.iracingName})</span>}
                              </span>
                              {r.matchType === "unmatched" && !hasLink && !hasOverride && (
                                <select onChange={e => handleLink(r.custId, e.target.value)} value="" style={{ ...inp, padding: "2px 6px", fontSize: 10, width: 130 }}>
                                  <option value="">Link to member...</option>
                                  {memberOptions.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                                </select>
                              )}
                              {hasLink && !hasOverride && <button onClick={() => handleLink(r.custId, "")} style={{ ...mbtn, fontSize: 9, color: C.danger }}>unlink</button>}
                              {r.matchType !== "unmatched" && !hasOverride && (
                                <select onChange={e => { if (e.target.value) setOverrideMap(prev => ({ ...prev, [overrideKey]: e.target.value })); }} value="" style={{ ...inp, padding: "2px 6px", fontSize: 10, width: 110 }}>
                                  <option value="">reassign...</option>
                                  {memberOptions.map(m => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                                </select>
                              )}
                              {hasOverride && <button onClick={() => setOverrideMap(prev => { const next = { ...prev }; delete next[overrideKey]; return next; })} style={{ ...mbtn, fontSize: 9, color: C.danger }}>undo</button>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {error && <div style={{ color: C.danger, fontSize: 12, marginBottom: 8, whiteSpace: "pre-line" }}>{error}</div>}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={onClose} style={{ ...mbtn, color: C.textMuted }}>Cancel</button>
              <button onClick={handleImport} disabled={importing} style={{ ...btnP, opacity: importing ? 0.5 : 1 }}>
                {importing ? "Importing..." : `Import ${totalRaces} Race${totalRaces !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── My Stats ───
function MyStatsView({ currentUid, races, eloRatings, nameByUid }) {
  const [selectedUid, setSelectedUid] = useState(currentUid);

  // All drivers who have at least one race result
  const driversWithRaces = useMemo(() => {
    const seen = new Set();
    for (const r of races) {
      for (const res of r.results || []) seen.add(res.driverKey);
    }
    return [...seen]
      .map(key => ({ key, name: nameByUid[key] || (key.startsWith("ext_") ? key.replace("ext_", "").replace(/-/g, " ") : key) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [races, nameByUid]);

  // If selectedUid has no races (e.g. current user never raced), stay on their uid
  // so they see the empty state — unless they pick someone from the dropdown
  const activeUid = selectedUid;

  const myRaces = useMemo(() => {
    const entries = [];
    for (const r of races) {
      const me = (r.results || []).find(res => res.driverKey === activeUid);
      if (me) {
        entries.push({ date: r.date, trackName: r.trackName, position: me.position, fieldSize: r.results.length, raceClass: r.raceClass, season: r.season });
      }
    }
    return entries.reverse(); // newest first (races already sorted oldest-first)
  }, [races, activeUid]);

  const stats = useMemo(() => {
    if (myRaces.length === 0) return null;
    const positions = myRaces.map(r => r.position);
    return {
      races: myRaces.length,
      wins: positions.filter(p => p === 1).length,
      podiums: positions.filter(p => p <= 3).length,
      avgFinish: (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1),
      bestFinish: Math.min(...positions),
    };
  }, [myRaces]);

  const seasonStats = useMemo(() => {
    const byS = {};
    for (const r of myRaces) {
      const s = r.season || "Unsorted";
      if (!byS[s]) byS[s] = [];
      byS[s].push(r.position);
    }
    return Object.entries(byS).map(([season, positions]) => ({
      season,
      races: positions.length,
      wins: positions.filter(p => p === 1).length,
      podiums: positions.filter(p => p <= 3).length,
      avgFinish: (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1),
      bestFinish: Math.min(...positions),
    }));
  }, [myRaces]);

  const myElo = eloRatings?.ratings?.[activeUid];
  const driverName = nameByUid[activeUid] || "You";

  const picker = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <select value={activeUid} onChange={e => setSelectedUid(e.target.value)} style={{ ...inp, fontSize: 12, padding: "4px 8px", maxWidth: 220 }}>
        <option value={currentUid}>{nameByUid[currentUid] || "You"}{currentUid === activeUid ? "" : ""}</option>
        {driversWithRaces.filter(d => d.key !== currentUid).map(d => (
          <option key={d.key} value={d.key}>{d.name}</option>
        ))}
      </select>
      {activeUid !== currentUid && (
        <button onClick={() => setSelectedUid(currentUid)} style={{ ...mbtn, fontSize: 10, padding: "3px 8px" }}>Back to me</button>
      )}
    </div>
  );

  if (myRaces.length === 0) {
    return (
      <div>
        {picker}
        <Empty icon="📊" title="No Race History" sub={activeUid === currentUid ? "Your finishes will appear here once race results are recorded." : "No races found for this driver."} />
      </div>
    );
  }

  return (
    <div>
      {picker}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Races" value={stats.races} color={C.accent} />
        <StatCard label="Wins" value={stats.wins} color={C.elo} />
        <StatCard label="Podiums" value={stats.podiums} color={C.owned} />
        <StatCard label="Avg Finish" value={stats.avgFinish} color={C.textMuted} />
        <StatCard label="Best Finish" value={`P${stats.bestFinish}`} color={C.owned} />
        {myElo && <StatCard label="ELO" value={Math.round(myElo.elo)} color={myElo.elo >= 1000 ? C.owned : C.danger} />}
      </div>

      {seasonStats.length > 1 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>By Season</div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={thS}>Season</th>
                <th style={{ ...thS, textAlign: "right" }}>Races</th>
                <th style={{ ...thS, textAlign: "right" }}>Wins</th>
                <th style={{ ...thS, textAlign: "right" }}>Podiums</th>
                <th style={{ ...thS, textAlign: "right" }}>Avg</th>
                <th style={{ ...thS, textAlign: "right" }}>Best</th>
              </tr>
            </thead>
            <tbody>
              {seasonStats.map(s => (
                <tr key={s.season}>
                  <td style={{ ...tdS, fontSize: 12 }}>{s.season}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{s.races}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: s.wins > 0 ? C.elo : C.textMuted }}>{s.wins}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: s.podiums > 0 ? C.owned : C.textMuted }}>{s.podiums}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: C.textMuted }}>{s.avgFinish}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12, color: C.owned }}>P{s.bestFinish}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 8 }}>Race History</div>
      <SeasonRaceGroups myRaces={myRaces} />
    </div>
  );
}

function SeasonRaceGroups({ myRaces }) {
  const hasClass = myRaces.some(r => r.raceClass);

  // Group races by season, preserve order (newest first)
  const groups = useMemo(() => {
    const map = new Map();
    for (const r of myRaces) {
      const s = r.season || "Unsorted";
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(r);
    }
    return [...map.entries()].map(([season, races]) => ({ season, races }));
  }, [myRaces]);

  // Most recent season starts expanded, others collapsed
  const [open, setOpen] = useState(() => {
    const s = new Set();
    if (groups.length > 0) s.add(groups[0].season);
    return s;
  });

  const toggle = (season) => setOpen(prev => {
    const next = new Set(prev);
    next.has(season) ? next.delete(season) : next.add(season);
    return next;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {groups.map(g => {
        const expanded = open.has(g.season);
        const positions = g.races.map(r => r.position);
        const wins = positions.filter(p => p === 1).length;
        const avg = (positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1);
        return (
          <div key={g.season} style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
            <button onClick={() => toggle(g.season)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              background: expanded ? C.eloBg : "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit", textAlign: "left",
            }}>
              <span style={{ fontSize: 10, color: C.textDim, width: 14 }}>{expanded ? "\u25BC" : "\u25B6"}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text, flex: 1 }}>{g.season}</span>
              <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>
                {g.races.length}R{wins > 0 && <span style={{ color: C.elo, marginLeft: 6 }}>{wins}W</span>}
                <span style={{ marginLeft: 6 }}>avg P{avg}</span>
              </span>
            </button>
            {expanded && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thS}>Date</th>
                    <th style={thS}>Track</th>
                    <th style={{ ...thS, textAlign: "center" }}>Finish</th>
                    {hasClass && <th style={thS}>Class</th>}
                  </tr>
                </thead>
                <tbody>
                  {g.races.map((r, i) => {
                    const posColor = r.position === 1 ? C.elo : r.position <= 3 ? C.owned : C.text;
                    const cc = r.raceClass ? classColor(r.raceClass) : null;
                    return (
                      <tr key={i}>
                        <td style={{ ...tdS, fontFamily: "monospace", fontSize: 12, color: C.textMuted }}>{displayDate(r.date)}</td>
                        <td style={{ ...tdS, fontSize: 13 }}>{r.trackName}</td>
                        <td style={{ ...tdS, textAlign: "center", fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: posColor }}>
                          P{r.position}<span style={{ fontWeight: 400, fontSize: 11, color: C.textDim }}> / {r.fieldSize}</span>
                        </td>
                        {hasClass && (
                          <td style={tdS}>
                            {cc && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, fontWeight: 600, background: cc.bg, color: cc.fg }}>{r.raceClass}</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings ───
function SettingsView({ eloRatings, handleCalculate, raceCount }) {
  const [kFactor, setKFactor] = useState(eloRatings?.kFactor || 32);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState("");

  const doCalculate = async () => {
    setCalculating(true);
    setResult("");
    try {
      await handleCalculate(kFactor);
      setResult("ELO calculated successfully.");
    } catch (e) {
      setResult("Error: " + e.message);
    }
    setCalculating(false);
  };

  return (
    <div style={{ maxWidth: 400 }}>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>K-Factor</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="range" min={10} max={64} value={kFactor} onChange={e => setKFactor(Number(e.target.value))} style={{ flex: 1 }} />
          <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: C.elo, minWidth: 30, textAlign: "right" }}>{kFactor}</span>
        </div>
        <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>Lower = more stable ratings. Higher = faster movement. Default: 32</div>
      </div>

      <button onClick={doCalculate} disabled={calculating || raceCount === 0} style={{ ...btnP, opacity: calculating || raceCount === 0 ? 0.5 : 1, marginBottom: 12 }}>
        {calculating ? "Calculating..." : `Calculate ELO (${raceCount} races)`}
      </button>

      {result && <div style={{ fontSize: 12, color: result.startsWith("Error") ? C.danger : C.owned, fontFamily: "monospace" }}>{result}</div>}

      {eloRatings?.lastCalculatedAt && (
        <div style={{ marginTop: 16, fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>
          Last calculated: {new Date(eloRatings.lastCalculatedAt).toLocaleString()} · K={eloRatings.kFactor}
        </div>
      )}
    </div>
  );
}
