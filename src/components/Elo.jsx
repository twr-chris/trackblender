import { useState, useMemo, useCallback } from "react";
import { C, inp, btnP, mbtn, thS, tdS } from "../lib/shared.js";
import { StatCard, Empty } from "./shared.jsx";
import { calculateElo } from "../lib/elo.js";

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Elo({ races, eloRatings, members, nameByUid, isAdmin, addRace, setRace, deleteRace, setEloRatings, persist, trackNames }) {
  const [view, setView] = useState("standings"); // standings | races | settings
  const [expandedRace, setExpandedRace] = useState(null);
  const [seasonFilter, setSeasonFilter] = useState("all");
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
    Object.entries(races).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.raceNumber || 1) - (b.raceNumber || 1)),
    [races]
  );

  // Unique seasons
  const seasons = useMemo(() => {
    const s = new Set(raceList.map(r => r.season).filter(Boolean));
    return [...s].sort();
  }, [raceList]);

  const filteredRaces = seasonFilter === "all" ? raceList : raceList.filter(r => r.season === seasonFilter);

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
      .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const ratings = calculateElo(sorted, kFactor);
    await setEloRatings({ ratings, kFactor, lastCalculatedAt: new Date().toISOString() });
  };

  const subTabs = [
    { id: "standings", label: "Standings" },
    { id: "races", label: "Race Results" },
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
      {view === "races" && <RacesView races={filteredRaces} seasons={seasons} seasonFilter={seasonFilter} setSeasonFilter={setSeasonFilter} expandedRace={expandedRace} setExpandedRace={setExpandedRace} isAdmin={isAdmin} showAddForm={showAddForm} setShowAddForm={setShowAddForm} members={members} knownNames={knownNames} resolveDriver={resolveDriver} addRace={addRace} deleteRace={deleteRace} setRace={setRace} nameByUid={nameByUid} eloRatings={eloRatings} trackNames={trackNames} />}
      {view === "settings" && isAdmin && <SettingsView eloRatings={eloRatings} handleCalculate={handleCalculate} raceCount={raceList.length} />}
    </div>
  );
}

// ─── Standings ───
function StandingsView({ standings, eloRatings, raceCount, isAdmin, members, races, setRace, nameByUid }) {
  const driverCount = standings.length;
  const highest = standings.length > 0 ? standings[0] : null;

  if (!eloRatings?.ratings || standings.length === 0) {
    return <Empty icon="🏆" title="No ELO Ratings Yet" sub="Add race results and calculate ELO from the Settings tab." />;
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Races" value={raceCount} color={C.elo} />
        <StatCard label="Drivers Rated" value={driverCount} color={C.accent} />
        <StatCard label="Highest ELO" value={highest ? `${highest.elo}` : "-"} color={C.owned} />
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
          {standings.map((s, i) => (
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
function RacesView({ races, seasons, seasonFilter, setSeasonFilter, expandedRace, setExpandedRace, isAdmin, showAddForm, setShowAddForm, members, knownNames, resolveDriver, addRace, deleteRace, setRace, nameByUid, eloRatings, trackNames }) {

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
        {isAdmin && <button onClick={() => setShowAddForm(!showAddForm)} style={btnP}>{showAddForm ? "Cancel" : "+ Add Race"}</button>}
        <span style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace" }}>{races.length} race{races.length !== 1 ? "s" : ""}</span>
      </div>

      {showAddForm && isAdmin && <AddRaceForm members={members} knownNames={knownNames} resolveDriver={resolveDriver} addRace={addRace} onDone={() => setShowAddForm(false)} eloRatings={eloRatings} trackNames={trackNames} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {races.map(r => (
          <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
            <div onClick={() => setExpandedRace(expandedRace === r.id ? null : r.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: C.textMuted, minWidth: 80 }}>{r.date || "no date"}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim, minWidth: 20 }}>R{r.raceNumber || 1}</span>
              <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{r.trackName || "Race"}</span>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: C.eloBg, color: C.elo }}>{r.season}</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>{(r.results || []).length} drivers</span>
              <span style={{ color: C.textDim }}>{expandedRace === r.id ? "▲" : "▼"}</span>
            </div>
            {expandedRace === r.id && <RaceDetail race={r} isAdmin={isAdmin} setRace={setRace} deleteRace={deleteRace} setExpandedRace={setExpandedRace} nameByUid={nameByUid} trackNames={trackNames} />}
          </div>
        ))}
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

  const handleSave = async () => {
    await setRace(race.id, { date: editDate, raceNumber: editRaceNum, trackName: editTrack.trim() || null, season: editSeason.trim() });
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
    await addRace({ date, raceNumber, trackName: trackName.trim() || null, season: season.trim(), results });
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
