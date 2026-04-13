import { AppState, Actions, showConfirm, getFormatModule } from '../app.js';

const FORMAT_NAMES = {
  mexicano: 'Mexicano',
  americano: 'Americano',
  roundrobin: 'Round Robin',
  vinnerbane: 'Vinnerbane',
  kingofcourt: 'King of Court'
};

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function playerName(id, players) {
  return escHtml(players.find(p => p.id === id)?.name ?? id);
}

function teamLabel(ids, players) {
  return ids.map(id => playerName(id, players)).join(' / ');
}

function matchCardHTML(match, players, maxPoints, showMovement, completedOnly = false) {
  const { id, court, team1, team2, score1, score2, status } = match;
  const isComplete = status === 'completed';

  if (isComplete) {
    const t1won = score1 > score2;
    return `
      <div class="match-card completed" data-match-id="${id}">
        <div class="match-header">Bane ${court}</div>
        <div class="match-team-row">
          <div class="match-team-names">
            <span>${teamLabel(team1, players)}</span>
          </div>
          <div class="match-result-display">
            <strong>${score1}</strong>
            <span class="match-result-sep">-</span>
            <strong>${score2}</strong>
          </div>
        </div>
        <div class="match-team-row">
          <div class="match-team-names">
            <span>${teamLabel(team2, players)}</span>
          </div>
        </div>
      </div>`;
  }

  if (completedOnly) return '';

  const mvBadge = (court, won) => {
    if (!showMovement) return '';
    if (court === 1) {
      return won
        ? '<span class="movement-badge movement-stay">Beholder bane 1</span>'
        : '<span class="movement-badge movement-down">Rykker ned</span>';
    }
    return won
      ? '<span class="movement-badge movement-up">Rykker opp</span>'
      : '<span class="movement-badge movement-down">Rykker ned</span>';
  };

  return `
    <div class="match-card" data-match-id="${id}">
      <div class="match-header">Bane ${court}</div>
      <div class="match-team-row">
        <div class="match-team-names">
          <span>${teamLabel(team1, players)}</span>
          <span id="mv-t1-${id}">${mvBadge(court, true)}</span>
        </div>
        <input
          type="number" inputmode="numeric"
          class="score-input" id="score1-${id}"
          min="0" max="${maxPoints}" placeholder="0"
          aria-label="Poeng lag 1"
        >
      </div>
      <div class="match-divider">VS</div>
      <div class="match-team-row">
        <div class="match-team-names">
          <span>${teamLabel(team2, players)}</span>
          <span id="mv-t2-${id}">${mvBadge(court, false)}</span>
        </div>
        <input
          type="number" inputmode="numeric"
          class="score-input" id="score2-${id}"
          min="0" max="${maxPoints}" placeholder="0"
          aria-label="Poeng lag 2"
        >
      </div>
      <button class="btn btn-primary btn-full save-match-btn" style="margin-top:14px" data-match-id="${id}">
        Lagre resultat
      </button>
    </div>`;
}

function roundProgressLabel(t) {
  const round = t.rounds[t.currentRoundIndex];
  if (!round) return '';
  const numRounds = t.config?.numRounds;
  const total = numRounds > 0
    ? numRounds
    : (t.formatState?.americano?.totalRounds || t.formatState?.roundrobin?.totalRounds || null);
  const completed = round.matches.filter(m => m.status === 'completed').length;
  const all = round.matches.length;
  const totalPart = total ? ` / ${total}` : '';
  return `Runde <strong>${round.roundNumber}</strong>${totalPart} &nbsp;&middot;&nbsp; ${completed}/${all} kamper`;
}

