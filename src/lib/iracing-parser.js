/**
 * Parse iRacing event result JSON into TrackBlender race records.
 *
 * Resolution order for each driver:
 * 1. iracingCustId match (member doc has matching custId)
 * 2. Alias/name match (display_name matches member displayName or alias)
 * 3. Unmatched → external driver key (ext_slugified-name)
 */

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseIracingResult(json, members) {
  const data = json?.data || json;

  // Build lookup maps from members
  const custIdMap = {}; // iracingCustId → uid
  const aliasMap = {};  // lowercased name/alias → uid
  for (const [uid, m] of Object.entries(members)) {
    if (m.iracingCustId) custIdMap[String(m.iracingCustId)] = uid;
    aliasMap[m.displayName.toLowerCase()] = uid;
    for (const alias of (m.aliases || [])) {
      aliasMap[alias.toLowerCase()] = uid;
    }
  }

  // Extract metadata — store full ISO timestamp for timezone-correct display
  const trackName = data.track?.track_name || null;
  const date = data.start_time || "";

  // Find RACE session (simsession_type 6)
  const raceSession = (data.session_results || []).find(s => s.simsession_type === 6);
  if (!raceSession) {
    return { races: [], unmatchedDrivers: [], error: "No race session found in this file." };
  }

  // Group results by class
  const byClass = {};
  for (const r of raceSession.results) {
    const cls = r.car_class_short_name || "Open";
    if (!byClass[cls]) byClass[cls] = [];
    byClass[cls].push(r);
  }

  const races = [];
  const unmatchedDrivers = [];
  const seenUnmatched = new Set();

  for (const [raceClass, results] of Object.entries(byClass)) {
    const sorted = [...results].sort((a, b) => a.finish_position_in_class - b.finish_position_in_class);

    const raceResults = sorted.map((r, i) => {
      const custId = String(r.cust_id);
      const displayName = r.display_name;

      // Resolution: custId → alias/name → external
      let driverKey, name, matchType;

      if (custIdMap[custId]) {
        const uid = custIdMap[custId];
        driverKey = uid;
        name = members[uid].displayName;
        matchType = "custId";
      } else if (aliasMap[displayName.toLowerCase()]) {
        const uid = aliasMap[displayName.toLowerCase()];
        driverKey = uid;
        name = members[uid].displayName;
        matchType = "alias";
      } else {
        driverKey = "ext_" + slugify(displayName);
        name = displayName;
        matchType = "unmatched";

        if (!seenUnmatched.has(custId)) {
          seenUnmatched.add(custId);
          unmatchedDrivers.push({ custId, displayName });
        }
      }

      return {
        driverKey,
        name,
        position: i + 1,
        custId,
        iracingName: displayName,
        matchType,
      };
    });

    races.push({
      date,
      raceNumber: 1,
      trackName,
      season: "",
      raceClass: Object.keys(byClass).length > 1 ? raceClass : null,
      results: raceResults,
    });
  }

  return { races, unmatchedDrivers, trackName, date };
}
