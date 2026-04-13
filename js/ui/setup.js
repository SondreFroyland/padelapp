import { AppState, Actions, showToast } from '../app.js';

const FORMAT_INFO = {
  mexicano: {
    name: 'Mexicano',
    desc: 'Dynamisk trekning basert pa stilling etter hver runde'
  },
  americano: {
    name: 'Americano',
    desc: 'Alle bytter partnere – forhåndsberegnet rotasjon'
  },
  roundrobin: {
    name: 'Round Robin',
    desc: 'Alle spiller mot alle – komplett tabell'
  },
  vinnerbane: {
    name: 'Vinnerbane',
    desc: 'Vinnere rykker opp, tapere rykker ned'
  },
  kingofcourt: {
    name: 'King of Court',
    desc: 'En bane – vinnere beholder plassen, tapere kler av'
  }
};

let setupState = {
  players: [],
  format: 'mexicano',
  config: {
    numRounds: 0,
    numCourts: 0,
    maxPoints: 32,
    pairMode: false,
    targetCourtWins: null
  }
};

function getConfigHTML(format) {
  const c = setupState.config;
  switch (format) {
    case 'mexicano':
      return `
        <div class="form-group">
          <label class="form-label" for="cfg-rounds">Maks runder (0 = ubegrenset)</label>
          <input type="number" id="cfg-rounds" class="input" value="${c.numRounds}" min="0" max="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="cfg-courts">Antall baner (0 = automatisk)</label>
          <input type="number" id="cfg-courts" class="input" value="${c.numCourts || 0}" min="0" max="20">
        </div>
        <div class="form-group">
          <label class="form-label">Makspoeng per kamp</label>
          <div class="preset-row">
            <button class="preset-btn${c.maxPoints===16?' selected':''}" data-preset="16">16</button>
            <button class="preset-btn${c.maxPoints===24?' selected':''}" data-preset="24">24</button>
            <button class="preset-btn${c.maxPoints===32?' selected':''}" data-preset="32">32</button>
          </div>
          <input type="number" id="cfg-max-points" class="input" value="${c.maxPoints}" min="2" max="200" placeholder="Egendefinert">
        </div>`;

    case 'americano':
      return `
        <div class="form-group">
          <label class="form-label" for="cfg-rounds">Maks runder (0 = ubegrenset)</label>
          <input type="number" id="cfg-rounds" class="input" value="${c.numRounds || 0}" min="0" max="50">
        </div>
        <div class="form-group">
          <label class="form-label" for="cfg-courts">Antall baner (0 = automatisk)</label>
          <input type="number" id="cfg-courts" class="input" value="${c.numCourts || 0}" min="0" max="20">
        </div>
        <div class="form-group">
          <label class="form-label">Makspoeng per kamp</label>
          <div class="preset-row">
            <button class="preset-btn${c.maxPoints===16?' selected':''}" data-preset="16">16</button>
            <button class="preset-btn${c.maxPoints===24?' selected':''}" data-preset="24">24</button>
            <button class="preset-btn${c.maxPoints===32?' selected':''}" data-preset="32">32</button>
          </div>
          <input type="number" id="cfg-max-points" class="input" value="${c.maxPoints}" min="2" max="200" placeholder="Egendefinert">
        </div>`;

    case 'roundrobin':
      return `
        <div class="form-group">
          <label class="form-label">Modus</label>
          <div class="toggle-group">
            <button class="toggle-opt${!c.pairMode?' active':''}" data-mode="individual">Individuell</button>
            <button class="toggle-opt${c.pairMode?' active':''}" data-mode="pair">Par</button>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Makspoeng per kamp</label>
          <div class="preset-row">
            <button class="preset-btn${c.maxPoints===16?' selected':''}" data-preset="16">16</button>
            <button class="preset-btn${c.maxPoints===24?' selected':''}" data-preset="24">24</button>
            <button class="preset-btn${c.maxPoints===32?' selected':''}" data-preset="32">32</button>
          </div>
          <input type="number" id="cfg-max-points" class="input" value="${c.maxPoints}" min="2" max="200" placeholder="Egendefinert">
        </div>`;

    case 'vinnerbane':
      return `
        <div class="form-group">
          <label class="form-label" for="cfg-courts">Antall baner (0 = automatisk)</label>
          <input type="number" id="cfg-courts" class="input" value="${c.numCourts || 0}" min="0" max="20">
        </div>
        <div class="form-group">
          <label class="form-label">Makspoeng per kamp</label>
          <div class="preset-row">
            <button class="preset-btn${c.maxPoints===16?' selected':''}" data-preset="16">16</button>
            <button class="preset-btn${c.maxPoints===24?' selected':''}" data-preset="24">24</button>
            <button class="preset-btn${c.maxPoints===32?' selected':''}" data-preset="32">32</button>
          </div>
          <input type="number" id="cfg-max-points" class="input" value="${c.maxPoints}" min="2" max="200" placeholder="Egendefinert">
        </div>`;

    case 'kingofcourt':
      return `
        <div class="form-group">
          <label class="form-label">Makspoeng per kamp</label>
          <div class="preset-row">
            <button class="preset-btn${c.maxPoints===16?' selected':''}" data-preset="16">16</button>
            <button class="preset-btn${c.maxPoints===24?' selected':''}" data-preset="24">24</button>
            <button class="preset-btn${c.maxPoints===32?' selected':''}" data-preset="32">32</button>
          </div>
          <input type="number" id="cfg-max-points" class="input" value="${c.maxPoints}" min="2" max="200" placeholder="Egendefinert">
        </div>
        <div class="form-group">
          <label class="form-label" for="cfg-target-wins">Mal-baneseire (valgfritt)</label>
          <input type="number" id="cfg-target-wins" class="input" value="${c.targetCourtWins || ''}" min="1" max="100" placeholder="Ubegrenset">
        </div>`;

    default: return '';
  }
}

