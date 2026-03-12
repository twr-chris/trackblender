import { C, CAT_COLORS } from "../lib/shared.js";

export function CatTags({ cats, size }) {
  const s = size === "md" ? { fontSize: 10, padding: "2px 8px" } : { fontSize: 9, padding: "1px 5px" };
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {(cats || []).map(c => (
        <span key={c} style={{ ...s, borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: CAT_COLORS[c]?.bg, color: CAT_COLORS[c]?.fg }}>{c}</span>
      ))}
    </span>
  );
}

export function CfgBadge({ n }) {
  if (n == null) return null;
  return <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 600, fontFamily: "monospace", background: "rgba(255,255,255,0.05)", color: C.textMuted }}>{n}cfg</span>;
}

export function FreeBadge({ on }) {
  if (!on) return null;
  return <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.freeBg, color: C.free }}>FREE</span>;
}

export function Badges({ t }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
      <CatTags cats={t?.cats} />
      <CfgBadge n={t?.configs} />
      <FreeBadge on={t?.free} />
    </span>
  );
}

export function StatCard({ label, value, color }) {
  return (
    <div style={{ background: C.surface, borderRadius: 8, border: `1px solid ${C.border}`, padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: color || C.text }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", padding: 60, color: C.textMuted }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: C.text }}>{title}</div>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  );
}
