import { useState } from "react";
import { C, inp, btnP, mbtn } from "../lib/shared.js";
import { parseIracingPaste } from "../lib/parser.js";

export function ImportModal({ names, map, currentUser, isAdmin, data, save, onClose }) {
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState(null);
  const [targetMember, setTargetMember] = useState(currentUser);

  const doParse = () => {
    if (!pasteText.trim()) return;
    setResult(parseIracingPaste(pasteText, names));
  };

  const doImport = () => {
    if (!result || !targetMember) return;
    const newOwnership = {};
    for (const trackName of names) newOwnership[trackName] = "unowned";
    for (const { db } of result.matched) {
      if (db in newOwnership) newOwnership[db] = "owned";
    }
    save({ ...data, ownership: { ...data.ownership, [targetMember]: newOwnership } });
    onClose();
  };

  const members = isAdmin ? data.members : [currentUser];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: C.bg, borderRadius: 12, border: `1px solid ${C.border}`, padding: 24, maxWidth: 600, width: "90%", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Import from iRacing</h3>
          <button onClick={onClose} style={{ ...mbtn, fontSize: 18 }}>✕</button>
        </div>

        {!result ? (
          <>
            <div style={{ background: C.surface, borderRadius: 8, padding: 16, marginBottom: 16, border: `1px solid ${C.border}` }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Instructions</h4>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
                1. Open the <strong style={{ color: C.text }}>iRacing client</strong> (not the website)<br />
                2. Click <strong style={{ color: C.text }}>My Content</strong> in the left sidebar<br />
                3. Click the <strong style={{ color: C.text }}>My Licensed Tracks</strong> tab<br />
                4. Switch to <strong style={{ color: C.text }}>List View</strong> (not Grid View)<br />
                5. Press <strong style={{ color: C.text }}>Ctrl+A</strong> to select all, then <strong style={{ color: C.text }}>Ctrl+C</strong> to copy<br />
                6. Paste below
              </div>
            </div>

            {isAdmin && members.length > 1 && (
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>Import for:</span>
                <select value={targetMember} onChange={e => setTargetMember(e.target.value)}
                  style={{ padding: "6px 10px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 12, fontFamily: "inherit" }}>
                  {members.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}

            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)}
              placeholder="Paste iRacing track list here..."
              style={{ width: "100%", minHeight: 200, padding: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, fontFamily: "monospace", resize: "vertical", outline: "none", boxSizing: "border-box" }} />

            <div style={{ marginTop: 12, padding: 10, background: C.dangerBg, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", fontSize: 11, color: C.danger }}>
              ⚠ This will reset {targetMember === currentUser ? "your" : targetMember + "'s"} track ownership to only include tracks found in the paste. Tracks not in the paste will be set to unowned.
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={{ ...mbtn, padding: "8px 16px", fontSize: 13 }}>Cancel</button>
              <button onClick={doParse} disabled={!pasteText.trim()} style={{ ...btnP, opacity: pasteText.trim() ? 1 : 0.4 }}>Parse</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: "10px 16px", background: C.ownedBg, borderRadius: 6, border: "1px solid rgba(34,197,94,0.2)" }}>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.owned }}>{result.matched.length}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>tracks matched</div>
              </div>
              {result.unmatched.length > 0 && (
                <div style={{ padding: "10px 16px", background: C.dangerBg, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "monospace", color: C.danger }}>{result.unmatched.length}</div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>unmatched</div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>Matched Tracks</h4>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 4 }}>
                {result.matched.map((m, i) => (
                  <span key={i} style={{ padding: "3px 8px", background: C.ownedBg, border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4, fontSize: 10, color: C.owned }}>
                    {m.db} {m.configs != null && <span style={{ color: C.textDim }}>({m.configs}cfg)</span>}
                  </span>
                ))}
              </div>
            </div>

            {result.unmatched.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: C.danger, marginBottom: 6 }}>Unmatched (will be ignored)</h4>
                <div style={{ maxHeight: 100, overflowY: "auto", display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {result.unmatched.map((u, i) => (
                    <span key={i} style={{ padding: "3px 8px", background: C.dangerBg, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, fontSize: 10, color: C.danger }}>
                      {u.raw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, padding: 10, background: C.dangerBg, borderRadius: 6, border: "1px solid rgba(239,68,68,0.2)", fontSize: 11, color: C.danger }}>
              ⚠ Importing will set {result.matched.length} tracks to "owned" for {targetMember === currentUser ? "you" : targetMember}. All other tracks will be set to "unowned".
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setResult(null)} style={{ ...mbtn, padding: "8px 16px", fontSize: 13 }}>Back</button>
              <button onClick={onClose} style={{ ...mbtn, padding: "8px 16px", fontSize: 13 }}>Cancel</button>
              <button onClick={doImport} style={btnP}>Import {result.matched.length} Tracks</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
