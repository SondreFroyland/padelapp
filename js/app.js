import * as Storage from './storage.js';
import { SetupUI } from './ui/setup.js';
import { ScoreboardUI } from './ui/scoreboard.js';
import { LeaderboardUI } from './ui/leaderboard.js';
import { HistoryUI } from './ui/history.js';

// ===== Global State =====
export const AppState = {
  tournament: null,
  ui: { theme: 'dark' }
};

// ===== Format module cache =====
const formatModules = {};

export async function getFormatModule(format) {
  if (!formatModules[format]) {
    formatModules[format] = await import(`./formats/${format}.js`);
  }
  return formatModules[format];
}

// ===== Router =====
export const Router = {
  navigate(hash) {
    location.hash = hash;
  },

  updateNav() {
    const nav = document.getElementById('bottom-nav');
    const hash = location.hash || '#setup';
    const hasTournament = !!AppState.tournament;

    const tabs = hasTournament
      ? [
          { hash: '#scoreboard', icon: '&#9654;', label: 'Spill' },
          { hash: '#leaderboard', icon: '&#9776;', label: 'Tabell' },
          { hash: '#history', icon: '&#128337;', label: 'Historikk' },
        ]
      : [
          { hash: '#setup', icon: '&#43;', label: 'Ny turnering' },
          { hash: '#history', icon: '&#128337;', label: 'Historikk' },
        ];

    nav.innerHTML = tabs.map(t => `
      <button class="nav-tab${hash === t.hash ? ' active' : ''}" data-hash="${t.hash}" aria-label="${t.label}">
        <span class="nav-icon">${t.icon}</span>
        <span>${t.label}</span>
      </button>
    `).join('');

    nav.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => Router.navigate(btn.dataset.hash));
    });

    // Show/hide settings button
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn.style.display = hasTournament && (hash === '#scoreboard' || hash === '#leaderboard') ? '' : 'none';
  },

  init() {
    const handle = async () => {
      const hash = location.hash || '#setup';
      this.updateNav();

      if ((hash === '#scoreboard' || hash === '#leaderboard') && !AppState.tournament) {
        location.hash = '#setup';
        return;
      }

      if (hash === '#setup' && AppState.tournament) {
        location.hash = '#scoreboard';
        return;
      }

      switch (hash) {
        case '#setup':      SetupUI.render(); break;
        case '#scoreboard': ScoreboardUI.render(); break;
        case '#leaderboard':LeaderboardUI.render(); break;
        case '#history':    HistoryUI.render(); break;
        default:            SetupUI.render();
      }
    };

    window.addEventListener('hashchange', handle);
    handle();
  }
};

// ===== Toast =====
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
  });
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===== Confirm Modal =====
export function showConfirm(message, confirmLabel = 'Bekreft') {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-text').textContent = message;
    document.getElementById('modal-confirm').textContent = confirmLabel;

    const onConfirm = () => { modal.close(); cleanup(); resolve(true); };
    const onCancel  = () => { modal.close(); cleanup(); resolve(false); };
    const onBackdrop = (e) => { if (e.target === modal) { modal.close(); cleanup(); resolve(false); } };

    const confirmBtn = document.getElementById('modal-confirm');
    const cancelBtn  = document.getElementById('modal-cancel');

    function cleanup() {
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
    }

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);

    modal.showModal();
  });
}

