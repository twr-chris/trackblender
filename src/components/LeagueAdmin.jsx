import { useState } from "react";
import { setConfig, setMember, deleteMember } from "../firebase.js";
import { C, inp, btnP, mbtn, pill } from "../lib/shared.js";

function AliasEditor({ uid, aliases }) {
  const [newAlias, setNewAlias] = useState("");
  const currentAliases = aliases || [];

  const addAlias = async () => {
    const trimmed = newAlias.trim();
    if (!trimmed || currentAliases.includes(trimmed)) return;
    await setMember(uid, { aliases: [...currentAliases, trimmed] });
    setNewAlias("");
  };

  const removeAlias = async (alias) => {
    await setMember(uid, { aliases: currentAliases.filter(a => a !== alias) });
  };

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6, paddingLeft: 8 }}>
      <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>aliases:</span>
      {currentAliases.map(a => (
        <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 8px", borderRadius: 4, background: C.eloBg, color: C.elo, fontFamily: "monospace" }}>
          {a}
          <button onClick={() => removeAlias(a)} style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", padding: 0, fontSize: 10, fontFamily: "monospace" }}>x</button>
        </span>
      ))}
      <input value={newAlias} onChange={e => setNewAlias(e.target.value)} onKeyDown={e => e.key === "Enter" && addAlias()}
        placeholder="+ alias" style={{ ...inp, padding: "2px 8px", fontSize: 10, width: 90 }} />
    </div>
  );
}

function CustIdEditor({ uid, custId }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(custId || "");

  const save = async () => {
    const trimmed = value.trim();
    await setMember(uid, { iracingCustId: trimmed || null });
    setEditing(false);
  };

  if (!editing) {
    return (
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6, paddingLeft: 8 }}>
        <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>iRacing:</span>
        {custId
          ? <span style={{ fontSize: 10, fontFamily: "monospace", color: C.free }}>{custId}</span>
          : <span style={{ fontSize: 10, fontFamily: "monospace", color: C.textDim }}>—</span>}
        <button onClick={() => { setValue(custId || ""); setEditing(true); }} style={{ ...mbtn, fontSize: 9, color: C.elo }}>edit</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6, paddingLeft: 8 }}>
      <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace" }}>iRacing:</span>
      <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === "Enter" && save()}
        placeholder="Customer ID" style={{ ...inp, padding: "2px 8px", fontSize: 10, width: 80 }} />
      <button onClick={save} style={{ ...mbtn, fontSize: 9, color: C.owned }}>save</button>
      <button onClick={() => setEditing(false)} style={{ ...mbtn, fontSize: 9, color: C.textMuted }}>x</button>
    </div>
  );
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function LeagueAdmin({ config, members, nameByUid }) {
  const [newAdmin, setNewAdmin] = useState("");
  const [memberSort, setMemberSort] = useState("joined"); // "joined" | "name"
  const [newVirtualName, setNewVirtualName] = useState("");
  const adminUids = config?.adminUids || [];

  const addVirtualMember = async () => {
    const name = newVirtualName.trim();
    if (!name) return;
    const uid = "virtual_" + slugify(name);
    if (members[uid]) { alert("A virtual member with this name already exists."); return; }
    await setMember(uid, {
      displayName: name,
      virtual: true,
      racing: true,
      ownership: {},
      joinedAt: new Date().toISOString(),
    });
    setNewVirtualName("");
  };

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

      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>League Logo</h4>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 30 }}>
        {config?.logoUrl
          ? <img src={config.logoUrl} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" }} alt="" />
          : <div style={{ width: 48, height: 48, background: `linear-gradient(135deg, ${C.accent}, #f59e0b)`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff" }}>T</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <input type="file" accept="image/*" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            // Resize to 128x128 and encode as data URL
            const img = new Image();
            img.onload = async () => {
              const size = 128;
              const canvas = document.createElement("canvas");
              canvas.width = size; canvas.height = size;
              const ctx = canvas.getContext("2d");
              // Cover-crop: scale to fill, center
              const scale = Math.max(size / img.width, size / img.height);
              const w = img.width * scale, h = img.height * scale;
              ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
              const dataUrl = canvas.toDataURL("image/png");
              await setConfig({ logoUrl: dataUrl });
            };
            img.src = URL.createObjectURL(file);
          }} style={{ fontSize: 11, color: C.text }} />
          {config?.logoUrl && <button onClick={() => setConfig({ logoUrl: null })} style={{ ...mbtn, color: C.danger, fontSize: 10 }}>Remove logo</button>}
        </div>
      </div>

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

      <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Virtual Members</h4>
      <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>For local/pod drivers who don't have their own iRacing account. They appear in the driver table and carry ELO but can't log in.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 30 }}>
        <input value={newVirtualName} onChange={e => setNewVirtualName(e.target.value)} onKeyDown={e => e.key === "Enter" && addVirtualMember()}
          placeholder="Driver name..." style={{ ...inp, flex: 1 }} />
        <button onClick={addVirtualMember} style={btnP}>+ Add Virtual Member</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Members ({Object.keys(members).length})</h4>
        <button onClick={() => setMemberSort(memberSort === "joined" ? "name" : "joined")} style={{ ...mbtn, fontSize: 10, color: C.elo }}>
          sort: {memberSort === "joined" ? "join date" : "A-Z"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {Object.entries(members)
          .sort((a, b) => memberSort === "name"
            ? (a[1].displayName || "").localeCompare(b[1].displayName || "")
            : (a[1].joinedAt || "").localeCompare(b[1].joinedAt || ""))
          .map(([uid, m]) => {
          const isRacing = m.racing !== false;
          const isVirtual = !!m.virtual;
          return (
          <div key={uid} style={{ padding: "8px 12px", background: isRacing ? C.surface : "rgba(255,255,255,0.02)", borderRadius: 6, border: `1px solid ${isVirtual ? "rgba(56,189,248,0.2)" : C.border}`, opacity: isRacing ? 1 : 0.6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.displayName}</span>
                  {isVirtual && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.freeBg, color: C.free }}>VIRTUAL</span>}
                </div>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isVirtual ? "pod driver" : (m.email || "no email")} · {uid.slice(0, 8)}…</div>
              </div>
              <span style={{ fontSize: 10, color: C.textDim, fontFamily: "monospace", whiteSpace: "nowrap" }}>{Object.values(m.ownership || {}).filter(v => v === "owned").length} tracks</span>
              <button onClick={async () => { await setMember(uid, { racing: !isRacing }); }} style={{ padding: "3px 8px", fontSize: 9, fontWeight: 700, fontFamily: "monospace", borderRadius: 3, cursor: "pointer", border: `1px solid ${isRacing ? C.owned : C.textDim}`, background: isRacing ? C.ownedBg : "transparent", color: isRacing ? C.owned : C.textDim }}>{isRacing ? "RACING" : "NOT RACING"}</button>
              {adminUids.includes(uid) && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 700, fontFamily: "monospace", background: C.adminBg, color: C.admin }}>ADMIN</span>}
              {!adminUids.includes(uid) && <button onClick={() => removeMemberFn(uid)} style={{ ...mbtn, color: C.danger }}>remove</button>}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
              <AliasEditor uid={uid} aliases={m.aliases} />
              <CustIdEditor uid={uid} custId={m.iracingCustId} />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
