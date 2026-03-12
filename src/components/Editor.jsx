import { useState, useMemo } from "react";
import { C, ALL_CATS, CAT_COLORS, inp, btnP, mbtn } from "../lib/shared.js";
import { Badges } from "./shared.jsx";
import DEFAULT_TRACKS from "../tracks.js";

export function Editor({ tracks, save }) {
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
