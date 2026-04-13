import { Actions, showConfirm } from '../app.js';
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

function topThree(tournament) {
  if (!tournament.standings || !tournament.players) return '';
  const sorted = [...tournament.players].sort((a, b) => {
    const sa = tournament.standings[a.id], sb = tournament.standings[b.id];
    if (!sa || !sb) return 0;
    return (sa.position || 99) - (sb.position || 99);
  });
  return sorted.slice(0, 3).map((p, i) => {
    const labels = ['Vinner', '2. plass', '3. plass'];
    const colors = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];
    return `<div style="font-size:0.8125rem"><span style="color:${colors[i]};font-weight:700">${labels[i]}:</span> ${escHtml(p.name)}</div>`;
  }).join('');
}

function tournamentDetailHTML(t) {
  const rounds = t.rounds?.length ?? 0;
  const completedMatches = t.rounds?.reduce((acc, r) => acc + r.matches.filter(m => m.status === 'completed').length, 0) ?? 0;

  return `
    <div style="font-size:0.875rem;color:var(--text-muted);margin-bottom:10px">
      ${rounds} runde${rounds !== 1 ? 'r' : ''} &middot; ${completedMatches} kamper spilt
    </div>
    ${topThree(t)}
    ${t.players?.length ? `
      <div style="margin-top:10px;font-size:0.8125rem;color:var(--text-muted)">
        Spillere: ${t.players.map(p => escHtml(p.name)).join(', ')}
      </div>` : ''}
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
