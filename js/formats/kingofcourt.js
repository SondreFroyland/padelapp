// King of Court format:
// One court, continuous matches. Winners keep the court, losers go to back of queue.
// No fixed rounds — runs until manually ended or target court-wins reached.

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
        if (t1won) { s.wins++; s.courtWins++; } else { s.losses++; }
      }
      for (const id of team2) {
        const s = standings[id]; if (!s) continue;
        s.played++; s.pointsFor += s2; s.pointsAgainst += s1; s.pointDiff += s2 - s1;
        if (!t1won) { s.wins++; s.courtWins++; } else { s.losses++; }
      }
    }
  }

  const sorted = Object.entries(standings).sort(([, a], [, b]) => {
    if (b.courtWins !== a.courtWins) return b.courtWins - a.courtWins;
    return b.wins - a.wins;
  });
  sorted.forEach(([id, s], i) => { s.position = i + 1; });

  return standings;
}

function makeNextMatch(kocState) {
  const [p1, p2, p3, p4] = kocState.kingCourtPlayers;
  return {
    id: crypto.randomUUID(),
    court: 1,
    team1: [p1, p2],
    team2: [p3, p4],
    score1: null,
    score2: null,
    status: 'pending'
  };
}

export function initTournament(players, config) {
  const ids = players.map(p => p.id);
  const kingCourtPlayers = ids.slice(0, 4);
  const queue = ids.slice(4);

  const kocState = { kingCourtPlayers, queue };
  const firstMatch = makeNextMatch(kocState);

  const standings = {};
  for (const p of players) {
    standings[p.id] = {
      played: 0, wins: 0, losses: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      setsWon: 0, setsLost: 0, courtWins: 0, position: 0
    };
  }

  return {
    rounds: [{ roundNumber: 1, status: 'active', matches: [firstMatch], byes: [] }],
    currentRoundIndex: 0,
    standings,
    formatState: { koc: kocState }
  };
}

export function generateNextRound(tournament) {
  // For KoC, "next round" means: take the last completed match result,
  // update the queue, generate the next single match.
  // This is called AFTER a match result is saved.
  const kocState = tournament.formatState.koc;
  const lastRound = tournament.rounds[tournament.rounds.length - 1];
  const lastMatch = lastRound.matches[lastRound.matches.length - 1];

  if (!lastMatch || lastMatch.status !== 'completed') return null;

  const t1won = lastMatch.score1 > lastMatch.score2;
  const winners = t1won ? [...lastMatch.team1] : [...lastMatch.team2];
  const losers = t1won ? [...lastMatch.team2] : [...lastMatch.team1];

  // Losers go to back of queue, winners pull new opponents from front
  kocState.queue.push(...losers);
  const newcomers = kocState.queue.splice(0, 2);
  kocState.kingCourtPlayers = [...winners, ...newcomers];

  const nextMatch = makeNextMatch(kocState);

  // KoC uses a single "round" that accumulates all matches,
  // or we create a new round per match for clarity
  const roundNumber = tournament.rounds.length + 1;
  return { roundNumber, status: 'active', matches: [nextMatch], byes: [] };
}

export function isTournamentComplete(tournament) {
  // KoC completes only when manually ended
  const targetWins = tournament.config?.targetCourtWins;
  if (!targetWins) return false;

  // Check if any player reached the target
  for (const s of Object.values(tournament.standings)) {
    if (s.courtWins >= targetWins) return true;
  }
  return false;
}

export function getQueue(tournament) {
  return tournament.formatState?.koc?.queue ?? [];
}

export function getKingCourtPlayers(tournament) {
  return tournament.formatState?.koc?.kingCourtPlayers ?? [];
}
