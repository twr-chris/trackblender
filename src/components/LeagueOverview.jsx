import { useMemo } from "react";
import { C, thS, tdS } from "../lib/shared.js";
import { StatCard, Empty } from "./shared.jsx";

function displayDate(d) {
  if (!d) return "—";
  if (d.includes("T")) return new Date(d).toLocaleDateString("en-CA");
  return d;
}

export function LeagueOverview({ members, races, eloRatings, nameByUid, config }) {
  const memberList = Object.values(members);
  const racingCount = memberList.filter(m => m.racing !== false).length;

  const raceList = useMemo(() =>
    Object.entries(races).map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.raceNumber || 1) - (b.raceNumber || 1)),
    [races]
  );

  const stats = useMemo(() => {
    let driverRaceSlots = 0;
    const tracks = new Set();
    const seasons = new Set();
    for (const r of raceList) {
      driverRaceSlots += (r.results || []).length;
      if (r.trackName) tracks.add(r.trackName);
      if (r.season) seasons.add(r.season);
    }
    return {
      totalRaces: raceList.length,
      hours: Math.round((driverRaceSlots * 20) / 60),
      uniqueTracks: tracks.size,
      seasons: seasons.size,
    };
  }, [raceList]);

  // Top 5 ELO
  const topElo = useMemo(() => {
    if (!eloRatings?.ratings) return [];
    return Object.entries(eloRatings.ratings)
      .map(([key, r]) => ({ key, name: nameByUid[key] || key.replace("ext_", "").replace(/-/g, " "), elo: Math.round(r.elo), races: r.racesPlayed }))
      .filter(d => d.races >= 6)
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 5);
  }, [eloRatings, nameByUid]);

  // Recent 5 races
  const recentRaces = useMemo(() => {
    return raceList.slice(-5).reverse().map(r => {
      const winner = (r.results || []).find(res => res.position === 1);
      return { date: r.date, track: r.trackName, winner: winner?.name || "—", field: (r.results || []).length, raceClass: r.raceClass };
    });
  }, [raceList]);

  // Most raced tracks
  const topTracks = useMemo(() => {
    const counts = {};
    for (const r of raceList) {
      if (r.trackName) counts[r.trackName] = (counts[r.trackName] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [raceList]);

  // Season summary
  const seasonSummary = useMemo(() => {
    const map = {};
    for (const r of raceList) {
      const s = r.season || null;
      if (!s) continue;
      if (!map[s]) map[s] = { races: 0, drivers: new Set() };
      map[s].races++;
      for (const res of r.results || []) map[s].drivers.add(res.driverKey);
    }
    return Object.entries(map).map(([season, d]) => ({ season, races: d.races, drivers: d.drivers.size }));
  }, [raceList]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Members" value={memberList.length} />
        <StatCard label="Racing" value={racingCount} color={C.accent} />
        <StatCard label="Races Logged" value={stats.totalRaces} color={C.elo} />
        <StatCard label="Hours Driven" value={stats.hours} color={C.textMuted} />
        <StatCard label="Tracks Raced" value={stats.uniqueTracks} color={C.owned} />
        {stats.seasons > 1 && <StatCard label="Seasons" value={stats.seasons} />}
      </div>

      {/* Two-column layout for leaderboard + recent races */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
        {/* ELO Leaderboard */}
        {topElo.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.elo, marginBottom: 10 }}>ELO Leaderboard</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {topElo.map((d, i) => (
                  <tr key={d.key}>
                    <td style={{ ...tdS, width: 28, textAlign: "center", color: C.textDim, fontFamily: "monospace", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ ...tdS, fontSize: 13 }}>{d.name}</td>
                    <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: C.owned }}>{d.elo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Races */}
        {recentRaces.length > 0 && (
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>Recent Races</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {recentRaces.map((r, i) => (
                  <tr key={i}>
                    <td style={{ ...tdS, fontFamily: "monospace", fontSize: 11, color: C.textDim, whiteSpace: "nowrap" }}>{displayDate(r.date)}</td>
                    <td style={{ ...tdS, fontSize: 12 }}>{r.track}</td>
                    <td style={{ ...tdS, fontSize: 12, color: C.elo, textAlign: "right", whiteSpace: "nowrap" }}>{r.winner}</td>
                    <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 11, color: C.textDim }}>{r.field}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Most Raced Tracks */}
      {topTracks.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.owned, marginBottom: 10 }}>Most Raced Tracks</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {topTracks.map(([name, count]) => (
              <div key={name} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 14px", display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: 12 }}>{name}</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "monospace", color: C.owned }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season Summary */}
      {seasonSummary.length > 1 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.textMuted, marginBottom: 10 }}>Seasons</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thS}>Season</th>
                <th style={{ ...thS, textAlign: "right" }}>Races</th>
                <th style={{ ...thS, textAlign: "right" }}>Drivers</th>
              </tr>
            </thead>
            <tbody>
              {seasonSummary.map(s => (
                <tr key={s.season}>
                  <td style={{ ...tdS, fontSize: 12 }}>{s.season}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{s.races}</td>
                  <td style={{ ...tdS, textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{s.drivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {raceList.length === 0 && topElo.length === 0 && (
        <Empty icon="🏁" title="No Race Data Yet" sub="Race results and league stats will appear here once races are recorded." />
      )}
    </div>
  );
}