// ===== Actions =====
export const Actions = {
  async createTournament(name, format, players, config) {
    const module = await getFormatModule(format);
    const formatResult = module.initTournament(players, config);

    AppState.tournament = {
      id: crypto.randomUUID(),
      name: name || 'Turnering',
      format,
      status: 'active',
      createdAt: Date.now(),
      completedAt: null,
      config,
      players,
      ...formatResult
    };

    Storage.saveActiveTournament(AppState.tournament);
    Router.navigate('#scoreboard');
  },

  async saveMatchResult(matchId, score1, score2) {
    const t = AppState.tournament;
    if (!t) return;

    const round = t.rounds[t.currentRoundIndex];
    const match = round?.matches.find(m => m.id === matchId);
    if (!match) return;

    match.score1 = parseInt(score1, 10);
    match.score2 = parseInt(score2, 10);
    match.status = 'completed';
    delete t._undoState; // can't undo once a match is recorded

    const module = await getFormatModule(t.format);
    t.standings = module.calculateStandings(t);

    const roundComplete = round.matches.every(m => m.status === 'completed');

    if (roundComplete) {
      round.status = 'completed';

      // King of Court: auto-generate next match immediately
      if (t.format === 'kingofcourt') {
        const nextRound = module.generateNextRound(t);
        if (nextRound) {
          t.rounds.push(nextRound);
          t.currentRoundIndex = t.rounds.length - 1;
        }
      }
    }

    Storage.saveActiveTournament(t);
    Router.updateNav();

    const currentHash = location.hash;
    if (currentHash === '#scoreboard') ScoreboardUI.render();
    else if (currentHash === '#leaderboard') LeaderboardUI.render();

    showToast('Resultat lagret');
  },

  async advanceRound() {
    const t = AppState.tournament;
    if (!t) return;

    const module = await getFormatModule(t.format);
    if (module.isTournamentComplete(t)) return;

    // Snapshot state before mutations so we can undo
    t._undoState = {
      prevIndex: t.currentRoundIndex,
      prevRoundsLength: t.rounds.length,
      prevFormatState: JSON.parse(JSON.stringify(t.formatState))
    };

    // For Americano and Round Robin, use pre-generated rounds first, then generate extra rounds
    if (t.format === 'americano' || t.format === 'roundrobin') {
      const nextIndex = t.currentRoundIndex + 1;
      if (nextIndex < t.rounds.length) {
        t.rounds[nextIndex].status = 'active';
        t.currentRoundIndex = nextIndex;
      } else {
        const nextRound = module.generateNextRound(t);
        if (nextRound) {
          t.rounds.push(nextRound);
          t.currentRoundIndex = t.rounds.length - 1;
        }
      }
    } else {
      const nextRound = module.generateNextRound(t);
      if (nextRound) {
        t.rounds.push(nextRound);
        t.currentRoundIndex = t.rounds.length - 1;
      }
    }

    Storage.saveActiveTournament(t);
    ScoreboardUI.render();
    Router.updateNav();
  },

  async resetMatchResult(matchId) {
    const t = AppState.tournament;
    if (!t) return;
    const round = t.rounds[t.currentRoundIndex];
    const match = round?.matches.find(m => m.id === matchId);
    if (!match || match.status !== 'completed') return;

    match.score1 = null;
    match.score2 = null;
    match.status = 'pending';
    round.status = 'active';

    const module = await getFormatModule(t.format);
    t.standings = module.calculateStandings(t);
    Storage.saveActiveTournament(t);
    ScoreboardUI.render();
  },

  undoLastRound() {
    const t = AppState.tournament;
    if (!t?._undoState) return;

    const { prevIndex, prevRoundsLength, prevFormatState } = t._undoState;
    t.rounds.splice(prevRoundsLength);    // remove any generated round
    t.formatState = prevFormatState;      // restore pair history / court state
    t.currentRoundIndex = prevIndex;
    delete t._undoState;

    Storage.saveActiveTournament(t);
    ScoreboardUI.render();
    Router.updateNav();
  },

  async completeTournament() {
    const t = AppState.tournament;
    if (!t) return;

    t.status = 'completed';
    t.completedAt = Date.now();

    await Storage.saveTournamentHistory(t);
    Storage.clearActiveTournament();
    const completedId = t.id;
    AppState.tournament = null;
    AppState.lastCompletedId = completedId;

    if (location.hash === '#history') {
      Router.updateNav();
      HistoryUI.render();
    } else {
      Router.navigate('#history');
    }
    showToast('Turnering fullfort!');
  },

  exportTournament(tournament) {
    const json = JSON.stringify(tournament, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (tournament.name || 'turnering').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
    const date = new Date(tournament.createdAt).toISOString().split('T')[0];
    a.download = `padel-${safeName}-${date}.json`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async importTournament(jsonText) {
    try {
      const t = JSON.parse(jsonText);
      if (!t.id || !t.format || !Array.isArray(t.players)) {
        throw new Error('Ugyldig turneringsformat');
      }
      // Ensure it's marked completed for history
      if (t.status !== 'completed') {
        t.status = 'completed';
        t.completedAt = t.completedAt || Date.now();
      }
      await Storage.saveTournamentHistory(t);
      showToast('Turnering importert');
      HistoryUI.render();
    } catch (e) {
      showToast('Feil ved import: ' + e.message, 'error');
    }
  },

  async deleteTournamentHistory(id) {
    await Storage.deleteTournamentHistory(id);
    HistoryUI.render();
    showToast('Turnering slettet');
  },

  updateMaxPoints(value) {
    const t = AppState.tournament;
    if (!t) return;
    const n = parseInt(value, 10);
    if (!n || n < 2) return;
    t.config.maxPoints = n;
    Storage.saveActiveTournament(t);
    showToast(`Maks poeng satt til ${n}`);
  }
};

// ===== Settings Modal =====
function initSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const btn = document.getElementById('settings-btn');
  const cancelBtn = document.getElementById('settings-cancel');
  const saveBtn = document.getElementById('settings-save');
  const input = document.getElementById('settings-max-points');

  btn.addEventListener('click', () => {
    const t = AppState.tournament;
    if (!t) return;
    input.value = t.config.maxPoints || 32;
    // Highlight current preset
    modal.querySelectorAll('.preset-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.value === String(t.config.maxPoints));
    });
    modal.showModal();
  });

  modal.querySelectorAll('.preset-btn').forEach(b => {
    b.addEventListener('click', () => {
      input.value = b.dataset.value;
      modal.querySelectorAll('.preset-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
    });
  });

  cancelBtn.addEventListener('click', () => modal.close());

  saveBtn.addEventListener('click', () => {
    Actions.updateMaxPoints(input.value);
    modal.close();
  });

  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const theme = Storage.loadTheme();
  AppState.ui.theme = theme;
  applyTheme(theme);

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const newTheme = AppState.ui.theme === 'dark' ? 'light' : 'dark';
    AppState.ui.theme = newTheme;
    applyTheme(newTheme);
    Storage.saveTheme(newTheme);
  });

  // Restore active tournament
  const saved = Storage.loadActiveTournament();
  if (saved) AppState.tournament = saved;

  // Settings modal
  initSettingsModal();

  // Register service worker + detect updates
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Ny versjon tilgjengelig – laster om...', 'success');
            setTimeout(() => location.reload(), 2500);
          }
        });
      });
    }).catch(() => {});
  }

  // Start routing
  Router.init();
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sunIcon  = document.getElementById('icon-sun');
  const moonIcon = document.getElementById('icon-moon');
  const btn = document.getElementById('theme-toggle');
  if (theme === 'dark') {
    sunIcon.style.display = '';
    moonIcon.style.display = 'none';
    btn.setAttribute('aria-label', 'Bytt til lys modus');
  } else {
    sunIcon.style.display = 'none';
    moonIcon.style.display = '';
    btn.setAttribute('aria-label', 'Bytt til mork modus');
  }
}
