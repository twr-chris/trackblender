import { useState } from "react";
import { setConfig, setMember, deleteMember } from "../firebase.js";
import { C, inp, btnP, mbtn } from "../lib/shared.js";

export function LeagueAdmin({ config, members, nameByUid }) {
  const [newAdmin, setNewAdmin] = useState("");
  const adminUids = config?.adminUids || [];

  const addAdmin = async () => {
    const uid = Object.entries(nameByUid).find(([u, n]) => n.toLowerCase() === newAdmin.trim().toLowerCase())?.[0];
    if (!uid || adminUids.includes(uid)) return;
    await setConfig({ adminUids: [...adminUids, uid] });
    setNewAdmin("");
  };

  const removeAdmin = async (uid) => {
    if (adminUids.length <= 1) return;
    if (!confirm(`Remove admin: ${nameByUid[uid]}?`)) return;
    await setConfig({ adminUids: adminUids.filter(u => u !== uid) });
  };

  const removeMemberFn = async (uid) => {
    if (adminUids.includes(uid)) { alert("Remove admin status first"); return; }
    if (!confirm(`Remove member ${members[uid]?.displayName}? Their data will be deleted.`)) return;
    await deleteMember(uid);
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: C.admin }}>League Administration</h3>
      <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>{config?.name}</p>

      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Admins</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {adminUids.map(uid => (
          <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.adminBg, borderRadius: 6, border: `1px solid rgba(167,139,250,0.2)` }}>
            <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>
            <span style={{ flex: 1, fontSize: 13 }}>{nameByUid[uid] || uid}</span>
            {adminUids.length > 1 && <button onClick={() => removeAdmin(uid)} style={{ ...mbtn, color: C.danger }}>remove admin</button>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 30 }}>
        <input value={newAdmin} onChange={e => setNewAdmin(e.target.value)} onKeyDown={e => e.key === "Enter" && addAdmin()}
          placeholder="Member name to make admin..." style={{ ...inp, flex: 1 }} />
        <button onClick={addAdmin} style={btnP}>+ Add Admin</button>
      </div>

      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Members ({Object.keys(members).length})</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(members).map(([uid, m]) => {
          const isRacing = m.racing !== false;
          return (
          <div key={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: isRacing ? C.surface : "rgba(255,255,255,0.02)", borderRadius: 6, border: `1px solid ${C.border}`, opacity: isRacing ? 1 : 0.6 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{m.displayName}</div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email || "no email"} · {uid.slice(0, 8)}…</div>
            </div>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", whiteSpace: "nowrap" }}>{Object.values(m.ownership || {}).filter(v => v === "owned").length} tracks</span>
            <button onClick={async () => { await setMember(uid, { racing: !isRacing }); }} style={{ padding: "3px 8px", fontSize: 9, fontWeight: 700, fontFamily: "monospace", borderRadius: 3, cursor: "pointer", border: `1px solid ${isRacing ? C.owned : C.textDim}`, background: isRacing ? C.ownedBg : "transparent", color: isRacing ? C.owned : C.textDim }}>{isRacing ? "RACING" : "NOT RACING"}</button>
            {adminUids.includes(uid) && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>}
            {!adminUids.includes(uid) && <button onClick={() => removeMemberFn(uid)} style={{ ...mbtn, color: C.danger }}>remove</button>}
          </div>
          );
        })}
      </div>
    </div>
  );
}
