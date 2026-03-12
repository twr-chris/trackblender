// iRacing track name aliases: paste name (lowercase) → TrackBlender DB name
const TRACK_ALIASES = {
  "circuit de barcelona catalunya": "Circuit de Barcelona-Catalunya",
  "circuit zandvoort": "Circuit Park Zandvoort",
  "hockenheimring baden-württemberg": "HockenheimRing",
  "hockenheimring baden-wurttemberg": "HockenheimRing",
  "road atlanta": "Michelin Raceway Road Atlanta",
  "mount washington hillclimb": "Mount Washington Auto Road",
  "red bull ring": "Red Bull Ring – Spielberg",
  "shell v-power motorsport park at the bend": "Shell V-Power Motorsports Park at The Bend",
  "summit point raceway": "Summit Point Motorsports Park",
  "weathertech raceway at laguna seca": "WeatherTech Raceway Laguna Seca",
  "willow springs international raceway": "Willow Springs Raceway",
  "daytona rallycross and dirt road": "Daytona International Speedway – Rallycross",
  "nürburgring combined": "Nürburgring Nordschleife",
  "nurburgring combined": "Nürburgring Nordschleife",
  "[legacy] michigan international speedway - 2009": "Michigan International Speedway – 2009",
  "[legacy] phoenix raceway - 2008": "Phoenix Raceway – 2008",
  "[legacy] pocono raceway - 2009": "Pocono Raceway – 2009",
  "[legacy] silverstone circuit - 2008": "Silverstone Circuit – 2008",
  "[legacy] texas motor speedway - 2009": "Texas Motor Speedway – 2009",
};

function normalizeForMatch(s) {
  return s.toLowerCase().replace(/[–—\-]/g, " ").replace(/[''""\.,:;!?]/g, "").replace(/\s+/g, " ").trim();
}

export function parseIracingPaste(text, dbTrackNames) {
  const lines = text.split("\n").map(l => l.trim());
  let startIdx = lines.findIndex(l => l.startsWith("Track Name"));
  startIdx = startIdx === -1 ? 0 : startIdx + 1;
  let endIdx = lines.findIndex((l, i) => i > startIdx && l === "Licenses");
  if (endIdx === -1) endIdx = lines.length;

  const parsed = [];
  for (let i = startIdx; i < endIdx; i++) {
    const line = lines[i];
    if (!line || /^\d+$/.test(line)) continue;
    if (["Search", "Grid View", "List View", "Type"].includes(line)) continue;
    let nextIdx = i + 1;
    while (nextIdx < endIdx && !lines[nextIdx]) nextIdx++;
    const nextLine = nextIdx < endIdx ? lines[nextIdx] : "";
    const configs = /^\d+$/.test(nextLine) ? parseInt(nextLine) : null;
    parsed.push({ rawName: line, configs });
  }

  const dbNorm = {};
  for (const name of dbTrackNames) dbNorm[normalizeForMatch(name)] = name;

  const normAliases = {};
  for (const [k, v] of Object.entries(TRACK_ALIASES)) normAliases[normalizeForMatch(k)] = v;

  const matched = [];
  const unmatched = [];

  for (const { rawName, configs } of parsed) {
    const norm = normalizeForMatch(rawName);
    if (normAliases[norm]) {
      matched.push({ raw: rawName, db: normAliases[norm], configs });
      if (norm.includes("rburgring combined")) {
        matched.push({ raw: rawName + " (GP)", db: "Nürburgring Grand-Prix-Strecke", configs: null });
      }
      continue;
    }
    if (dbNorm[norm]) { matched.push({ raw: rawName, db: dbNorm[norm], configs }); continue; }
    const fuzzy = dbTrackNames.find(db => {
      const dn = normalizeForMatch(db);
      return dn.includes(norm) || norm.includes(dn);
    });
    if (fuzzy) { matched.push({ raw: rawName, db: fuzzy, configs }); continue; }
    unmatched.push({ raw: rawName, configs });
  }

  return { matched, unmatched };
}
