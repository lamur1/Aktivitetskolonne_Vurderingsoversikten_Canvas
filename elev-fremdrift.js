/**
 * elev-fremdrift.js
 * Viser elevens fremdrift (batterygrafikk) som modal i Canvas.
 * Legges inn i Canvas sitt globale JavaScript-felt.
 *
 * Krav:
 *  - Vises bare for elever (ikke lærere / admins)
 *  - Aktiveres på alle kurssider via flytende knapp (nederst til høyre)
 *  - Henter data direkte fra Canvas-API for innlogget elev
 *  - Cacher data i localStorage (1 time)
 */
(function () {
  'use strict';

  // ─── Kjøresjekk ──────────────────────────────────────────────────────────
  const m = location.pathname.match(/\/courses\/(\d+)/);
  if (!m) return;
  const courseId = m[1];

  const ENV = window.ENV || {};
  const userId = ENV.current_user_id;
  if (!userId) return;

  // Skjul for lærere og administratorer
  const roles = ENV.current_user_roles || [];
  const isTeacherOrAdmin = roles.some(r =>
    r === 'teacher' || r === 'TeacherEnrollment' ||
    r === 'admin'   || r === 'AccountAdmin' ||
    r === 'DesignerEnrollment' || r === 'TaEnrollment'
  );
  if (isTeacherOrAdmin) return;

  // Ikke kjør mer enn én gang per side
  if (document.getElementById('ef-btn')) return;

  // ─── Stil ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #ef-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      background: #3b6d11;
      color: #fff;
      border: none;
      border-radius: 28px;
      padding: 10px 18px;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 3px 12px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      gap: 7px;
      transition: background 0.15s;
    }
    #ef-btn:hover { background: #2f5a0e; }
    #ef-btn svg { flex-shrink: 0; }

    #ef-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.38);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #ef-modal {
      background: #fff;
      border-radius: 12px;
      padding: 24px 24px 20px;
      width: min(92vw, 520px);
      max-height: 88vh;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.22);
      font-family: inherit;
    }
    #ef-modal h2 {
      margin: 0 0 4px;
      font-size: 17px;
      font-weight: 600;
      color: #1a1a1a;
    }
    #ef-modal .ef-subtitle {
      font-size: 12px;
      color: #888780;
      margin-bottom: 16px;
    }
    #ef-modal .ef-close {
      float: right;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
      line-height: 1;
      margin-top: -2px;
    }
    #ef-modal .ef-close:hover { color: #111; }
    #ef-modal .ef-section {
      border-top: 0.5px solid #e8e6de;
      padding-top: 12px;
      margin-top: 12px;
    }
    #ef-modal .ef-label {
      font-size: 11px;
      color: #888780;
      margin-bottom: 6px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #ef-modal .ef-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      font-size: 11px;
      color: #5f5e5a;
      margin-top: 10px;
    }
    #ef-modal .ef-legend-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    #ef-loading {
      color: #888780;
      font-size: 13px;
      padding: 20px 0;
      text-align: center;
    }
    #ef-error {
      color: #a32d2d;
      font-size: 13px;
      padding: 12px 0;
    }
    .ef-stat-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .ef-stat {
      background: #f5f4f0;
      border-radius: 8px;
      padding: 8px 14px;
      min-width: 80px;
      text-align: center;
    }
    .ef-stat-num {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 1.1;
    }
    .ef-stat-lbl {
      font-size: 10px;
      color: #888780;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);

  // ─── Flytende knapp ───────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'ef-btn';
  btn.setAttribute('aria-label', 'Se din fremdrift');
  btn.innerHTML = `
    <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round">
      <rect x="1.5" y="3.5" width="14" height="10" rx="2"/>
      <rect x="15.5" y="6" width="1.5" height="5" rx="0.75" fill="white" stroke="none"/>
      <rect x="3" y="9" width="2.5" height="3" rx="0.5" fill="white" stroke="none"/>
      <rect x="7" y="6.5" width="2.5" height="5.5" rx="0.5" fill="white" stroke="none"/>
      <rect x="11" y="7.5" width="2.5" height="4.5" rx="0.5" fill="white" stroke="none"/>
    </svg>
    Min fremdrift`;
  document.body.appendChild(btn);

  btn.addEventListener('click', openModal);

  // ─── Modal ────────────────────────────────────────────────────────────────
  function openModal() {
    if (document.getElementById('ef-backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'ef-backdrop';
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const modal = document.createElement('div');
    modal.id = 'ef-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Min fremdrift');
    modal.innerHTML = `
      <button class="ef-close" aria-label="Lukk">&times;</button>
      <h2>Min fremdrift</h2>
      <div class="ef-subtitle">Oversikt over hva du har gjort i dette kurset</div>
      <div id="ef-content"><div id="ef-loading">Henter data…</div></div>
    `;
    modal.querySelector('.ef-close').addEventListener('click', closeModal);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // ESC-tast lukker modal
    document.addEventListener('keydown', escHandler);

    loadAndRender();
  }

  function closeModal() {
    const bd = document.getElementById('ef-backdrop');
    if (bd) bd.remove();
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') closeModal();
  }

  // ─── Data-henting ─────────────────────────────────────────────────────────
  const CACHE_KEY = `ef_data_${courseId}_${userId}`;
  const CACHE_TTL = 60 * 60 * 1000; // 1 time

  async function loadAndRender() {
    const contentEl = document.getElementById('ef-content');
    if (!contentEl) return;

    // Sjekk cache
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          renderData(data);
          return;
        }
      }
    } catch (e) { /* ignorér */ }

    try {
      const data = await fetchAllData();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch (e) { /* ignorér quota-feil */ }
      renderData(data);
    } catch (err) {
      contentEl.innerHTML = `<div id="ef-error">Kunne ikke hente data: ${err.message || err}</div>`;
    }
  }

  async function fetchAllData() {
    const [modules, assignments, submissions] = await Promise.all([
      fetchModules(),
      fetchAssignments(),
      fetchSubmissions()
    ]);

    // Bygg modul-til-assignment-kart + deadline per modul
    const modDeadlineMap = {};
    const modAssignMap   = {};  // modId -> [assignment]

    assignments.forEach(a => {
      if (!a.module_ids || a.module_ids.length === 0) return;
      a.module_ids.forEach(mid => {
        const midStr = String(mid);
        if (!modAssignMap[midStr]) modAssignMap[midStr] = [];
        modAssignMap[midStr].push(a);
        if (a.due_at) {
          const due = new Date(a.due_at);
          if (!modDeadlineMap[midStr] || due > modDeadlineMap[midStr]) {
            modDeadlineMap[midStr] = due;
          }
        }
      });
    });

    // Bygg submission-kart: assignment_id -> submission
    const subMap = {};
    submissions.forEach(s => { subMap[String(s.assignment_id)] = s; });

    // Beregn levert / mangler per modul
    const deliveredPerMod = {};
    const skippedPerMod   = {};
    const now = new Date();

    modules.forEach(mod => {
      const mid      = String(mod.id);
      const assigns  = modAssignMap[mid] || [];
      const deadline = modDeadlineMap[mid] || null;
      let delivered  = 0;
      let missing    = 0;

      assigns.forEach(a => {
        const sub = subMap[String(a.id)];
        const hasActivity = sub && (
          sub.submitted_at || sub.graded_at ||
          sub.workflow_state === 'submitted' ||
          sub.workflow_state === 'graded' ||
          sub.workflow_state === 'complete' ||
          (sub.grade && sub.grade !== null)
        );
        const isExcused = sub && sub.excused;
        const due = a.due_at ? new Date(a.due_at) : null;
        const isPast = due && due <= now;

        if (isExcused) return;
        if (hasActivity) {
          delivered++;
        } else if (isPast) {
          missing++;
        }
      });

      if (delivered > 0) deliveredPerMod[mid] = delivered;
      if (missing   > 0) skippedPerMod[mid]   = missing;
    });

    // Totalantall godkjente leksjoner (moduler med >0 leverte)
    const godkjent = Object.keys(deliveredPerMod).length;
    const totalLeksjoner = modules.length;

    // Antall ventende innleveringer
    const venter = submissions.filter(s =>
      s.workflow_state === 'submitted' || s.workflow_state === 'pending_review'
    ).length;

    return {
      modules,
      modDeadlineMap: Object.fromEntries(
        Object.entries(modDeadlineMap).map(([k, v]) => [k, v.toISOString()])
      ),
      modAssignMap: Object.fromEntries(
        Object.entries(modAssignMap).map(([k, v]) => [k, v.length])
      ),
      deliveredPerMod,
      skippedPerMod,
      godkjent,
      totalLeksjoner,
      venter
    };
  }

  async function fetchModules() {
    // Hent moduler med fullføringsdata for denne eleven
    return fetchAllPages(
      `/api/v1/courses/${courseId}/modules?include[]=items&student_id=${userId}&per_page=50`
    ).then(mods => mods.map(mod => ({
      id:        String(mod.id),
      name:      mod.name,
      total:     mod.items_count || 0,
      completed: mod.completed_count || 0
    })));
  }

  async function fetchAssignments() {
    return fetchAllPages(
      `/api/v1/courses/${courseId}/assignments?include[]=module_ids&per_page=100`
    );
  }

  async function fetchSubmissions() {
    return fetchAllPages(
      `/api/v1/courses/${courseId}/students/submissions?student_ids[]=${userId}&per_page=100`
    );
  }

  async function fetchAllPages(url) {
    const results = [];
    let nextUrl = url;
    while (nextUrl) {
      const resp = await fetch(nextUrl, { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const page = await resp.json();
      results.push(...(Array.isArray(page) ? page : [page]));
      const link = resp.headers.get('Link') || '';
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = next ? next[1] : null;
    }
    return results;
  }

  // ─── Rendering ────────────────────────────────────────────────────────────
  function renderData(data) {
    const contentEl = document.getElementById('ef-content');
    if (!contentEl) return;

    const {
      modules, modDeadlineMap, modAssignMap,
      deliveredPerMod, skippedPerMod,
      godkjent, totalLeksjoner, venter
    } = data;

    // Gjenoppbygg deadline-map med Date-objekter
    const deadlineMap = {};
    Object.entries(modDeadlineMap || {}).forEach(([k, v]) => {
      deadlineMap[k] = new Date(v);
    });

    const batterySvg = modules.length > 0
      ? makeBatterySvgStudent(modules, skippedPerMod || {}, deliveredPerMod || {}, deadlineMap, modAssignMap || {})
      : '';

    const foran = countForan(modules, deliveredPerMod, deadlineMap);
    const etter = countEtter(modules, skippedPerMod, deadlineMap);

    let statusTekst = '';
    if (etter > 0) {
      statusTekst = `<span style="color:#a32d2d">Du har ${etter} leksjon${etter === 1 ? '' : 'er'} på etterskudd</span>`;
    } else if (foran > 0) {
      statusTekst = `<span style="color:#3b6d11">Du er i forkant — bra jobbet!</span>`;
    } else if (godkjent > 0) {
      statusTekst = `<span style="color:#3b6d11">Du følger planen</span>`;
    } else {
      statusTekst = `<span style="color:#888780">Ingen innleveringer registrert ennå</span>`;
    }

    let venterHtml = '';
    if (venter > 0) {
      venterHtml = `<div style="margin-top:6px;font-size:12px;color:#5f5e5a;">
        ${venter} innlevering${venter === 1 ? '' : 'er'} venter på tilbakemelding fra læreren
      </div>`;
    }

    contentEl.innerHTML = `
      <div class="ef-stat-row">
        <div class="ef-stat">
          <div class="ef-stat-num">${godkjent}</div>
          <div class="ef-stat-lbl">av ${totalLeksjoner} leksjoner<br>med innleveringer</div>
        </div>
        ${venter > 0 ? `<div class="ef-stat">
          <div class="ef-stat-num" style="color:#b07d00">${venter}</div>
          <div class="ef-stat-lbl">venter<br>tilbakemelding</div>
        </div>` : ''}
        ${etter > 0 ? `<div class="ef-stat">
          <div class="ef-stat-num" style="color:#a32d2d">${etter}</div>
          <div class="ef-stat-lbl">leksjon${etter === 1 ? '' : 'er'}<br>på etterskudd</div>
        </div>` : ''}
      </div>
      <div style="font-size:13px;margin-bottom:4px">${statusTekst}</div>
      ${venterHtml}

      ${batterySvg ? `
      <div class="ef-section">
        <div class="ef-label">Lærestoff sett per leksjon</div>
        <div style="overflow-x:auto;padding-bottom:4px">${batterySvg}</div>
        <div class="ef-legend">
          <div class="ef-legend-item">
            <svg width="14" height="10"><rect x="1" y="2" width="6" height="8" rx="1.5" fill="url(#ef-green-legend)"/>
              <defs><linearGradient id="ef-green-legend" x1="0" x2="0" y1="1" y2="0">
                <stop offset="0%" stop-color="#97c459"/>
                <stop offset="100%" stop-color="#3b6d11"/>
              </linearGradient></defs>
            </svg>
            Lærestoff sett
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10">
              <circle cx="7" cy="5" r="3" fill="white" stroke="#3b6d11" stroke-width="0.8"/>
            </svg>
            Levert oppgave
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10">
              <circle cx="7" cy="5" r="3" fill="white" stroke="#3a3a3a" stroke-width="0.8"/>
            </svg>
            Mangler oppgave
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10">
              <circle cx="7" cy="5" r="3" fill="none" stroke="#888780" stroke-width="1.2" stroke-dasharray="2,1.5"/>
            </svg>
            Fremtidig leksjon
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10">
              <line x1="7" y1="0" x2="7" y2="10" stroke="#888780" stroke-width="0.8" stroke-dasharray="3,2"/>
            </svg>
            Nå
          </div>
        </div>
      </div>` : ''}

      <div style="margin-top:14px;font-size:10px;color:#b4b2a9;text-align:right;">
        Data fra Canvas. Oppdateres automatisk etter 1 time.
        <button onclick="localStorage.removeItem('${CACHE_KEY}'); document.getElementById('ef-backdrop').remove(); document.addEventListener('keydown', function h(e){ if(e.key==='Escape'){document.removeEventListener('keydown',h);}});"
          style="background:none;border:none;color:#888780;cursor:pointer;font-size:10px;text-decoration:underline;padding:0;margin-left:6px;">
          Oppdater nå
        </button>
      </div>
    `;
  }

  function countForan(modules, deliveredPerMod, deadlineMap) {
    const now = new Date();
    return modules.filter(mod => {
      const mid = String(mod.id);
      const due = deadlineMap[mid] || null;
      return due && due > now && (deliveredPerMod[mid] || 0) > 0;
    }).length;
  }

  function countEtter(modules, skippedPerMod, deadlineMap) {
    const now = new Date();
    return modules.filter(mod => {
      const mid = String(mod.id);
      const due = deadlineMap[mid] || null;
      return due && due <= now && (skippedPerMod[mid] || 0) > 0;
    }).length;
  }

  // ─── Batterygraffikk (frittstående, uten globale variabler) ───────────────
  function makeBatterySvgStudent(modules, skippedPerMod, deliveredPerMod, deadlineMap, modAssignCountMap) {
    const labelH = 16;
    const upH    = 55;
    const downH  = 55;
    const totalH = labelH + upH + downH;
    const midY   = labelH + upH;
    const barW   = 7;
    const gap    = 11;
    const now    = new Date();
    const n      = modules.length;
    if (n === 0) return '';
    const W = n * (barW + gap) - gap;

    const defs = `<defs>
      <linearGradient id="ef-v-green" x1="0" x2="0" y1="${midY}" y2="${labelH}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#97c459"/>
        <stop offset="100%" stop-color="#3b6d11"/>
      </linearGradient>
      <pattern id="ef-hatch" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45 0 0)">
        <line x1="0" y1="0" x2="0" y2="4" stroke="#9e9c96" stroke-width="0.8"/>
      </pattern>
    </defs>`;

    let bars = '';

    // 100%-markering
    bars += `<line x1="0" y1="${labelH + 1}" x2="${W}" y2="${labelH + 1}" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="2,3"/>`;
    // Midtlinje
    bars += `<line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="#888780" stroke-width="1"/>`;

    // Nå-linje — mellom siste passerte og første fremtidige leksjon
    let nowLineX = null;
    for (let i = 0; i < modules.length - 1; i++) {
      const dueA = deadlineMap[String(modules[i].id)] || null;
      const dueB = deadlineMap[String(modules[i + 1].id)] || null;
      if (dueA && dueA <= now && (!dueB || dueB > now)) {
        nowLineX = (i + 1) * (barW + gap) - gap / 2;
        break;
      }
    }
    if (nowLineX !== null) {
      bars += `<line x1="${nowLineX}" y1="1" x2="${nowLineX}" y2="${totalH}" stroke="#888780" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.7"/>`;
      bars += `<text x="${nowLineX}" y="3.5" font-size="6.5" fill="#888780" text-anchor="middle" dominant-baseline="hanging">Nå</text>`;
    }

    // Barer per leksjon
    modules.forEach((mod, i) => {
      const mid       = String(mod.id);
      const x         = i * (barW + gap);
      const cx        = x + barW / 2;
      const num       = i + 1;
      const due       = deadlineMap[mid] || null;
      const isPastDue = due && due <= now;
      const isStarted = mod.total > 0 && mod.completed > 0;

      // Leksjonsnummer
      bars += `<text transform="rotate(-45,${cx},${labelH / 2})" x="${cx}" y="${labelH / 2}" font-size="7" fill="#888780" text-anchor="middle" dominant-baseline="central">${num}</text>`;

      if (isStarted) {
        const pct   = mod.completed / mod.total;
        const fillH = Math.max(2, Math.round(pct * upH));
        bars += `<rect x="${x}" y="${midY - fillH}" width="${barW}" height="${fillH}" rx="2" fill="url(#ef-v-green)"/>`;
      } else if (isPastDue) {
        bars += `<rect x="${x}" y="${midY}" width="${barW}" height="${downH}" rx="2" fill="#d3d1c7"/>`;
        bars += `<rect x="${x}" y="${midY}" width="${barW}" height="${downH}" rx="2" fill="url(#ef-hatch)"/>`;
      } else {
        bars += `<rect x="${x}" y="${midY}" width="${barW}" height="${downH}" rx="2" fill="none" stroke="#c8c6be" stroke-width="1" stroke-dasharray="3,2"/>`;
      }
    });

    // Prikker over midtlinjen — leverte oppgaver
    modules.forEach((mod, i) => {
      const count = (deliveredPerMod || {})[String(mod.id)] || 0;
      if (count === 0) return;
      const cx     = i * (barW + gap) + barW / 2;
      const r      = 3;
      const dotGap = 2;
      const maxD   = Math.floor(upH / (r * 2 + dotGap));
      const dots   = Math.min(count, maxD);
      for (let d = 0; d < dots; d++) {
        const cy = midY - r - 2 - d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#3b6d11" stroke-width="0.8"/>`;
      }
    });

    // Prikker under midtlinjen — manglende oppgaver
    modules.forEach((mod, i) => {
      const count = (skippedPerMod || {})[String(mod.id)] || 0;
      if (count === 0) return;
      const cx     = i * (barW + gap) + barW / 2;
      const r      = 3;
      const dotGap = 2;
      const maxD   = Math.floor(downH / (r * 2 + dotGap));
      const dots   = Math.min(count, maxD);
      for (let d = 0; d < dots; d++) {
        const cy = midY + r + 2 + d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#3a3a3a" stroke-width="0.8"/>`;
      }
    });

    // Stiplete prikker under — fremtidige leksjoner med oppgaver
    modules.forEach((mod, i) => {
      const mid       = String(mod.id);
      const due       = deadlineMap[mid] || null;
      const isPastDue = due && due <= now;
      const isStarted = mod.total > 0 && mod.completed > 0;
      if (isPastDue || isStarted) return;
      const futureCount = modAssignCountMap[mid] || 0;
      if (futureCount === 0) return;
      const cx     = i * (barW + gap) + barW / 2;
      const r      = 3;
      const dotGap = 2;
      const maxD   = Math.floor(downH / (r * 2 + dotGap));
      const dots   = Math.min(futureCount, maxD);
      for (let d = 0; d < dots; d++) {
        const cy = midY + r + 2 + d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#888780" stroke-width="1.2" stroke-dasharray="2,1.5"/>`;
      }
    });

    return `<svg width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}"
      style="display:block;margin-top:4px;min-width:${W}px">${defs}${bars}</svg>`;
  }

})();
