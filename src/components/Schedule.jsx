import { useState, useCallback, useMemo } from "react";
import { C, CAT_LABELS, matchCat, pill, mbtn } from "../lib/shared.js";
import { Badges, CatTags, CfgBadge, FreeBadge } from "./shared.jsx";

export function Schedule({ data, save, names, map, isAdmin }) {
  const [minOwn, setMinOwn] = useState(Math.max(1, data.racingMembers.length));
  const [catF, setCatF] = useState("all");
  const [hideFree, setHideFree] = useState(true);
  const getS = useCallback((m, t) => (data.ownership[m] || {})[t] || "unowned", [data.ownership]);
  const effOwn = useCallback((t) => map[t]?.free ? data.racingMembers.length : data.racingMembers.filter(m => { const s = getS(m, t); return s === "owned" || s === "buy"; }).length, [map, data.racingMembers, getS]);
  const buyN = useCallback((t) => map[t]?.free ? 0 : data.racingMembers.filter(m => getS(m, t) === "buy").length, [map, data.racingMembers, getS]);

  const eligible = useMemo(() => {
    return names.filter(t => map[t] && matchCat(map[t], catF))
      .filter(t => !hideFree || !map[t]?.free)
      .map(t => ({ name: t, owners: effOwn(t), buyers: buyN(t), track: map[t] }))
      .filter(t => t.owners >= minOwn)
      .sort((a, b) => b.owners - a.owners || (b.owners + b.buyers) - (a.owners + a.buyers));
  }, [data, minOwn, catF, hideFree, names, map, effOwn, buyN]);

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
            {data.racingMembers.map(m => {
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
        <div style={{ display: "flex", gap: 4, marginBottom: 10, alignItems: "center" }}>
          {Object.entries(CAT_LABELS).map(([k, v]) => <button key={k} onClick={() => setCatF(k)} style={{ ...pill(catF === k), fontSize: 10, padding: "4px 10px" }}>{v}</button>)}
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.free, cursor: "pointer", marginLeft: 8 }}>
            <input type="checkbox" checked={hideFree} onChange={e => setHideFree(e.target.checked)} /> Hide free
          </label>
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
