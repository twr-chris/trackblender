import { useState, useCallback, useMemo } from "react";
import { C, inp, btnP } from "../lib/shared.js";
import { Empty } from "./shared.jsx";
import { solvePurchases } from "../lib/solver.js";

export function BuyRecs({ data, save, names, map }) {
  const [maxBuys, setMaxBuys] = useState(2);
  const [forcedTracks, setForcedTracks] = useState([]);
  const [forceSearch, setForceSearch] = useState("");
  const [forceDropOpen, setForceDropOpen] = useState(false);
  const [excludedTracks, setExcludedTracks] = useState([]);
  const [excludeSearch, setExcludeSearch] = useState("");
  const [excludeDropOpen, setExcludeDropOpen] = useState(false);
  const [solverResult, setSolverResult] = useState(null);
  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);
  const paidNames = useMemo(() => names.filter(t => !map[t]?.free), [names, map]);

  const forceCandidates = useMemo(() => {
    return paidNames.filter(t => {
      const owned = data.racingMembers.filter(m => getS(m, t) === "owned").length;
      return owned < data.racingMembers.length && !forcedTracks.includes(t) && !excludedTracks.includes(t);
    });
  }, [paidNames, data.racingMembers, getS, forcedTracks, excludedTracks]);

  const filteredForceCandidates = useMemo(() => {
    if (!forceSearch) return forceCandidates.slice(0, 20);
    const q = forceSearch.toLowerCase();
    return forceCandidates.filter(t => t.toLowerCase().includes(q)).slice(0, 20);
  }, [forceCandidates, forceSearch]);

  const excludeCandidates = useMemo(() => {
    return paidNames.filter(t => {
      const owned = data.racingMembers.filter(m => getS(m, t) === "owned").length;
      return owned < data.racingMembers.length && !excludedTracks.includes(t) && !forcedTracks.includes(t);
    });
  }, [paidNames, data.racingMembers, getS, excludedTracks, forcedTracks]);

  const filteredExcludeCandidates = useMemo(() => {
    if (!excludeSearch) return excludeCandidates.slice(0, 20);
    const q = excludeSearch.toLowerCase();
    return excludeCandidates.filter(t => t.toLowerCase().includes(q)).slice(0, 20);
  }, [excludeCandidates, excludeSearch]);

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
    const result = solvePurchases(data.racingMembers, data.ownership, paidNames, maxBuys, forcedTracks, excludedTracks);
    setSolverResult(result);
    const newOwnership = { ...data.ownership };
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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
            Max buys per member:
            <input type="range" min={1} max={10} value={maxBuys} onChange={e => setMaxBuys(+e.target.value)} style={{ width: 120 }} />
            <span style={{ fontFamily: "monospace", color: C.accent, fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: "center" }}>{maxBuys}</span>
          </label>
        </div>

        {/* Force tracks */}
        <div style={{ marginBottom: solverResult ? 20 : 0 }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Force tracks into season (buys count against limit):</div>
          {forcedTracks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {forcedTracks.map(t => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: C.accentGlow, border: `1px solid ${C.accent}`, borderRadius: 4, fontSize: 11, color: C.accent }}>
                  {t}
                  <button onClick={() => setForcedTracks(prev => prev.filter(x => x !== t))} style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: "relative" }}>
            <input value={forceSearch} onChange={e => { setForceSearch(e.target.value); setForceDropOpen(true); }}
              onFocus={() => setForceDropOpen(true)}
              onBlur={() => setTimeout(() => setForceDropOpen(false), 200)}
              placeholder="Search tracks to force..."
              style={{ ...inp, width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 12px" }} />
            {forceDropOpen && forceSearch && filteredForceCandidates.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 2, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                {filteredForceCandidates.map(t => {
                  const owned = data.racingMembers.filter(m => getS(m, t) === "owned").length;
                  return (
                    <div key={t} onClick={() => { setForcedTracks(prev => [...prev, t]); setForceSearch(""); setForceDropOpen(false); }}
                      style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surface}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span>{t}</span>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim }}>{owned}/{data.racingMembers.length}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Exclude tracks */}
        <div style={{ marginBottom: solverResult ? 20 : 0 }}>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Exclude tracks from consideration:</div>
          {excludedTracks.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {excludedTracks.map(t => (
                <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: C.dangerBg, border: `1px solid ${C.danger}`, borderRadius: 4, fontSize: 11, color: C.danger }}>
                  {t}
                  <button onClick={() => setExcludedTracks(prev => prev.filter(x => x !== t))} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ position: "relative" }}>
            <input value={excludeSearch} onChange={e => { setExcludeSearch(e.target.value); setExcludeDropOpen(true); }}
              onFocus={() => setExcludeDropOpen(true)}
              onBlur={() => setTimeout(() => setExcludeDropOpen(false), 200)}
              placeholder="Search tracks to exclude..."
              style={{ ...inp, width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 12px" }} />
            {excludeDropOpen && excludeSearch && filteredExcludeCandidates.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, marginTop: 2, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                {filteredExcludeCandidates.map(t => {
                  const owned = data.racingMembers.filter(m => getS(m, t) === "owned").length;
                  return (
                    <div key={t} onClick={() => { setExcludedTracks(prev => [...prev, t]); setExcludeSearch(""); setExcludeDropOpen(false); }}
                      style={{ padding: "6px 12px", fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surface}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <span>{t}</span>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim }}>{owned}/{data.racingMembers.length}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {solverResult && (
          <div>
            {solverResult.conflicts && solverResult.conflicts.length > 0 && (
              <div style={{ marginBottom: 16, padding: 10, background: C.dangerBg, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.danger, marginBottom: 4 }}>Budget conflicts on forced tracks</div>
                {solverResult.conflicts.map(c => (
                  <div key={c.track} style={{ fontSize: 11, color: C.danger }}>
                    {c.track}: {c.members.join(", ")} exceeded buy limit
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ padding: "10px 16px", background: C.ownedBg, borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.owned }}>{solverResult.promotedTracks.length}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>tracks → universal</div>
              </div>
              <div style={{ padding: "10px 16px", background: C.buyBg, borderRadius: 6, border: "1px solid rgba(245,158,11,0.2)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.buy }}>{solverResult.assignments.length}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>total purchases</div>
              </div>
              {forcedTracks.length > 0 && (
                <div style={{ padding: "10px 16px", background: C.accentGlow, borderRadius: 6, border: `1px solid ${C.accent}33` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.accent }}>{forcedTracks.length}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>forced</div>
                </div>
              )}
              {excludedTracks.length > 0 && (
                <div style={{ padding: "10px 16px", background: C.dangerBg, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.danger }}>{excludedTracks.length}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>excluded</div>
                </div>
              )}
            </div>
            {solverResult.promotedTracks.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Newly Universal</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {solverResult.promotedTracks.map(t => <span key={t} style={{ padding: "5px 10px", background: forcedTracks.includes(t) ? C.accentGlow : C.ownedBg, border: `1px solid ${forcedTracks.includes(t) ? C.accent + "44" : "rgba(34,197,94,0.2)"}`, borderRadius: 5, fontSize: 11, color: forcedTracks.includes(t) ? C.accent : C.owned, fontWeight: 500 }}>{t}{forcedTracks.includes(t) ? " ★" : ""}</span>)}
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