function playerListHTML() {
  if (setupState.players.length === 0) {
    return '<p style="color:var(--text-muted);font-size:0.875rem">Ingen spillere ennå</p>';
  }
  return `<div class="chip-list">${
    setupState.players.map(p => `
      <span class="chip">
        ${escHtml(p.name)}
        <button class="chip-remove" data-id="${p.id}" aria-label="Fjern ${escHtml(p.name)}">&times;</button>
      </span>
    `).join('')
  }</div>`;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function validate() {
  const n = setupState.players.length;
  const fmt = setupState.format;

  if (n < 4) return 'Du trenger minst 4 spillere';
  if ((fmt === 'mexicano' || fmt === 'americano') && n % 2 !== 0) {
    return `${FORMAT_INFO[fmt].name} krever et partall antall spillere`;
  }
  if (fmt === 'roundrobin' && setupState.config.pairMode && n % 2 !== 0) {
    return 'Parmodus krever et partall antall spillere';
  }
  if (fmt === 'kingofcourt' && n < 6) {
    return 'King of Court trenger minst 6 spillere (4 pa bane + ko)';
  }
  return null;
}

export const SetupUI = {
  render() {
    const root = document.getElementById('app-root');
    root.innerHTML = `
      <div class="page">
        <div class="section">
          <div class="section-title">Turneringsnavn</div>
          <input type="text" id="tournament-name" class="input" placeholder="F.eks. Fredagspadel" value="${escHtml(AppState.tournament?.name || '')}">
        </div>

        <div class="section">
          <div class="section-title">Spillere <span id="player-count" style="color:var(--text-muted)">(${setupState.players.length})</span></div>
          <div class="input-row" style="margin-bottom:12px">
            <input type="text" id="player-name-input" class="input" placeholder="Spillernavn" maxlength="30" autocomplete="off">
            <button id="add-player-btn" class="btn btn-primary" style="flex-shrink:0">Legg til</button>
          </div>
          <div id="player-list">${playerListHTML()}</div>
          <div id="player-error" class="validation-error" style="display:none"></div>
        </div>

        <div class="section">
          <div class="section-title">Format</div>
          <div class="format-grid">
            ${Object.entries(FORMAT_INFO).map(([key, info]) => `
              <button class="format-card${setupState.format === key ? ' selected' : ''}" data-format="${key}">
                <div class="format-card-name">${info.name}</div>
                <div class="format-card-desc">${info.desc}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="section" id="config-section">
          <div class="section-title">Innstillinger</div>
          <div class="card" id="config-form">${getConfigHTML(setupState.format)}</div>
        </div>

        <div id="start-error" class="validation-error" style="margin-bottom:12px;display:none"></div>
        <button id="start-btn" class="btn btn-primary btn-full">Start turnering</button>
      </div>
    `;

    this.bindEvents();
    document.getElementById('player-name-input').focus();
  },

  bindEvents() {
    const input = document.getElementById('player-name-input');
    const addBtn = document.getElementById('add-player-btn');

    function addPlayer() {
      const name = input.value.trim();
      if (!name) return;
      if (setupState.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        document.getElementById('player-error').textContent = 'Spiller med dette navnet finnes allerede';
        document.getElementById('player-error').style.display = '';
        return;
      }
      document.getElementById('player-error').style.display = 'none';
      setupState.players.push({ id: crypto.randomUUID(), name });
      input.value = '';
      document.getElementById('player-list').innerHTML = playerListHTML();
      document.getElementById('player-count').textContent = `(${setupState.players.length})`;
      bindChipRemove();
      input.focus();
    }

    addBtn.addEventListener('click', addPlayer);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addPlayer(); } });

    function bindChipRemove() {
      document.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          setupState.players = setupState.players.filter(p => p.id !== btn.dataset.id);
          document.getElementById('player-list').innerHTML = playerListHTML();
          document.getElementById('player-count').textContent = `(${setupState.players.length})`;
          bindChipRemove();
        });
      });
    }
    bindChipRemove();

    // Format selection
    document.querySelectorAll('.format-card').forEach(card => {
      card.addEventListener('click', () => {
        setupState.format = card.dataset.format;
        document.querySelectorAll('.format-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        document.getElementById('config-form').innerHTML = getConfigHTML(setupState.format);
        bindConfigEvents();
      });
    });

    bindConfigEvents();

    // Start button
    document.getElementById('start-btn').addEventListener('click', async () => {
      const errEl = document.getElementById('start-error');
      const err = validate();
      if (err) {
        errEl.textContent = err;
        errEl.style.display = '';
        return;
      }
      errEl.style.display = 'none';

      const name = document.getElementById('tournament-name').value.trim() || 'Turnering';
      readConfig();

      try {
        await Actions.createTournament(name, setupState.format, [...setupState.players], { ...setupState.config });
        // Reset setup state for next time
        setupState.players = [];
      } catch (e) {
        showToast('Feil ved oppstart: ' + e.message, 'error');
      }
    });
  }
};

function bindConfigEvents() {
  // Preset buttons
  document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const input = document.getElementById('cfg-max-points');
      if (input) input.value = btn.dataset.preset;
      setupState.config.maxPoints = parseInt(btn.dataset.preset, 10);
    });
  });

  // Max points input
  const mpInput = document.getElementById('cfg-max-points');
  if (mpInput) {
    mpInput.addEventListener('input', () => {
      const v = parseInt(mpInput.value, 10);
      if (v >= 2) {
        setupState.config.maxPoints = v;
        document.querySelectorAll('.preset-btn[data-preset]').forEach(b => {
          b.classList.toggle('selected', b.dataset.preset === String(v));
        });
      }
    });
  }

  // Rounds input
  const roundsInput = document.getElementById('cfg-rounds');
  if (roundsInput) {
    roundsInput.addEventListener('input', () => {
      setupState.config.numRounds = parseInt(roundsInput.value, 10) || 0;
    });
  }

  // Courts input
  const courtsInput = document.getElementById('cfg-courts');
  if (courtsInput) {
    courtsInput.addEventListener('input', () => {
      setupState.config.numCourts = parseInt(courtsInput.value, 10) || 0;
    });
  }

  // Toggle pair/individual for round robin
  document.querySelectorAll('.toggle-opt[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      setupState.config.pairMode = btn.dataset.mode === 'pair';
      document.querySelectorAll('.toggle-opt[data-mode]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Target court wins
  const targetInput = document.getElementById('cfg-target-wins');
  if (targetInput) {
    targetInput.addEventListener('input', () => {
      const v = parseInt(targetInput.value, 10);
      setupState.config.targetCourtWins = v > 0 ? v : null;
    });
  }
}

function readConfig() {
  const roundsInput = document.getElementById('cfg-rounds');
  if (roundsInput) setupState.config.numRounds = parseInt(roundsInput.value, 10) || 0;

  const mpInput = document.getElementById('cfg-max-points');
  if (mpInput) {
    const v = parseInt(mpInput.value, 10);
    if (v >= 2) setupState.config.maxPoints = v;
  }

  const targetInput = document.getElementById('cfg-target-wins');
  if (targetInput) {
    const v = parseInt(targetInput.value, 10);
    setupState.config.targetCourtWins = v > 0 ? v : null;
  }

  const courtsInput2 = document.getElementById('cfg-courts');
  if (courtsInput2) setupState.config.numCourts = parseInt(courtsInput2.value, 10) || 0;
}
