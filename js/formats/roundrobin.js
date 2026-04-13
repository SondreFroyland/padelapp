// Round Robin format:
// All fixtures pre-generated (circle method). Each team/player plays every other once.
// Supports pairMode (fixed teams of 2) and individual mode.
// Standings: wins > setsWon > pointDiff

function rotateLeft(arr) {
  return [...arr.slice(1), arr[0]];
}

function generateFixtures(units) {
  // units = teams or individual players
  const n = units.length;
  const list = n % 2 === 0 ? [...units] : [...units, null]; // null = bye
  const m = list.length;
  const fixed = list[0];
  let rotating = list.slice(1);
  const rounds = [];

  for (let r = 0; r < m - 1; r++) {
    const circle = [fixed, ...rotating];
    const matches = [];
    let court = 1;

    for (let i = 0; i < m / 2; i++) {
      const a = circle[i];
      const b = circle[m - 1 - i];
      if (!a || !b) continue; // bye

      matches.push({
        id: crypto.randomUUID(),
        court: court++,
        team1: Array.isArray(a) ? a.map(p => p.id) : [a.id],
        team2: Array.isArray(b) ? b.map(p => p.id) : [b.id],
        score1: null,
        score2: null,
        status: 'pending',
        _team1Label: Array.isArray(a) ? a.map(p => p.name).join(' / ') : a.name,
        _team2Label: Array.isArray(b) ? b.map(p => p.name).join(' / ') : b.name,
      });
    }

    if (matches.length > 0) {
      rounds.push({
        roundNumber: rounds.length + 1,
        status: r === 0 ? 'active' : 'pending',
        matches,
        byes: []
      });
    }

    rotating = rotateLeft(rotating);
  }

  return rounds;
}

export function calculateStandings(tournament) {
  const standings = {};
  for (const p of tournament.players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0, draws: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  for (const round of tournament.rounds) {
    for (const m of round.matches) {
      if (m.status !== 'completed') continue;
      const { score1: s1, score2: s2, team1, team2 } = m;
      const t1won = s1 > s2;
      const draw = s1 === s2;

      for (const id of team1) {
        const s = standings[id]; if (!s) continue;
        s.played++; s.pointsFor += s1; s.pointsAgainst += s2; s.pointDiff += s1 - s2;
        if (draw) { s.draws++; }
        else if (t1won) { s.wins++; s.setsWon++; }
        else { s.losses++; s.setsLost++; }
      }
      for (const id of team2) {
        const s = standings[id]; if (!s) continue;
        s.played++; s.pointsFor += s2; s.pointsAgainst += s1; s.pointDiff += s2 - s1;
        if (draw) { s.draws++; }
        else if (!t1won) { s.wins++; s.setsWon++; }
        else { s.losses++; s.setsLost++; }
      }
    }
  }

  const sorted = Object.entries(standings).sort(([, a], [, b]) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    return b.pointDiff - a.pointDiff;
  });
  sorted.forEach(([id, s], i) => { s.position = i + 1; });

  return standings;
}

export function initTournament(players, config) {
  let units;
  if (config.pairMode && players.length >= 4) {
    // Pair players into fixed teams
    const teams = [];
    for (let i = 0; i + 1 < players.length; i += 2) {
      teams.push([players[i], players[i + 1]]);
    }
    units = teams;
  } else {
    units = players;
  }

  const rounds = generateFixtures(units);

  const standings = {};
  for (const p of players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0, draws: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  return {
    rounds,
    currentRoundIndex: 0,
    standings,
    formatState: { roundrobin: { totalRounds: rounds.length, pairMode: !!config.pairMode } }
  };
}

export function generateNextRound(tournament) {
  // Only called past pre-generated rounds — use ranking-based draw
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

export function getResultsTable(tournament) {
  // Returns { players, matrix: { [p1id]: { [p2id]: { score1, score2 } | null } } }
  const { players } = tournament;
  const matrix = {};
  for (const p of players) {
    matrix[p.id] = {};
    for (const q of players) matrix[p.id][q.id] = null;
  }

  for (const round of tournament.rounds) {
    for (const m of round.matches) {
      if (m.status !== 'completed') continue;
      for (const id1 of m.team1) {
        for (const id2 of m.team2) {
          matrix[id1][id2] = { score1: m.score1, score2: m.score2 };
          matrix[id2][id1] = { score1: m.score2, score2: m.score1 };
        }
      }
    }
  }
  return { players, matrix };
}
