/**
 * Multi-player ELO calculator.
 * Treats each race as N*(N-1)/2 pairwise matchups.
 * Deltas are accumulated per driver, then batch-applied after each race.
 */
export function calculateElo(races, kFactor = 32, startingElo = 1000) {
  const ratings = {}; // driverKey -> { elo, racesPlayed }

  for (const race of races) {
    const drivers = [...race.results].sort((a, b) => a.position - b.position);
    const N = drivers.length;
    if (N < 2) continue;

    // Initialize new drivers
    for (const d of drivers) {
      if (!ratings[d.driverKey]) {
        ratings[d.driverKey] = { elo: startingElo, racesPlayed: 0 };
      }
    }

    // Accumulate pairwise deltas
    const deltas = {};
    for (const d of drivers) deltas[d.driverKey] = 0;

    const Kn = kFactor / (N - 1);

    for (let i = 0; i < N - 1; i++) {
      for (let j = i + 1; j < N; j++) {
        const ki = drivers[i].driverKey;
        const kj = drivers[j].driverKey;
        const Ri = ratings[ki].elo;
        const Rj = ratings[kj].elo;

        const Ei = 1 / (1 + Math.pow(10, (Rj - Ri) / 400));

        // Tie handling: same position = draw (0.5 each)
        const tied = drivers[i].position === drivers[j].position;
        const Si = tied ? 0.5 : 1;
        const Sj = tied ? 0.5 : 0;

        deltas[ki] += Kn * (Si - Ei);
        deltas[kj] += Kn * (Sj - (1 - Ei));
      }
    }

    // Batch-apply deltas
    for (const d of drivers) {
      ratings[d.driverKey].elo += deltas[d.driverKey];
      ratings[d.driverKey].racesPlayed += 1;
    }
  }

  return ratings;
}
