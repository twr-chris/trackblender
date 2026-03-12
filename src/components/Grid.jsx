import { useState, useCallback, useMemo } from "react";
import { C, CAT_LABELS, matchCat, pill, inp, thS, tdS, mbtn } from "../lib/shared.js";
import { Badges, Empty } from "./shared.jsx";
import { ImportModal } from "./ImportModal.jsx";

export function Grid({ data, save, names, map, currentUser, isAdmin }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [hideFree, setHideFree] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);

  const sortedMembers = useMemo(() => {
    const others = data.members.filter(m => m !== currentUser).sort();
    return currentUser && data.members.includes(currentUser) ? [currentUser, ...others] : others;
  }, [data.members, currentUser]);

  const filtered = useMemo(() => {
    let t = names;
    if (filter !== "all") t = t.filter(n => map[n] && matchCat(map[n], filter));
    if (search) { const q = search.toLowerCase(); t = t.filter(n => n.toLowerCase().includes(q)); }
    if (hideEmpty && data.members.length > 0) t = t.filter(n => data.members.some(m => getS(m, n) !== "unowned") || map[n]?.free);
    if (hideFree) t = t.filter(n => !map[n]?.free);
    return t;
  }, [filter, search, hideEmpty, hideFree, data.members, getS, names, map]);

  const toggle = (m, t) => {
    if (m !== currentUser && !isAdmin) return;
    const cur = getS(m, t);
    const next = (cur === "unowned" || cur === "buy") ? "owned" : "unowned";
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
        <span style={{ fontSize: 11, color: C.textDim, fontFamily: "monospace" }}>{isAdmin ? "admin: edit any row" : "click your column to toggle"}</span>
        <button onClick={() => setShowImport(true)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: C.accentGlow, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>Import from iRacing</button>
        {hasBuys && isAdmin && <button onClick={clearBuys} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 600, background: C.buyBg, color: C.buy, border: `1px solid ${C.buy}`, borderRadius: 5, cursor: "pointer", fontFamily: "inherit" }}>Clear All Buys</button>}
      </div>
      {showImport && <ImportModal names={names} map={map} currentUser={currentUser} isAdmin={isAdmin} data={data} save={save} onClose={() => setShowImport(false)} />}
      {data.members.length === 0 ? <Empty icon="🏁" title="No members yet" sub="Invite people to join your league" /> : (
        <div style={{ overflow: "auto", borderRadius: 8, border: `1px solid ${C.border}`, maxHeight: "calc(100vh - 220px)" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 20 }}><tr style={{ background: C.surface }}>
              <th style={{ ...thS, minWidth: 280, textAlign: "left", position: "sticky", left: 0, background: C.surface, zIndex: 30 }}>Track</th>
              <th style={{ ...thS, width: 30, color: C.textDim, fontSize: 10, background: C.surface }}>#</th>
              {sortedMembers.map(m => {
                const isRacing = data.racing[m] !== false;
                return <th key={m} style={{ ...thS, minWidth: 70, color: m === currentUser ? C.accent : isRacing ? C.textMuted : C.textDim, opacity: isRacing ? 1 : 0.5, background: C.surface }}>
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
                    {sortedMembers.map(m => {
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
