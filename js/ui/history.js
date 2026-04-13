import { AppState, Actions, showConfirm } from '../app.js';
import { getAllTournamentHistory } from '../storage.js';

const FORMAT_LABELS = {
  mexicano:    'Mexicano',
  americano:   'Americano',
  roundrobin:  'Round Robin',
  vinnerbane:  'Vinnerbane',
  kingofcourt: 'King of Court'
};

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('nb-NO', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
}


function renderHistoryRounds(t) {
  if (!t.rounds?.length || !t.players?.length) return '';
  const played = t.rounds.filter(r => r.matches.some(m => m.status === 'completed'));
  if (!played.length) return '';

  return `
    <div style="margin-top:14px">
      <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:10px">Kamper</div>
      ${played.map(round => {
        const done = round.matches.filter(m => m.status === 'completed');
        return `
          <div style="margin-bottom:14px">
            <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;margin-bottom:6px">Runde ${round.roundNumber}</div>
            ${done.map(m => {
              const t1 = m.team1.map(id => t.players.find(p => p.id === id)?.name ?? id).join(' / ');
              const t2 = m.team2.map(id => t.players.find(p => p.id === id)?.name ?? id).join(' / ');
              const t1won = m.score1 > m.score2;
              return `
                <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.8125rem">
                  <span style="flex:1;${t1won ? 'font-weight:600' : 'color:var(--text-muted)'}">${escHtml(t1)}</span>
                  <span style="font-weight:700;flex-shrink:0">${m.score1}–${m.score2}</span>
                  <span style="flex:1;text-align:right;${!t1won ? 'font-weight:600' : 'color:var(--text-muted)'}">${escHtml(t2)}</span>
                </div>`;
            }).join('')}
          </div>`;
      }).join('')}
    </div>`;
}

function renderFinalStandings(t) {
  if (!t.standings || !t.players?.length) return '';
  const medals = ['🥇', '🥈', '🥉'];
  const sorted = [...t.players].sort((a, b) => {
    const sa = t.standings[a.id], sb = t.standings[b.id];
    return (sa?.position ?? 99) - (sb?.position ?? 99);
  });
  return `
    <div style="margin-bottom:14px">
      <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);margin-bottom:8px">Sluttresultat</div>
      ${sorted.map((p, i) => {
        const s = t.standings[p.id];
        const medal = medals[i] ?? '';
        const isTop = i < 3;
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);${i === 0 ? 'padding-top:0' : ''}">
            <span style="font-size:${isTop ? '1.25rem' : '0.875rem'};min-width:28px;text-align:center;${!isTop ? 'color:var(--text-muted)' : ''}">${isTop ? medal : (i + 1) + '.'}</span>
            <span style="flex:1;font-weight:${isTop ? '700' : '500'};font-size:0.9375rem">${escHtml(p.name)}</span>
            <span style="color:var(--text-muted);font-size:0.8125rem">${s?.wins ?? 0}V · ${s?.pointsFor ?? 0}p</span>
          </div>`;
      }).join('')}
    </div>`;
}

function tournamentDetailHTML(t) {
  const rounds = t.rounds?.length ?? 0;
  const completedMatches = t.rounds?.reduce((acc, r) => acc + r.matches.filter(m => m.status === 'completed').length, 0) ?? 0;

  return `
    <div style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:14px">
      ${rounds} runde${rounds !== 1 ? 'r' : ''} &middot; ${completedMatches} kamper spilt &middot; ${t.players?.length ?? 0} spillere
    </div>
    ${renderFinalStandings(t)}
    ${renderHistoryRounds(t)}
  `;
}

function tournamentItemHTML(t) {
  return `
    <div class="history-item" data-id="${t.id}">
      <div class="history-item-header" data-expand="${t.id}">
        <div class="history-meta">
          <div class="history-name">${escHtml(t.name || 'Turnering')}</div>
          <div class="history-info">
            ${formatDate(t.completedAt || t.createdAt)}
            &middot; ${t.players?.length ?? 0} spillere
          </div>
        </div>
        <span class="format-badge">${escHtml(FORMAT_LABELS[t.format] || t.format)}</span>
      </div>
      <div class="history-detail" id="detail-${t.id}">
        ${tournamentDetailHTML(t)}
      </div>
      <div class="history-actions">
        <button class="btn btn-ghost export-btn" data-id="${t.id}">
          Eksporter
        </button>
        <button class="btn btn-danger delete-btn" data-id="${t.id}">
          Slett
        </button>
      </div>
    </div>`;
}

export const HistoryUI = {
  async render() {
    const root = document.getElementById('app-root');

    root.innerHTML = `
      <div class="page">
        <div class="section">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div class="section-title" style="margin-bottom:0">Historikk</div>
            <label class="btn btn-ghost" style="min-height:36px;padding:6px 14px;font-size:0.8125rem;cursor:pointer">
              Importer
              <input type="file" id="import-input" accept=".json" style="display:none">
            </label>
          </div>
          <div id="history-list">
            <div class="empty-state">
              <div class="empty-state-icon">&#127955;</div>
              <div class="empty-state-title">Laster historikk...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load from IndexedDB
    let tournaments = [];
    try {
      tournaments = await getAllTournamentHistory();
    } catch (e) {
      document.getElementById('history-list').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-title">Kunne ikke laste historikk</div>
          <div class="empty-state-desc">${e.message}</div>
        </div>`;
      return;
    }

    const listEl = document.getElementById('history-list');
    if (tournaments.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#127955;</div>
          <div class="empty-state-title">Ingen fullforte turneringer enno</div>
          <div class="empty-state-desc">Fullfore en turnering for a se den her</div>
        </div>`;
    } else {
      listEl.innerHTML = tournaments.map(t => tournamentItemHTML(t)).join('');
    }

    this.bindEvents(tournaments);

    // Auto-expand last completed tournament
    const lastId = AppState.lastCompletedId;
    if (lastId) {
      delete AppState.lastCompletedId;
      const detail = document.getElementById(`detail-${lastId}`);
      if (detail) {
        detail.classList.add('open');
        detail.closest('.history-item')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  },

  bindEvents(tournaments) {
    // Expand/collapse detail
    document.querySelectorAll('[data-expand]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.expand;
        const detail = document.getElementById(`detail-${id}`);
        if (detail) detail.classList.toggle('open');
      });
    });

    // Export buttons
    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = tournaments.find(x => x.id === btn.dataset.id);
        if (t) Actions.exportTournament(t);
      });
    });

    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const t = tournaments.find(x => x.id === btn.dataset.id);
        const name = t?.name || 'denne turneringen';
        const ok = await showConfirm(`Slette "${escHtml(name)}"?`, 'Slett');
        if (ok) Actions.deleteTournamentHistory(btn.dataset.id);
      });
    });

    // Import file
    const importInput = document.getElementById('import-input');
    importInput?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        await Actions.importTournament(ev.target.result);
        importInput.value = '';
      };
      reader.readAsText(file);
    });
  }
};
