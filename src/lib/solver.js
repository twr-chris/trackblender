// Branch-and-bound solver: finds the maximum number of tracks promotable to
// universal given per-member budget constraints and optional forced tracks.
export function solvePurchases(members, ownership, paidTracks, maxBuys, forcedTracks = []) {
  const allMissing = {};
  for (const t of paidTracks) {
    const m = members.filter(m => (ownership[m] || {})[t] !== "owned");
    if (m.length > 0 && m.length <= members.length) allMissing[t] = m;
  }

  const forcedSet = new Set(forcedTracks.filter(t => allMissing[t]));

  const feasibleTracks = Object.entries(allMissing)
    .filter(([track, miss]) => {
      if (forcedSet.has(track)) return true;
      if (miss.length > members.length * maxBuys) return false;
      return true;
    })
    .map(([track, miss]) => ({ track, miss, cost: miss.length, forced: forcedSet.has(track) }))
    .sort((a, b) => {
      if (a.forced !== b.forced) return a.forced ? -1 : 1;
      return a.cost - b.cost;
    });

  const MAX_CANDIDATES = 50;
  const candidates = feasibleTracks.length > MAX_CANDIDATES
    ? [...feasibleTracks.filter(c => c.forced), ...feasibleTracks.filter(c => !c.forced).slice(0, MAX_CANDIDATES)]
    : feasibleTracks;

  const conflicts = [];
  {
    const testBudget = {}; members.forEach(m => { testBudget[m] = maxBuys; });
    for (const c of candidates) {
      if (!c.forced) continue;
      const cantAfford = c.miss.filter(m => testBudget[m] <= 0);
      if (cantAfford.length > 0) conflicts.push({ track: c.track, members: [...cantAfford] });
      for (const m of c.miss) { if (testBudget[m] > 0) testBudget[m]--; }
    }
  }

  const totalBudget = members.length * maxBuys;
  let iterations = 0;
  const MAX_ITERATIONS = 1000000;

  const greedySeed = (() => {
    const b = {}; members.forEach(m => { b[m] = maxBuys; });
    const sel = []; const asgn = [];
    for (const c of candidates) {
      if (c.miss.every(m => b[m] > 0)) {
        for (const m of c.miss) { b[m]--; asgn.push({ member: m, track: c.track }); }
        sel.push(c.track);
      }
    }
    return { tracks: sel, assignments: asgn, count: sel.length, usedBudget: asgn.length, budget: b };
  })();
  let bestSolution = greedySeed;

  const forcedCostFromIdx = new Array(candidates.length + 1).fill(0);
  for (let i = candidates.length - 1; i >= 0; i--) {
    forcedCostFromIdx[i] = forcedCostFromIdx[i + 1] + (candidates[i].forced ? candidates[i].cost : 0);
  }

  function solve(idx, budget, usedBudget, selected, forcedCount, totalForced) {
    if (++iterations > MAX_ITERATIONS) return;

    const remaining = candidates.length - idx;
    if (selected.length + remaining <= bestSolution.count) return;

    const remainingBudget = totalBudget - usedBudget;
    if (remainingBudget < forcedCostFromIdx[idx]) return;

    if (idx >= candidates.length) {
      if (forcedCount < totalForced) return;
      if (selected.length > bestSolution.count ||
          (selected.length === bestSolution.count && usedBudget < bestSolution.usedBudget)) {
        const assignments = [];
        for (const s of selected) {
          for (const m of s.miss) assignments.push({ member: m, track: s.track });
        }
        bestSolution = {
          tracks: selected.map(s => s.track),
          assignments,
          count: selected.length,
          usedBudget,
          budget: { ...budget },
        };
      }
      return;
    }

    const c = candidates[idx];

    if (c.miss.every(m => budget[m] > 0)) {
      for (const m of c.miss) budget[m]--;
      selected.push(c);
      solve(idx + 1, budget, usedBudget + c.cost, selected, forcedCount + (c.forced ? 1 : 0), totalForced);
      selected.pop();
      for (const m of c.miss) budget[m]++;
    }

    if (!c.forced) {
      solve(idx + 1, budget, usedBudget, selected, forcedCount, totalForced);
    }
  }

  const initBudget = {}; members.forEach(m => { initBudget[m] = maxBuys; });
  solve(0, initBudget, 0, [], 0, forcedSet.size);

  return {
    assignments: bestSolution.assignments || [],
    promotedTracks: bestSolution.tracks || [],
    budget: bestSolution.budget || initBudget,
    conflicts,
  };
}
