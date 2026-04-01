'use strict';

const DEFAULTS = {
  visible: true,
  loginGreen: 3,
  loginYellow: 7,
  submissionGreen: 7,
  submissionYellow: 21,
  lessonThreshold: 50,
  rowHighlight: false,
  gradingMode: 'teacher'
};

const ids = ['loginGreen', 'loginYellow', 'submissionGreen', 'submissionYellow', 'lessonThreshold'];

chrome.storage.sync.get(DEFAULTS, (cfg) => {
  document.getElementById('toggle-visible').checked   = cfg.visible !== false;
  document.getElementById('toggle-highlight').checked = cfg.rowHighlight !== false;
  setSettingsEnabled(cfg.visible !== false);
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = cfg[id] ?? DEFAULTS[id];
  });
  setGradingMode(cfg.gradingMode || 'teacher');
  updateTynnLabel();
});

chrome.storage.local.get('cak_last_updated', (r) => {
  const el = document.getElementById('cache-status');
  if (!el) return;
  if (r.cak_last_updated) {
    const d    = new Date(r.cak_last_updated);
    const diff = Math.round((Date.now() - d) / 60000);
    const tid  = d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
    el.textContent = diff < 2
      ? `Oppdatert nettopp (${tid})`
      : `Oppdatert for ${diff} min siden (${tid})`;
  } else {
    el.textContent = 'Ikke hentet ennå';
  }
});

document.getElementById('toggle-visible').addEventListener('change', (e) => {
  const visible = e.target.checked;
  document.getElementById('toggle-text').textContent = visible ? 'Vis' : 'Skjul';
  setSettingsEnabled(visible);
  save({ visible });
});

document.getElementById('toggle-highlight').addEventListener('change', (e) => {
  save({ rowHighlight: e.target.checked });
});

document.getElementById('btn-refresh').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const m = (tabs[0].url || '').match(/\/courses\/(\d+)/);
      if (m) {
        chrome.storage.local.remove(`cak_data_${m[1]}`, () => {
          document.getElementById('cache-status').textContent = 'Oppdaterer…';
          chrome.tabs.reload(tabs[0].id);
          window.close();
        });
      }
    }
  });
});

function updateTynnLabel() {
  const yellow = parseInt(document.getElementById('loginYellow').value) || DEFAULTS.loginYellow;
  const el = document.getElementById('label-tynn');
  if (el) el.textContent = `${yellow + 1}–15 dager`;
}

ids.forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', () => {
    const val = Math.max(1, parseInt(el.value, 10) || DEFAULTS[id]);
    el.value = val;
    save({ [id]: val });
    if (id === 'loginYellow') updateTynnLabel();
  });
});

document.getElementById('grading-mode').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  const val = btn.dataset.val;
  setGradingMode(val);
  save({ gradingMode: val });
});

function setGradingMode(val) {
  document.querySelectorAll('#grading-mode .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

function save(changes) {
  chrome.storage.sync.set(changes);
}

function setSettingsEnabled(enabled) {
  const body = document.getElementById('settings-body');
  if (!body) return;
  body.classList.toggle('disabled-overlay', !enabled);
}
