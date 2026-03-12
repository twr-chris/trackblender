import { useCallback, useMemo } from "react";
import { C } from "../lib/shared.js";
import { StatCard, Empty } from "./shared.jsx";

export function Stats({ data, names, map }) {
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
