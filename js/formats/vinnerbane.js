// Vinnerbane (Winner Court) format:
// Court 1 = prestige. Winners move up, losers move down.
// Track player court history over rounds.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMatchesFromCourts(courts) {
  const matches = [];
  const sortedCourts = Object.keys(courts).map(Number).sort((a, b) => a - b);
  for (const c of sortedCourts) {
    const players = courts[c];
    if (players.length < 4) continue;
    matches.push({
      id: crypto.randomUUID(),
      court: c,
      team1: [players[0], players[1]],
      team2: [players[2], players[3]],
      score1: null,
      score2: null,
      status: 'pending'
    });
  }
  return matches;
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
        if (t1won) { s.wins++; s.setsWon++; if (m.court === 1) s.courtWins++; }
        else { s.losses++; s.setsLost++; }
      }
      for (const id of team2) {
        const s = standings[id]; if (!s) continue;
        s.played++; s.pointsFor += s2; s.pointsAgainst += s1; s.pointDiff += s2 - s1;
        if (!t1won) { s.wins++; s.setsWon++; if (m.court === 1) s.courtWins++; }
        else { s.losses++; s.setsLost++; }
      }
    }
  }

  const sorted = Object.entries(standings).sort(([, a], [, b]) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.courtWins !== a.courtWins) return b.courtWins - a.courtWins;
    return b.pointDiff - a.pointDiff;
  });
  sorted.forEach(([id, s], i) => { s.position = i + 1; });

  return standings;
}

export function initTournament(players, config) {
  const shuffled = shuffle([...players]);
  const maxAuto = Math.floor(shuffled.length / 4);
  const numCourts = config.numCourts ? Math.min(config.numCourts, maxAuto) : maxAuto;
  const courts = {};
  const byeQueue = [];

  for (let c = 1; c <= numCourts; c++) {
    courts[c] = [
      shuffled[(c - 1) * 4].id,
      shuffled[(c - 1) * 4 + 1].id,
      shuffled[(c - 1) * 4 + 2].id,
      shuffled[(c - 1) * 4 + 3].id
    ];
  }

  for (let i = numCourts * 4; i < shuffled.length; i++) {
    byeQueue.push(shuffled[i].id);
  }

  const matches = buildMatchesFromCourts(courts);

  const standings = {};
  for (const p of players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  // Track court history per player
  const courtHistory = {};
  for (const p of players) courtHistory[p.id] = [];
  for (const [courtNum, playerIds] of Object.entries(courts)) {
    for (const id of playerIds) {
      if (courtHistory[id]) courtHistory[id].push(Number(courtNum));
    }
  }

  return {
    rounds: [{ roundNumber: 1, status: 'active', matches, byes: byeQueue }],
    currentRoundIndex: 0,
    standings,
    formatState: {
      vinnerbane: {
        courtAssignments: courts,
        byeQueue,
        courtHistory
      }
    }
  };
}

export function generateNextRound(tournament) {
  const lastRound = tournament.rounds[tournament.rounds.length - 1];
  const state = tournament.formatState.vinnerbane;
  const { courtHistory } = state;
  let byeQueue = [...state.byeQueue];

  const numCourts = lastRound.matches.length;
  const newCourts = {};

  // For each court from high to low (to process promotion/demotion properly):
  // winners of court N go to court N-1, losers go to court N+1
  const courtWinners = {};
  const courtLosers = {};

  for (const m of lastRound.matches) {
    if (m.status !== 'completed') continue;
    const t1won = m.score1 > m.score2;
    courtWinners[m.court] = t1won ? [...m.team1] : [...m.team2];
    courtLosers[m.court] = t1won ? [...m.team2] : [...m.team1];
  }

  for (let c = 1; c <= numCourts; c++) {
    newCourts[c] = [];
  }

  for (let c = 1; c <= numCourts; c++) {
    const winners = courtWinners[c] || [];
    const losers = courtLosers[c] || [];

    if (c === 1) {
      // Court 1: winners stay, losers go to court 2
      newCourts[1].push(...winners);
    } else {
      // Winners move up
      const targetUp = c - 1;
      if (newCourts[targetUp] && newCourts[targetUp].length < 4) {
        newCourts[targetUp].push(...winners);
      } else {
        newCourts[c].push(...winners);
      }
    }

    const targetDown = c + 1;
    if (targetDown <= numCourts) {
      if (newCourts[targetDown] === undefined) newCourts[targetDown] = [];
      newCourts[targetDown].push(...losers);
    } else {
      // Bottom court losers go to bye queue
      byeQueue.push(...losers);
    }
  }

  // Fill incomplete courts from bye queue
  for (let c = numCourts; c >= 1; c--) {
    while (newCourts[c] && newCourts[c].length < 4 && byeQueue.length > 0) {
      newCourts[c].push(byeQueue.shift());
    }
  }

  // New byes: players displaced from incomplete courts
  const newByes = [];
  for (let c = 1; c <= numCourts; c++) {
    if (newCourts[c] && newCourts[c].length > 4) {
      newByes.push(...newCourts[c].splice(4));
    }
    if (newCourts[c] && newCourts[c].length < 4) {
      newByes.push(...newCourts[c].splice(0));
    }
  }
  byeQueue.push(...newByes);

  // Update court history
  for (const [courtNum, playerIds] of Object.entries(newCourts)) {
    for (const id of playerIds) {
      if (courtHistory[id]) courtHistory[id].push(Number(courtNum));
    }
  }

  state.courtAssignments = newCourts;
  state.byeQueue = byeQueue;

  const roundNumber = tournament.rounds.length + 1;
  const matches = buildMatchesFromCourts(newCourts);

  return { roundNumber, status: 'active', matches, byes: byeQueue };
}

export function isTournamentComplete(tournament) {
  // Vinnerbane runs until manually ended (no fixed round count)
  return false;
}

export function getPlayerCourtHistory(tournament, playerId) {
  return tournament.formatState?.vinnerbane?.courtHistory?.[playerId] ?? [];
}
