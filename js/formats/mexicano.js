// Mexicano format:
// - Round 1: random draw
// - Subsequent rounds: rank 1+2 vs 3+4, rank 5+6 vs 7+8, etc.
// - Avoid repeat partner pairs where possible

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairKey(id1, id2) {
  return [id1, id2].sort().join(':');
}

function buildRound(orderedPlayers, roundNumber, pairHistory) {
  const pool = [...orderedPlayers];
  const matches = [];
  const byes = [];
  let court = 1;

  while (pool.length >= 4) {
    const [p0, p1, p2, p3] = pool;

    // Try to avoid repeat partners by swapping p1 and p2 if both pairs have history
    if (
      pool.length > 4 &&
      pairHistory.has(pairKey(p0.id, p1.id)) &&
      pairHistory.has(pairKey(p2.id, p3.id)) &&
      !pairHistory.has(pairKey(p0.id, p2.id))
    ) {
      pool[1] = p2;
      pool[2] = p1;
    }

    const team1 = [pool[0].id, pool[1].id];
    const team2 = [pool[2].id, pool[3].id];

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

    pool.splice(0, 4);
  }

  // Remaining players get a bye
  for (const p of pool) byes.push(p.id);

  return { roundNumber, status: 'active', matches, byes };
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
        const s = standings[id];
        if (!s) continue;
        s.played++; s.pointsFor += s1; s.pointsAgainst += s2; s.pointDiff += s1 - s2;
        if (t1won) { s.wins++; s.setsWon++; } else { s.losses++; s.setsLost++; }
      }
      for (const id of team2) {
        const s = standings[id];
        if (!s) continue;
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
  const shuffled = shuffle(players);
  const pairHistory = new Set();
  const round1 = buildRound(shuffled, 1, pairHistory);

  const standings = {};
  for (const p of players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  return {
    rounds: [round1],
    currentRoundIndex: 0,
    standings,
    formatState: { mexicano: { pairHistory: [...pairHistory] } }
  };
}

export function generateNextRound(tournament) {
  const { standings, players } = tournament;
  const roundNumber = tournament.rounds.length + 1;
  const pairHistory = new Set(tournament.formatState?.mexicano?.pairHistory ?? []);

  const sorted = [...players].sort((a, b) => {
    const sa = standings[a.id], sb = standings[b.id];
    if (sb.pointsFor !== sa.pointsFor) return sb.pointsFor - sa.pointsFor;
    return sb.wins - sa.wins;
  });

  const round = buildRound(sorted, roundNumber, pairHistory);
  tournament.formatState.mexicano.pairHistory = [...pairHistory];
  return round;
}

export function isTournamentComplete(tournament) {
  return false; // Brukeren avslutter når de vil
}
