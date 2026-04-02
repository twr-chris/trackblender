// Colors, categories, and shared style objects

export const ALL_CATS = ["road", "oval", "dirt-oval", "dirt-road"];

export const CAT_LABELS = {
  all: "All", road: "Road", oval: "Oval",
  "dirt-oval": "Dirt Oval", "dirt-road": "Dirt Road",
};

export const C = {
  bg: "#0c0e13", surface: "#14171e", border: "#252a35",
  text: "#e8eaf0", textMuted: "#7a8299", textDim: "#4a5168",
  accent: "#e85d2c", accentGlow: "rgba(232, 93, 44, 0.15)",
  owned: "#22c55e", ownedBg: "rgba(34, 197, 94, 0.1)",
  buy: "#f59e0b", buyBg: "rgba(245, 158, 11, 0.1)",
  danger: "#ef4444", dangerBg: "rgba(239, 68, 68, 0.1)",
  admin: "#a78bfa", adminBg: "rgba(167, 139, 250, 0.1)",
  free: "#38bdf8", freeBg: "rgba(56, 189, 248, 0.1)",
  elo: "#fbbf24", eloBg: "rgba(251, 191, 36, 0.1)",
};

export const CAT_COLORS = {
  road: { fg: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  oval: { fg: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  "dirt-oval": { fg: "#a78bfa", bg: "rgba(168,85,247,0.12)" },
  "dirt-road": { fg: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

export const matchCat = (t, f) => f === "all" || (t.cats || []).includes(f);

// Shared inline style objects
export const pill = (on) => ({
  padding: "5px 12px", fontSize: 11, fontWeight: on ? 600 : 400,
  background: on ? C.accentGlow : C.surface, color: on ? C.accent : C.textMuted,
  border: `1px solid ${on ? C.accent : C.border}`, borderRadius: 5,
  cursor: "pointer", fontFamily: "inherit",
});

export const inp = {
  padding: "8px 14px", background: C.surface, border: `1px solid ${C.border}`,
  borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none",
};

export const btnP = {
  padding: "8px 16px", background: C.accent, color: "#fff", border: "none",
  borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

export const thS = {
  padding: "10px 8px", borderBottom: `1px solid ${C.border}`,
  fontSize: 11, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap",
};

export const tdS = {
  padding: "7px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
};

export const mbtn = {
  background: "none", border: "none", color: C.textMuted,
  cursor: "pointer", fontSize: 12, padding: "2px 4px", fontFamily: "inherit",
};