function renderQueue(t) {
  if (t.format !== 'kingofcourt') return '';
  const queue = t.formatState?.koc?.queue ?? [];
  if (queue.length === 0) return '';
  return `
    <div class="koc-queue">
      <div class="koc-queue-title">Ko</div>
      <div class="koc-queue-list">
        ${queue.map((id, i) => `
          <div class="koc-queue-item">
            <span class="koc-queue-pos">${i + 1}.</span>
            <span>${playerName(id, t.players)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function renderByes(round, players) {
  if (!round.byes || round.byes.length === 0) return '';
  const names = round.byes.map(id => players.find(p => p.id === id)?.name ?? id).join(', ');
  return `<p style="color:var(--text-muted);font-size:0.875rem;margin-bottom:12px">Frirunde: ${escHtml(names)}</p>`;
}

export const ScoreboardUI = {
  render() {
    const t = AppState.tournament;
    if (!t) return;

    const round = t.rounds[t.currentRoundIndex];
    if (!round) return;

    const { players, config } = t;
    const maxPoints = config.maxPoints || 32;
    const showMovement = t.format === 'vinnerbane';

    const pending = round.matches.filter(m => m.status !== 'completed');
    const done    = round.matches.filter(m => m.status === 'completed');
    const roundComplete = pending.length === 0;

    let nextRoundBtn = '';
    if (roundComplete && t.format !== 'kingofcourt') {
      nextRoundBtn = `
        <button id="next-round-btn" class="btn btn-primary btn-full" style="margin-top:8px">Neste runde</button>
        <button id="finish-btn" class="btn btn-ghost btn-full" style="margin-top:8px">Avslutt turnering</button>`;
    }

    const root = document.getElementById('app-root');
    root.innerHTML = `
      <div class="page">
        <div class="round-header">
          <span class="round-label">${roundProgressLabel(t)}</span>
          <span style="font-size:0.8125rem;color:var(--text-muted)">${FORMAT_NAMES[t.format] || ''}</span>
        </div>

        ${renderByes(round, players)}

        <div id="pending-matches">
          ${pending.map(m => matchCardHTML(m, players, maxPoints, showMovement)).join('')}
        </div>

        ${nextRoundBtn}

        ${done.length > 0 ? `
          <div class="completed-section">
            <div class="completed-toggle" id="completed-toggle">
              Fullforte kamper (${done.length})
            </div>
            <div id="completed-matches" style="display:none">
              ${done.map(m => matchCardHTML(m, players, maxPoints, showMovement)).join('')}
            </div>
          </div>
        ` : ''}

        ${renderQueue(t)}
      </div>
    `;

    this.bindEvents(t, maxPoints);
  },

  bindEvents(t, maxPoints) {
    // Auto-fill opponent score
    document.querySelectorAll('.score-input').forEach(input => {
      const matchId = input.closest('[data-match-id]')?.dataset.matchId;
      if (!matchId) return;

      input.addEventListener('input', () => {
        const v = parseInt(input.value, 10);
        const isTeam1 = input.id.startsWith('score1-');
        const otherId = isTeam1 ? `score2-${matchId}` : `score1-${matchId}`;
        const other = document.getElementById(otherId);
        if (other && !isNaN(v) && v >= 0 && v <= maxPoints) {
          other.value = maxPoints - v;
        }
      });
    });

    // Save match buttons
    document.querySelectorAll('.save-match-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matchId = btn.dataset.matchId;
        const s1Input = document.getElementById(`score1-${matchId}`);
        const s2Input = document.getElementById(`score2-${matchId}`);

        const s1 = parseInt(s1Input?.value, 10);
        const s2 = parseInt(s2Input?.value, 10);

        if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
          s1Input?.focus();
          return;
        }

        if (s1 > maxPoints || s2 > maxPoints) {
          const msg = `Poeng kan ikke overskride makspoeng (${maxPoints})`;
          s1Input?.parentElement?.insertAdjacentHTML?.('afterend', `<p class="validation-error">${msg}</p>`);
          return;
        }

        const round = t.rounds[t.currentRoundIndex];
        const match = round?.matches.find(m => m.id === matchId);
        if (!match) return;

        const t1Label = teamLabel(match.team1, t.players);
        const t2Label = teamLabel(match.team2, t.players);
        const confirmed = await showConfirm(`${t1Label}  ${s1} – ${s2}  ${t2Label}`);
        if (!confirmed) return;

        await Actions.saveMatchResult(matchId, s1, s2);
      });
    });

    // Next round
    document.getElementById('next-round-btn')?.addEventListener('click', () => {
      Actions.advanceRound();
    });

    // Finish tournament
    document.getElementById('finish-btn')?.addEventListener('click', async () => {
      const ok = await showConfirm('Avslutt turneringen og lagre i historikk?', 'Avslutt');
      if (ok) Actions.completeTournament();
    });

    // Toggle completed matches
    document.getElementById('completed-toggle')?.addEventListener('click', () => {
      const el = document.getElementById('completed-matches');
      if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
    });
  }
};
