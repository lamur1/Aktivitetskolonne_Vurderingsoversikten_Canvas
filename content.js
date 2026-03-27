(function () {
  'use strict';

  const DEFAULTS = {
    visible: true,
    loginGreen: 3,
    loginYellow: 10,
    submissionGreen: 7,
    submissionYellow: 21,
    lessonThreshold: 50,
    totalLessons: 15,
    rowHighlight: true
  };

  let cfg = { ...DEFAULTS };
  let studentData = {};
  let overlayEl = null;
  let tooltipEl = null;
  let tooltipFontSize = null;
  let attachedViewport = null;
  let isUpdating = false;
  let sortActive  = false;

  const COL_W = 110;

  chrome.storage.sync.get(DEFAULTS, (saved) => {
    cfg = { ...DEFAULTS, ...saved };
    waitForGradebook();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const key in changes) cfg[key] = changes[key].newValue;
    updateOverlay();
  });

  // ─── Vent på gradebook ────────────────────────────────────────────────────
  function waitForGradebook() {
    const check = () => {
      const canvas = findFrozenCanvas();
      if (canvas && canvas.querySelectorAll('.slick-row').length > 0) {
        setTimeout(init, 800);
      } else {
        setTimeout(check, 600);
      }
    };
    check();
  }

  async function init() {
    injectStyles();
    createTooltip();
    createOverlay();
    await fetchData();
    updateOverlay();
    observeChanges();
  }

  // ─── CSS ──────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('cak-styles')) return;
    const s = document.createElement('style');
    s.id = 'cak-styles';
    s.textContent = `
      #cak-overlay {
        position: absolute;
        z-index: 250;
        top: 0;
        pointer-events: none;
        overflow: visible;
        border: 1px solid #c0beb5;
        border-radius: 7px;
        box-shadow: 0 3px 12px rgba(0,0,0,0.14), 0 1px 4px rgba(0,0,0,0.07);
      }
      .cak-col-header {
        position: absolute;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #eeecea;
        border-bottom: 1px solid #c0beb5;
        box-sizing: border-box;
        font-size: 11px;
        color: #5f5e5a;
        font-family: LatoWeb, Lato, sans-serif;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
        width: 100%;
      }
      .cak-cell {
        position: absolute;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border-bottom: 0.5px solid #eceae2;
        box-sizing: border-box;
        width: 100%;
        cursor: default;
        pointer-events: all;
        padding: 0 5px;
      }
      .cak-cell-icons {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 2px 4px;
        border-radius: 7px;
        background: rgba(255, 255, 255, 0.58);
        border: 0.5px solid rgba(211, 209, 199, 0.7);
      }
      .cak-col-header:hover { background: #e6e4dc; }
      .cak-cell:hover { filter: brightness(0.96); }
      .cak-ring {
        display: inline-block;
        width: 16px; height: 16px;
        border-radius: 50%;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      .cak-ring-4 { border: 4px   solid #3b6d11; }
      .cak-ring-3 { border: 3px   solid #639922; }
      .cak-ring-2 { border: 2px   solid #97c459; }
      .cak-ring-1 { border: 1.5px solid #b4b2a9; }
      .cak-mark {
        font-size: 15px;
        font-weight: 600;
        font-family: LatoWeb, Lato, sans-serif;
        line-height: 1;
        user-select: none;
        flex-shrink: 0;
      }
      .cak-v    { color: #3b6d11; }
      .cak-dash { color: #888780; }
      .cak-x    { color: #a32d2d; }
      #cak-tooltip {
        position: fixed;
        background: #fff;
        border: 0.5px solid #b4b2a9;
        border-radius: 6px;
        padding: 6px 11px;
        font-size: 11px;
        color: #5f5e5a;
        font-family: LatoWeb, Lato, sans-serif;
        white-space: nowrap;
        z-index: 9999;
        pointer-events: none;
        display: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        line-height: 1.8;
      }
    `;
    document.head.appendChild(s);
  }

  // ─── Tooltip ──────────────────────────────────────────────────────────────
  function createTooltip() {
    if (document.getElementById('cak-tooltip')) return;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'cak-tooltip';
    document.body.appendChild(tooltipEl);
  }
  function showTip(e, html, fontSize) {
    tooltipEl.innerHTML = html;
    if (fontSize) tooltipEl.style.fontSize = fontSize;
    tooltipEl.style.display = 'block';
    moveTip(e);
  }
  function moveTip(e) {
    tooltipEl.style.left = (e.clientX + 14) + 'px';
    tooltipEl.style.top  = (e.clientY - 38) + 'px';
  }
  function hideTip() { tooltipEl.style.display = 'none'; }

  // ─── Overlay ──────────────────────────────────────────────────────────────
  function createOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'cak-overlay';
    document.body.appendChild(overlayEl);
  }

  function attachOverlayToViewport(frozenCanvas) {
    const viewport = frozenCanvas.parentElement;
    if (!viewport || viewport === attachedViewport) return;
    if (getComputedStyle(viewport).position === 'static') {
      viewport.style.position = 'relative';
    }
    viewport.appendChild(overlayEl);
    attachedViewport = viewport;
  }

  // ─── Hent data fra Canvas API (med lokal cache) ───────────────────────────
  async function fetchData(forceRefresh = false) {
    const courseId = getCourseId();
    if (!courseId) return;

    const cacheKey  = `cak_data_${courseId}`;
    const cacheTime = 60 * 60 * 1000; // 1 time

    // Sjekk cache først
    if (!forceRefresh) {
      try {
        const cached = await new Promise(res =>
          chrome.storage.local.get(cacheKey, r => res(r[cacheKey]))
        );
        if (cached && (Date.now() - cached.ts) < cacheTime) {
          studentData = cached.data;
          updateCacheStatus(new Date(cached.ts));
          return;
        }
      } catch (e) {}
    }

    try {
      // Hent enrollments, submissions, assignments og moduler parallelt
      const [enrollments, submissions, assignments, modules] = await Promise.all([
        paginate(`/api/v1/courses/${courseId}/enrollments` +
          `?type[]=StudentEnrollment&include[]=last_activity_at&per_page=100`),
        paginate(`/api/v1/courses/${courseId}/students/submissions` +
          `?student_ids[]=all&per_page=100`),
        paginate(`/api/v1/courses/${courseId}/assignments?per_page=100`),
        paginate(`/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`)
      ]);

      // Bygg sett med assignment-IDer som faktisk ligger i moduler
      const moduleAssignmentIds = new Set();
      modules.forEach(mod => {
        (mod.items || []).forEach(item => {
          if (item.type === 'Assignment' || item.type === 'Quiz') {
            moduleAssignmentIds.add(String(item.content_id));
          }
        });
      });

      // Bygg oppslag: kun assignments som er i moduler
      const assignmentMap = {};
      assignments.forEach(a => {
        if (moduleAssignmentIds.has(String(a.id))) {
          assignmentMap[a.id] = a;
        }
      });

      const hasAnyDeadlines = Object.values(assignmentMap).some(a => a.due_at);

      // Innloggingsaktivitet
      enrollments.forEach((e) => {
        const sid = String(e.user_id);
        if (!studentData[sid]) studentData[sid] = {};
        studentData[sid].lastActivity = e.last_activity_at
          ? new Date(e.last_activity_at) : null;
      });

      // Grupper submissions per elev
      const byStudent = {};
      submissions.forEach((s) => {
        const sid = String(s.user_id);
        if (!byStudent[sid]) byStudent[sid] = [];
        byStudent[sid].push(s);
      });

      Object.entries(byStudent).forEach(([sid, subs]) => {
        if (!studentData[sid]) studentData[sid] = {};

        // Siste innlevering
        const submitted = subs.filter(s => s.submitted_at);
        if (submitted.length) {
          const latest = submitted.reduce((a, b) =>
            new Date(a.submitted_at) > new Date(b.submitted_at) ? a : b);
          studentData[sid].lastSubmission = new Date(latest.submitted_at);
        }

        // ── Leksjonsbasert fremdrift (kun modul-oppgaver) ─────────────────
        const lessons = {};
        Object.values(assignmentMap).forEach((asgn) => {
          if (!asgn.due_at) return; // frivillige (ingen frist) teller aldri

          const m      = (asgn.name || '').match(/L\s*(\d+)/i);
          const lesson = m ? m[1] : '__ukjent__';
          if (!lessons[lesson]) lessons[lesson] = { total: 0, delivered: 0, missing: 0, ahead: 0, fullfort: 0, venter: 0 };
          lessons[lesson].total++;

          const sub = subs.find(s => String(s.assignment_id) === String(asgn.id));
          const now = Date.now();
          const due = new Date(asgn.due_at);

          if (sub && sub.submitted_at) {
            lessons[lesson].delivered++;
            const isFullfort = !!(
              sub.workflow_state === 'graded' ||
              sub.workflow_state === 'complete' ||
              sub.graded_at
            );
            if (isFullfort) lessons[lesson].fullfort++;
            else lessons[lesson].venter++;
            if (due > now) lessons[lesson].ahead++;
          } else if (sub && sub.missing) {
            lessons[lesson].missing++;
          }
        });

        let netDelta     = 0;
        let hasAnyLesson = false;
        let godkjent     = 0;
        let venterVurdering = 0;
        let totalt       = 0;
        const threshold  = (cfg.lessonThreshold || 50) / 100;

        Object.entries(lessons).forEach(([key, l]) => {
          if (l.total === 0) return;
          if (l.delivered === 0 && l.missing === 0) return;
          if (key === '__ukjent__') return;
          hasAnyLesson = true;
          totalt++;
          const completion = l.delivered / l.total;
          const completionFullfort = l.fullfort / l.total;
          if (completionFullfort >= threshold) {
            godkjent++;
          }
          venterVurdering += l.venter || 0;
          if (completion >= threshold) {
            if (l.ahead > 0) netDelta += 1;
          } else {
            netDelta -= 1;
          }
        });

        if (hasAnyLesson) {
          studentData[sid].deadlineDelta  = netDelta;
          studentData[sid].deadlineCount  = totalt;
          studentData[sid].godkjent       = godkjent;
          studentData[sid].venterVurdering = venterVurdering;
          studentData[sid].totalt         = cfg.totalLessons || 15;
        } else if (hasAnyDeadlines) {
          studentData[sid].deadlineDelta = null;
          studentData[sid].hasDeadlines  = true;
        }
      });

      // Lagre i lokal cache med tidsstempel
      const courseId2 = getCourseId();
      if (courseId2) {
        chrome.storage.local.set({
          [`cak_data_${courseId2}`]: { ts: Date.now(), data: studentData }
        });
      }
      updateCacheStatus(new Date());

    } catch (err) {
      console.warn('[Canvas Aktivitetskolonne] Feil ved henting av data:', err);
    }
  }

  async function paginate(url) {
    let results = [];
    let next = url;
    while (next) {
      const resp = await fetch(next, { credentials: 'include' });
      if (!resp.ok) break;
      results = results.concat(await resp.json());
      const link = resp.headers.get('Link') || '';
      const m = link.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return results;
  }

  // ─── Tegn overlay ─────────────────────────────────────────────────────────
  function updateOverlay() {
    if (!overlayEl || isUpdating) return;
    isUpdating = true;
    overlayEl.innerHTML = '';

    try {
      if (!cfg.visible) return;

      const frozenCanvas = findFrozenCanvas();
      if (!frozenCanvas) { setTimeout(updateOverlay, 800); return; }

      const rows = frozenCanvas.querySelectorAll('.slick-row');
      if (!rows.length) { setTimeout(updateOverlay, 500); return; }

      attachOverlayToViewport(frozenCanvas);

      const firstCell = rows[0].querySelector('.slick-cell');
      if (!firstCell) return;
      const colWidth  = firstCell.offsetWidth;
      const rowHeight = rows[0].offsetHeight || 35;

      if (!tooltipFontSize) {
        const sampleNameEl =
          rows[0].querySelector('a[href*="/users/"]') ||
          rows[0].querySelector('a[href*="/grades/"]') ||
          rows[0].querySelector('.slick-cell') ||
          null;
        const cs = sampleNameEl ? getComputedStyle(sampleNameEl) : null;
        tooltipFontSize = cs && cs.fontSize ? cs.fontSize : null;
      }

      // Høyde: finn laveste faktiske rad-posisjon
      let maxBottom = 0;
      rows.forEach(r => {
        const top = parseInt(r.style.top, 10) || 0;
        const h   = r.offsetHeight || rowHeight;
        if (top + h > maxBottom) maxBottom = top + h;
      });
      overlayEl.style.left   = (colWidth - COL_W - 10) + 'px';
      overlayEl.style.width  = COL_W + 'px';
      overlayEl.style.height = maxBottom + 'px';

      // Header
      const header = findFrozenHeader();
      if (header) {
        const viewport = frozenCanvas.parentElement;
        const vRect    = viewport.getBoundingClientRect();
        const hRect    = header.getBoundingClientRect();
        const relTop   = hRect.top - vRect.top + viewport.scrollTop;
        const hCell    = document.createElement('div');
        hCell.className   = 'cak-col-header';
        hCell.style.top    = relTop + 'px';
        hCell.style.height = hRect.height + 'px';
        hCell.style.cursor = 'pointer';
        hCell.style.pointerEvents = 'all';
        hCell.innerHTML = sortActive
          ? 'Prioritet <span style="font-size:10px;margin-left:2px;">↑</span>'
          : 'Aktivitet';
        hCell.title = sortActive
          ? 'Klikk for å tilbakestille sortering'
          : 'Klikk for å sortere etter oppfølgingsbehov';
        hCell.addEventListener('click', toggleSort);
        overlayEl.appendChild(hCell);
      }

      // Bygg liste over synlige rader med posisjon og student-ID
      const rowItems = [];
      rows.forEach((row) => {
        const sid    = extractStudentId(row);
        const rowTop = parseInt(row.style.top, 10) || 0;
        rowItems.push({ sid, rowTop, row });
      });

      // Hvis sortering er aktiv: sorter elevene etter prioritetspoeng
      // men behold Canvas sine opprinnelige top-posisjoner som "slots"
      let displayOrder = [...rowItems];
      if (sortActive) {
        const slots = rowItems.map(r => r.rowTop).sort((a, b) => a - b);
        const sorted = [...rowItems].sort((a, b) => {
          const sa = a.sid ? priorityScore(a.sid) : 99999;
          const sb = b.sid ? priorityScore(b.sid) : 99999;
          return sb - sa;
        });
        displayOrder = sorted.map((item, i) => ({
          ...item,
          rowTop: slots[i]
        }));
      }

      // Tegn celler
      displayOrder.forEach(({ sid, rowTop, row }) => {

        const cell       = document.createElement('div');
        cell.className   = 'cak-cell';
        cell.style.top   = rowTop + 'px';
        cell.style.height = rowHeight + 'px';

        // Bakgrunnsfarge fra første celle i raden (zebrastriper, markeringer)
        const firstRowCell = row.querySelector('.slick-cell');
        const rowBg = firstRowCell
          ? getComputedStyle(firstRowCell).backgroundColor
          : getComputedStyle(row).backgroundColor;

        // Aktivitetskolonnen skal være transparent slik at underlaget vises.
        cell.style.background = 'transparent';

        if (sid) {
          const data       = studentData[sid] || {};
          const loginDays  = daysSince(data.lastActivity);
          const subDays    = daysSince(data.lastSubmission);
          const delta      = data.deadlineDelta;

          // Trafikklys-tint legges på underliggende navnecelle (ikke ikon-cellen).
          // Slik bevares ikonfarger og uttrykket blir svært diskret.
          const tint = cfg.rowHighlight
            ? activityCellTint(delta, data.hasDeadlines)
            : null;
          if (firstRowCell) firstRowCell.style.backgroundColor = tint || '';

          const ring     = document.createElement('span');
          ring.className = 'cak-ring ' + ringClass(loginDays);

          const mark       = document.createElement('span');
          mark.className   = 'cak-mark ' + markClass(subDays);
          mark.textContent = markChar(subDays);

          const tlWrap = document.createElement('div');
          tlWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;background:#f5f4ee;border:0.5px solid #d3d1c7;border-radius:5px;padding:2px 4px;height:22px;flex-shrink:0';
          tlWrap.appendChild(makeTimelineSvg(delta, data.hasDeadlines));

          const iconsWrap = document.createElement('div');
          iconsWrap.className = 'cak-cell-icons';
          iconsWrap.appendChild(ring);
          iconsWrap.appendChild(mark);
          iconsWrap.appendChild(tlWrap);
          cell.appendChild(iconsWrap);

          const tipHtml = buildTooltip(
            loginDays,
            subDays,
            delta,
            data.deadlineCount,
            data.godkjent,
            data.venterVurdering,
            data.totalt
          );
          cell.addEventListener('mouseenter', (e) => showTip(e, tipHtml, tooltipFontSize));
          cell.addEventListener('mousemove',  moveTip);
          cell.addEventListener('mouseleave', hideTip);
        }

        overlayEl.appendChild(cell);
      });

    } finally {
      // Frigjør guard asynkront — etter at nåværende DOM-flush er ferdig
      setTimeout(() => { isUpdating = false; }, 0);
    }
  }

  // ─── Tidslinje SVG ────────────────────────────────────────────────────────
  function makeTimelineSvg(delta, hasDeadlines) {
    const W = 40, H = 16, mid = W / 2;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.flexShrink = '0';

    // Horisontal linje
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '2');
    line.setAttribute('y1', '8');
    line.setAttribute('x2', String(W - 2));
    line.setAttribute('y2', '8');
    line.setAttribute('stroke', '#d3d1c7');
    line.setAttribute('stroke-width', '1.5');
    svg.appendChild(line);

    // Loddrett frist-strek
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    tick.setAttribute('x', String(mid - 1.2));
    tick.setAttribute('y', '2');
    tick.setAttribute('width', '2.4');
    tick.setAttribute('height', '12');
    tick.setAttribute('rx', '1');
    tick.setAttribute('fill', (delta === undefined && !hasDeadlines) ? '#e0dfd8' : '#888780');
    svg.appendChild(tick);

    if (delta === undefined && !hasDeadlines) {
      // Ingen frister satt i kurset — stiplet sirkel
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', String(mid));
      c.setAttribute('cy', '8');
      c.setAttribute('r', '4.5');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', '#c8c6be');
      c.setAttribute('stroke-width', '1.5');
      c.setAttribute('stroke-dasharray', '2.5,2');
      svg.appendChild(c);
      return svg;
    }

    if (delta === null) {
      // Har frister men ikke levert — prikk ytterst til venstre, rød
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', '4');
      c.setAttribute('cy', '8');
      c.setAttribute('r', '4.5');
      c.setAttribute('fill', '#a32d2d');
      svg.appendChild(c);
      return svg;
    }

    // Proporsjonal posisjon: klemmer til [-21, +21] dager
    const clamped   = Math.max(-5, Math.min(5, delta));
    const halfRange = (W / 2) - 5;
    const x         = mid + (clamped / 5) * halfRange;

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(Math.round(x)));
    dot.setAttribute('cy', '8');
    dot.setAttribute('r', '4.5');
    dot.setAttribute('fill', dotColor(delta));
    svg.appendChild(dot);

    return svg;
  }

  function dotColor(delta) {
    if (delta === null || delta === undefined) return '#a32d2d';
    if (delta >= 1)  return '#3b6d11'; // foran — minst én leksjon foran
    if (delta === 0) return '#639922'; // i rute
    if (delta >= -2) return '#ba7517'; // litt etter
    return '#a32d2d';                  // klart etter
  }

  function activityCellTint(delta, hasDeadlines) {
    // Ingen frister i kurset → ingen trafikklys-farge
    if (delta === undefined && !hasDeadlines) return null;
    // Har frister men ikke levert / mangler grunnlag → rød
    if (delta === null || delta === undefined) return 'rgba(198, 40, 40, 0.20)';

    // Marker kun elever som er etter med leksjoner.
    // 2 etter -> grønn, 3 etter -> gul, 4+ etter -> rød.
    if (delta >= 0)  return null;
    if (delta === -2) return 'rgba(46, 125, 50, 0.18)';
    if (delta === -3) return 'rgba(251, 192, 45, 0.20)';
    return 'rgba(198, 40, 40, 0.23)';
  }

  // ─── DOM-selektorer ───────────────────────────────────────────────────────
  function findFrozenCanvas() {
    const candidates = [
      '.slick-viewport.slick-viewport-bottom.slick-viewport-left .grid-canvas',
      '.slick-viewport.slick-viewport-top.slick-viewport-left .grid-canvas',
      '.container_0 .slick-viewport .grid-canvas',
      '.grid-canvas-left',
      '.grid-canvas'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.querySelector('.slick-row')) return el;
    }
    return null;
  }

  function findFrozenHeader() {
    const candidates = [
      '.slick-header.slick-header-left',
      '.container_0 .slick-header',
      '.slick-header-left',
      '.slick-header'
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function extractStudentId(row) {
    const gradesLink = row.querySelector('a[href*="/grades/"]');
    if (gradesLink) {
      const m = gradesLink.href.match(/\/grades\/(\d+)/);
      if (m) return m[1];
    }
    const usersLink = row.querySelector('a[href*="/users/"]');
    if (usersLink) {
      const m = usersLink.href.match(/\/users\/(\d+)/);
      if (m) return m[1];
    }
    return row.getAttribute('data-student-id') || null;
  }

  // ─── Hjelpere ─────────────────────────────────────────────────────────────
  function daysSince(date) {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  function ringClass(days) {
    if (days === null)           return 'cak-ring-1';
    if (days <= cfg.loginGreen)  return 'cak-ring-4';
    if (days <= cfg.loginYellow) return 'cak-ring-3';
    if (days <= 21)              return 'cak-ring-2';
    return 'cak-ring-1';
  }

  function markClass(days) {
    if (days === null)                return 'cak-x';
    if (days <= cfg.submissionGreen)  return 'cak-v';
    if (days <= cfg.submissionYellow) return 'cak-dash';
    return 'cak-x';
  }

  function markChar(days) {
    if (days === null)                return '✗';
    if (days <= cfg.submissionGreen)  return '✓';
    if (days <= cfg.submissionYellow) return '–';
    return '✗';
  }

  function buildTooltip(loginDays, subDays, delta, count, godkjent, venterVurdering, totalt) {
    const l = loginDays === null
      ? 'Aldri innlogget'
      : `Innlogget: ${loginDays} dag${loginDays === 1 ? '' : 'er'} siden`;
    const s = subDays === null
      ? 'Aldri innlevert'
      : `Innlevert: ${subDays} dag${subDays === 1 ? '' : 'er'} siden`;
    let d = 'Ingen frister i kurset';
    if (delta === null) {
      d = 'Har frister — ikke levert';
    } else if (delta !== undefined) {
      const terskel = cfg.lessonThreshold || 50;
      if (totalt > 0) {
        const pending = venterVurdering || 0;
        const pendingWord = pending === 1 ? 'innlevering' : 'innleveringer';
        d = `${godkjent} av ${totalt} leksjoner Fullført · Terskel: ${terskel}%` +
          `<br>${pending} ${pendingWord} venter vurdering`;
        if (delta > 0) {
          const leks = delta === 1 ? '1 leksjon' : `${delta} leksjoner`;
          d += `<br>I forkant — levert i ${leks} med fremtidig frist`;
        }
      } else {
        d = 'I rute — ingen leksjoner under terskel';
      }
    }
    return `${l}<br>${s}<br>${d}`;
  }

  function updateCacheStatus(date) {
    chrome.storage.local.set({ cak_last_updated: date.getTime() });
  }

  function getCourseId() {
    const m = location.pathname.match(/\/courses\/(\d+)/);
    return m ? m[1] : null;
  }

  // ─── Sortering ────────────────────────────────────────────────────────────
  function toggleSort() {
    sortActive = !sortActive;
    updateOverlay();
  }

  function priorityScore(sid) {
    const data = studentData[sid];
    if (!data) return 99999;
    const login = daysSince(data.lastActivity);
    const sub   = daysSince(data.lastSubmission);
    const delta = data.deadlineDelta;
    const loginScore = (login === null ? 60 : login) * 1.0;
    const subScore   = (sub   === null ? 60 : sub)   * 1.5;
    const deadScore  = (delta === null ? 30 :
                        delta === undefined ? 0 :
                        Math.max(0, -delta)) * 2.0;
    return loginScore + subScore + deadScore;
  }

  // ─── Observer — ignorerer egne DOM-endringer ──────────────────────────────
  function observeChanges() {
    const debouncedUpdate = debounce(() => {
      if (!isUpdating) updateOverlay();
    }, 150);

    // Observer på Canvas sin grid — ikke på hele body
    const gridRoot = document.querySelector(
      '#gradebook_grid, .Gradebook__GradebookBody, #application'
    ) || document.body;

    new MutationObserver((mutations) => {
      const fromUs = mutations.every(m =>
        overlayEl && (overlayEl.contains(m.target) || m.target === overlayEl)
      );
      if (!fromUs) {
        debouncedUpdate();
      }
    }).observe(gridRoot, { childList: true, subtree: true, attributes: false });

    document.querySelectorAll('.slick-viewport').forEach((vp) => {
      vp.addEventListener('scroll', debouncedUpdate, { passive: true });
    });
    window.addEventListener('scroll', debouncedUpdate, { passive: true });
    window.addEventListener('resize', debouncedUpdate, { passive: true });
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

})();
