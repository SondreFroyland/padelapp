// Americano format:
// All rounds pre-calculated using round-robin circle method.
// Goal: every player partners with as many others as possible.

function pairKey(id1, id2) {
  return [id1, id2].sort().join(':');
}

function rotateLeft(arr) {
  return [...arr.slice(1), arr[0]];
}

function generateSchedule(players) {
  // Round-robin circle method: fix players[0], rotate the rest
  const n = players.length;
  if (n < 4) return [];

  // For odd n, add a bye placeholder
  const list = n % 2 === 0 ? [...players] : [...players, { id: '__bye__', name: 'Fri' }];
  const m = list.length;

  const fixed = list[0];
  let rotating = list.slice(1);
  const rounds = [];
  const pairHistory = new Set();

  for (let r = 0; r < m - 1; r++) {
    const circle = [fixed, ...rotating];
    const half = m / 2;
    const matches = [];
    let court = 1;

    // Pair circle[0] with circle[half], circle[1] with circle[half-1], etc.
    // Then form teams: (0,half) vs (1,half-1) style, 4 players per match
    for (let i = 0; i < half; i += 2) {
      const p1 = circle[i];
      const p2 = circle[m - 1 - i];
      const p3 = circle[i + 1];
      const p4 = circle[m - 2 - i];

      if (!p1 || !p2 || !p3 || !p4) continue;
      if ([p1.id, p2.id, p3.id, p4.id].includes('__bye__')) continue;

      // team1 = [p1, p2], team2 = [p3, p4]
      // Try to minimize repeat partners
      let team1 = [p1.id, p2.id];
      let team2 = [p3.id, p4.id];
      const alt1 = [p1.id, p3.id];
      const alt2 = [p2.id, p4.id];

      if (
        pairHistory.has(pairKey(team1[0], team1[1])) &&
        !pairHistory.has(pairKey(alt1[0], alt1[1]))
      ) {
        team1 = alt1;
        team2 = alt2;
      }

      pairHistory.add(pairKey(team1[0], team1[1]));
      pairHistory.add(pairKey(team2[0], team2[1]));

      matches.push({
        id: crypto.randomUUID(),
        court: court++,
        team1,
        team2,
        score1: null,
        score2: null,
        status: 'pending'
      });
    }

    if (matches.length > 0) {
      rounds.push({ roundNumber: rounds.length + 1, status: r === 0 ? 'active' : 'pending', matches, byes: [] });
    }

    rotating = rotateLeft(rotating);
  }

  return rounds;
}

export function calculateStandings(tournament) {
  const standings = {};
  for (const p of tournament.players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  for (const round of tournament.rounds) {
    for (const m of round.matches) {
      if (m.status !== 'completed') continue;
      const { score1: s1, score2: s2, team1, team2 } = m;
      const t1won = s1 > s2;

      for (const id of team1) {
        const s = standings[id]; if (!s) continue;
        s.played++; s.pointsFor += s1; s.pointsAgainst += s2; s.pointDiff += s1 - s2;
        if (t1won) { s.wins++; s.setsWon++; } else { s.losses++; s.setsLost++; }
      }
      for (const id of team2) {
        const s = standings[id]; if (!s) continue;
        s.played++; s.pointsFor += s2; s.pointsAgainst += s1; s.pointDiff += s2 - s1;
        if (!t1won) { s.wins++; s.setsWon++; } else { s.losses++; s.setsLost++; }
      }
    }
  }

  const sorted = Object.entries(standings).sort(([, a], [, b]) => {
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return b.wins - a.wins;
  });
  sorted.forEach(([id, s], i) => { s.position = i + 1; });

  return standings;
}

export function initTournament(players, config) {
  const allRounds = generateSchedule(players);
  const limited = config.numRounds ? allRounds.slice(0, config.numRounds) : allRounds;

  const standings = {};
  for (const p of players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  return {
    rounds: limited,
    currentRoundIndex: 0,
    standings,
    formatState: { americano: { totalRounds: limited.length } }
  };
}

export function generateNextRound(tournament) {
  // Pre-generated rounds exist — return null; app.js handles index advance
  // This is only called when past pre-generated rounds
  return buildExtraRound(tournament);
}

export function isTournamentComplete(tournament) {
  return false; // Brukeren avslutter når de vil
}

function buildExtraRound(tournament) {
  const { standings, players } = tournament;
  const sorted = [...players].sort((a, b) => {
    const sa = standings[a.id], sb = standings[b.id];
    if (sb.pointsFor !== sa.pointsFor) return sb.pointsFor - sa.pointsFor;
    return sb.wins - sa.wins;
  });
  const pool = [...sorted];
  const matches = [];
  let court = 1;
  while (pool.length >= 4) {
    matches.push({
      id: crypto.randomUUID(), court: court++,
      team1: [pool[0].id, pool[1].id],
      team2: [pool[2].id, pool[3].id],
      score1: null, score2: null, status: 'pending'
    });
    pool.splice(0, 4);
  }
  return {
    roundNumber: tournament.rounds.length + 1,
    status: 'active', matches,
    byes: pool.map(p => p.id)
  };
}
