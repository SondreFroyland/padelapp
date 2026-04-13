import { AppState, Actions, showConfirm, getFormatModule } from '../app.js';

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function playerName(id, players) {
  return escHtml(players.find(p => p.id === id)?.name ?? id);
}

function rankCell(pos) {
  if (pos <= 3) {
    return `<td class="rank-cell"><span class="rank-medal">${pos}</span></td>`;
  }
  return `<td class="rank-cell">${pos}</td>`;
}

function diffDisplay(diff) {
  if (diff > 0) return `<span style="color:var(--accent)">+${diff}</span>`;
  if (diff < 0) return `<span style="color:var(--danger)">${diff}</span>`;
  return '0';
}

function renderStandardTable(t) {
  const { players, standings } = t;
  const sorted = [...players].sort((a, b) => {
    const sa = standings[a.id], sb = standings[b.id];
    return sa.position - sb.position;
  });

  const isKoC = t.format === 'kingofcourt';
  const showDiff = !isKoC;

  return `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Navn</th>
            <th>Kamper</th>
            <th>Seire</th>
            <th>${isKoC ? 'Bane-seire' : 'Poeng'}</th>
            ${showDiff ? '<th>+/-</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${sorted.map(p => {
            const s = standings[p.id];
            const pos = s.position;
            const rowClass = pos <= 3 ? `rank-${pos}` : '';
            return `
              <tr class="${rowClass}">
                ${rankCell(pos)}
                <td class="player-name-cell">${escHtml(p.name)}</td>
                <td>${s.played}</td>
                <td>${isKoC ? s.courtWins : s.wins}</td>
                <td>${isKoC ? s.courtWins : s.pointsFor}</td>
                ${showDiff ? `<td>${diffDisplay(s.pointDiff)}</td>` : ''}
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderVinnerbaneTable(t) {
  const { players, standings } = t;
  const sorted = [...players].sort((a, b) => standings[a.id].position - standings[b.id].position);

  const courtHistories = {};
  for (const p of players) {
    courtHistories[p.id] = t.formatState?.vinnerbane?.courtHistory?.[p.id] ?? [];
  }
  const maxHistory = Math.max(...Object.values(courtHistories).map(h => h.length), 0);

  return `
    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Navn</th>
            <th>Seire</th>
            <th>Bane 1</th>
            ${maxHistory > 0 ? '<th>Historikk</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${sorted.map(p => {
            const s = standings[p.id];
            const pos = s.position;
            const history = courtHistories[p.id] ?? [];
            return `
              <tr class="${pos <= 3 ? 'rank-' + pos : ''}">
                ${rankCell(pos)}
                <td class="player-name-cell">${escHtml(p.name)}</td>
                <td>${s.wins}</td>
                <td>${s.courtWins}</td>
                ${maxHistory > 0 ? `<td>
                  <div class="court-history">
                    ${history.slice(-8).map(c => `
                      <div class="court-dot${c === 1 ? ' court-1' : ''}">${c}</div>
                    `).join('')}
                  </div>
                </td>` : ''}
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderRoundRobinMatrix(t) {
  const { players } = t;
  if (players.length > 8) return ''; // too big for matrix display

  const results = {};
  for (const round of t.rounds) {
    for (const m of round.matches) {
      if (m.status !== 'completed') continue;
      for (const id1 of m.team1) {
        for (const id2 of m.team2) {
          results[`${id1}:${id2}`] = { score1: m.score1, score2: m.score2 };
          results[`${id2}:${id1}`] = { score1: m.score2, score2: m.score1 };
        }
      }
    }
  }

  return `
    <div class="divider"></div>
    <div class="section-title">Resultattabell</div>
    <div class="results-matrix">
      <table>
        <thead>
          <tr>
            <th></th>
            ${players.map(p => `<th title="${escHtml(p.name)}">${escHtml(p.name.slice(0, 4))}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${players.map(p1 => `
            <tr>
              <th>${escHtml(p1.name.slice(0, 8))}</th>
              ${players.map(p2 => {
                if (p1.id === p2.id) return '<td class="cell-self">-</td>';
                const r = results[`${p1.id}:${p2.id}`];
                if (!r) return '<td></td>';
                const cls = r.score1 > r.score2 ? 'cell-win' : 'cell-loss';
                return `<td class="${cls}">${r.score1}-${r.score2}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

export const LeaderboardUI = {
  render() {
    const t = AppState.tournament;
    if (!t) return;

    const tableHTML = t.format === 'vinnerbane'
      ? renderVinnerbaneTable(t)
      : renderStandardTable(t);

    const rrMatrix = t.format === 'roundrobin' ? renderRoundRobinMatrix(t) : '';

    const round = t.rounds[t.currentRoundIndex];
    const roundComplete = round?.matches.every(m => m.status === 'completed') ?? false;

    // Always show Avslutt; show Neste runde when round is complete (except KoC which auto-advances)
    let advanceBtn = '';
    if (roundComplete && t.format !== 'kingofcourt') {
      advanceBtn = `
        <button id="next-round-btn" class="btn btn-primary btn-full" style="margin-top:8px">Neste runde</button>
        <button id="finish-btn" class="btn btn-ghost btn-full" style="margin-top:8px">Avslutt turnering</button>`;
    } else {
      advanceBtn = `<button id="finish-btn" class="btn btn-ghost btn-full" style="margin-top:8px">Avslutt turnering</button>`;
    }

    const numRoundsPlayed = t.rounds.filter(r => r.status === 'completed').length;
    const numRoundsCfg = t.config?.numRounds;
    const totalRounds = numRoundsCfg > 0
      ? numRoundsCfg
      : (t.formatState?.americano?.totalRounds || t.formatState?.roundrobin?.totalRounds || null);

    const root = document.getElementById('app-root');
    root.innerHTML = `
      <div class="page">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <div style="font-weight:700;font-size:1rem">${escHtml(t.name)}</div>
            <div style="font-size:0.8125rem;color:var(--text-muted)">
              ${totalRounds ? `Runde ${numRoundsPlayed} av ${totalRounds}` : `Runde ${numRoundsPlayed}`}
            </div>
          </div>
          <span class="format-badge">${escHtml(t.format)}</span>
        </div>

        ${tableHTML}
        ${rrMatrix}

        <div style="margin-top:24px">
          ${advanceBtn}
        </div>
      </div>
    `;

    // Next round button
    document.getElementById('next-round-btn')?.addEventListener('click', () => {
      Actions.advanceRound();
    });

    // Finish tournament button
    document.getElementById('finish-btn')?.addEventListener('click', async () => {
      const ok = await showConfirm('Avslutt turneringen og lagre i historikk?', 'Avslutt');
      if (ok) Actions.completeTournament();
    });
  }
};
