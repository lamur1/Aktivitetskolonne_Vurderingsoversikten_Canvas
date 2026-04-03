(function () {
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

  let cfg = { ...DEFAULTS };
  let studentData = {};
  let overlayEl = null;
  let tooltipEl = null;
  let tooltipFontSize = null;
  let lastTipEvent = null;
  let attachedViewport = null;
  let isUpdating = false;
  let sortActive  = false;
  let cellCache      = new Map(); // sid -> cak-cell element
  let headerCellEl   = null;
  let loadingBarEl   = null;
  let isLoading      = false;
  let moduleCompletionCache = {}; // sid -> [{id, name, total, completed}] | false
  let moduleDeadlineMap     = {}; // modId -> latest due_at Date | null
  let currentHoverSid = null;

  const COL_W = 130;

  chrome.storage.sync.get(DEFAULTS, (saved) => {
    cfg = { ...DEFAULTS, ...saved };
    waitForGradebook();
  });

  chrome.storage.onChanged.addListener((changes) => {
    for (const key in changes) cfg[key] = changes[key].newValue;
    invalidateCache();
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
    invalidateCache();
    updateOverlay();
    observeChanges();
    // Canvas fortsetter å justere grid etter init — forsinkede re-renders fanger dette
    setTimeout(updateOverlay, 1500);
    setTimeout(updateOverlay, 4000);
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
      .cak-cell:hover {
        background: rgba(59, 109, 17, 0.08) !important;
        box-shadow: inset 3px 0 0 #3b6d11;
      }
      .cak-ring {
        display: inline-block;
        width: 18px; height: 18px;
        border-radius: 50%;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      /* Fylt sirkel = nylig innlogget → tom ring = lenge siden. Redundant koding: fyllgrad + kanttykkelse */
      .cak-ring-4 { background: #639922; border: 2px solid #3b6d11; }
      .cak-ring-3 { background: conic-gradient(#639922 0deg 270deg, #dddbd3 270deg 360deg); border: 1.5px solid #b4b2a9; }
      .cak-ring-2 { background: conic-gradient(#97c459 0deg 180deg, #dddbd3 180deg 360deg); border: 1px solid #b4b2a9; }
      .cak-ring-1 { background: #dddbd3; border: 0.75px solid #b4b2a9; }
      .cak-mark {
        display: inline-block;
        width: 14px;
        height: 14px;
        border-radius: 2px;
        box-sizing: border-box;
        flex-shrink: 0;
      }
      /* Fylt firkant = nylig levert → tom firkant = lenge siden / aldri */
      .cak-v    { background: #639922; border: 1.5px solid #3b6d11; }
      .cak-dash { background: linear-gradient(90deg, #888780 50%, #e8e6de 50%); border: 1px solid #b4b2a9; }
      .cak-x    { background: rgba(198, 40, 40, 0.10); border: 1.5px solid #a32d2d; }
      .cak-loading-bar {
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        bottom: 0;
        z-index: 10;
        overflow: hidden;
        border-radius: 1px;
      }
      .cak-loading-bar::after {
        content: '';
        position: absolute;
        top: -40%;
        left: 0;
        width: 100%;
        height: 40%;
        background: linear-gradient(180deg, transparent, #3b6d11, #639922, transparent);
        animation: cak-sweep 1.4s ease-in-out infinite;
      }
      @keyframes cak-sweep {
        0%   { top: -40%; }
        100% { top: 100%; }
      }
      #cak-tooltip {
        position: fixed;
        background: #fff;
        border: 0.5px solid #b4b2a9;
        border-radius: 6px;
        padding: 6px 11px 10px;
        font-size: 11px;
        color: #5f5e5a;
        font-family: LatoWeb, Lato, sans-serif;
        white-space: nowrap;
        z-index: 9999;
        pointer-events: none;
        display: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        line-height: 1.8;
        min-width: 180px;
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
    lastTipEvent = e;
    moveTip(e);
  }
  function moveTip(e) {
    const tipH = tooltipEl.offsetHeight;
    const tipW = tooltipEl.offsetWidth;
    const top  = e.clientY - tipH - 8;
    const left = (e.clientX + 14 + tipW > window.innerWidth)
      ? e.clientX - tipW - 14
      : e.clientX + 14;
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top  = top  + 'px';
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
    if (forceRefresh) moduleCompletionCache = {};

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
      isLoading = true;

      // Fase 1: rask data — vis ringer med en gang
      const [enrollments, assignments, modules] = await Promise.all([
        paginate(`/api/v1/courses/${courseId}/enrollments` +
          `?type[]=StudentEnrollment&include[]=last_activity_at&per_page=100`),
        paginate(`/api/v1/courses/${courseId}/assignments?per_page=100`),
        paginate(`/api/v1/courses/${courseId}/modules?include[]=items&per_page=100`)
      ]);

      enrollments.forEach((e) => {
        const sid = String(e.user_id);
        if (!studentData[sid]) studentData[sid] = {};
        studentData[sid].lastActivity = e.last_activity_at
          ? new Date(e.last_activity_at) : null;
      });
      invalidateCache();
      updateOverlay(); // Vis ringer umiddelbart — indikator vises i hodet

      // Fase 2: innleveringer (tung) — fullfør datagrunnlaget
      const submissions = await paginate(`/api/v1/courses/${courseId}/students/submissions` +
        `?student_ids[]=all&per_page=100`);

      processStudentData(enrollments, submissions, assignments, modules);
      isLoading = false;
      invalidateCache();
      updateOverlay();

      const courseId2 = getCourseId();
      if (courseId2) {
        chrome.storage.local.set({
          [`cak_data_${courseId2}`]: { ts: Date.now(), data: studentData }
        });
      }
      updateCacheStatus(new Date());

    } catch (err) {
      isLoading = false;
      console.warn('[Canvas Aktivitetskolonne] Feil ved henting av data:', err);
    }
  }

  function processStudentData(enrollments, submissions, assignments, modules) {
    // Oppslag-kart: assignment-ID og discussion-ID → assignment
    const assignmentById = {};
    const discussionIdToAssignment = {};
    assignments.forEach(a => {
      assignmentById[String(a.id)] = a;
      if (a.discussion_topic) {
        discussionIdToAssignment[String(a.discussion_topic.id)] = a;
      }
    });

    // Bygg moduleMap: modId → [assignment, ...] — inkluderer oppgaver, NQ og diskusjoner
    const moduleMap = {};
    const moduleAssignmentIds = new Set();
    modules.forEach(mod => {
      const modAssignments = [];
      (mod.items || []).forEach(item => {
        let asgn = null;
        if (item.type === 'Assignment' || item.type === 'Quiz') {
          asgn = assignmentById[String(item.content_id)];
        } else if (item.type === 'Discussion') {
          asgn = discussionIdToAssignment[String(item.content_id)];
        }
        if (asgn && asgn.published !== false) {
          moduleAssignmentIds.add(String(asgn.id));
          modAssignments.push(asgn);
        }
      });
      if (modAssignments.length > 0) {
        moduleMap[String(mod.id)] = modAssignments;
      }
    });

    const hasAnyDeadlines = [...moduleAssignmentIds].some(id => assignmentById[id]?.due_at);

    // Bygg modId -> seneste due_at for stiplet visning av fremtidige leksjoner
    moduleDeadlineMap = {};
    Object.entries(moduleMap).forEach(([modId, assignments]) => {
      const dates = assignments.map(a => a.due_at ? new Date(a.due_at) : null).filter(Boolean);
      moduleDeadlineMap[modId] = dates.length > 0 ? new Date(Math.max(...dates)) : null;
    });

    enrollments.forEach((e) => {
      const sid = String(e.user_id);
      if (!studentData[sid]) studentData[sid] = {};
      studentData[sid].lastActivity = e.last_activity_at
        ? new Date(e.last_activity_at) : null;
    });

    const byStudent = {};
    submissions.forEach((s) => {
      const sid = String(s.user_id);
      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(s);
    });

    Object.entries(byStudent).forEach(([sid, subs]) => {
      if (!studentData[sid]) studentData[sid] = {};

      // Siste innlevering — graded_at som fallback for LTI (New Quizzes)
      const submitted = subs.filter(s => s.submitted_at || s.graded_at);
      if (submitted.length) {
        const latest = submitted.reduce((a, b) => {
          const da = new Date(a.submitted_at || a.graded_at);
          const db = new Date(b.submitted_at || b.graded_at);
          return da > db ? a : b;
        });
        studentData[sid].lastSubmission = new Date(latest.submitted_at || latest.graded_at);
      }

      // Gruppert per modul (leksjon) — én modul = én leksjon
      const lessons = {};
      let hoppetOver = 0;
      const skippedPerMod = {};
      Object.entries(moduleMap).forEach(([modId, modAssignments]) => {
        modAssignments.forEach(asgn => {
          if (!asgn.due_at) return;
          if (!lessons[modId]) lessons[modId] = { total: 0, delivered: 0, missing: 0, ahead: 0, fullfort: 0, venter: 0, pastDue: 0 };
          lessons[modId].total++;

          const sub = subs.find(s => String(s.assignment_id) === String(asgn.id));
          const now = Date.now();
          const due = new Date(asgn.due_at);

          if (due <= now) lessons[modId].pastDue++;

          // Felles mangler-sjekk: Canvas sin missing-status er autoritativ.
          // Dekker både automatisk (frist passert) og manuelt (underkjent av lærer).
          const isExcused = sub?.workflow_state === 'excused';
          const isMissing = !isExcused && (
            (sub && sub.missing === true) ||
            (!sub && due <= now)           // defensiv fallback: ingen sub-objekt
          );

          if (!isMissing && sub && (sub.submitted_at || sub.graded_at)) {
            lessons[modId].delivered++;
            const isGraded = !!(
              sub.workflow_state === 'graded' ||
              sub.workflow_state === 'complete' ||
              sub.graded_at
            );
            const graderId = sub.grader_id;
            const isFullfort = isGraded && (
              cfg.gradingMode === 'both'  ? true :
              cfg.gradingMode === 'auto'  ? Number(graderId) < 0 :
              /* teacher (default) */       Number(graderId) > 0
            );
            if (isFullfort) lessons[modId].fullfort++;
            if (!isGraded)  lessons[modId].venter++;
            if (due > now)  lessons[modId].ahead++;
          } else if (isMissing) {
            lessons[modId].missing++;
            hoppetOver++;
            skippedPerMod[modId] = (skippedPerMod[modId] || 0) + 1;
          }
        });
      });

      let netDelta     = 0;
      let hasAnyLesson = false;
      let godkjent     = 0;
      let venterVurdering = 0;
      let totalt       = 0;
      let leksjonerMedPassertFrist = 0;
      let godkjentAvPasserte = 0;
      const threshold  = (cfg.lessonThreshold || 50) / 100;

      Object.values(lessons).forEach(l => {
        if (l.total === 0) return;
        const completionFullfort = l.fullfort / l.total;

        if (l.pastDue > 0) {
          leksjonerMedPassertFrist++;
          if (completionFullfort >= threshold) godkjentAvPasserte++;
        }

        if (l.delivered === 0 && l.missing === 0) return;
        hasAnyLesson = true;
        totalt++;
        const completion = l.delivered / l.total;
        if (completionFullfort >= threshold) godkjent++;
        venterVurdering += l.venter || 0;
        if (completionFullfort >= threshold) {
          if (l.ahead > 0) netDelta += 1;
        } else {
          netDelta -= 1;
        }
      });

      const leksjonerEtter = leksjonerMedPassertFrist > 0
        ? Math.max(0, leksjonerMedPassertFrist - godkjentAvPasserte)
        : null;

      if (hasAnyLesson) {
        studentData[sid].deadlineDelta   = netDelta;
        studentData[sid].deadlineCount   = totalt;
        studentData[sid].godkjent        = godkjent;
        studentData[sid].leksjonerEtter  = leksjonerEtter;
        studentData[sid].venterVurdering = venterVurdering;
        studentData[sid].hoppetOver      = hoppetOver;
        studentData[sid].skippedPerMod   = skippedPerMod;
        studentData[sid].totalt          = 15;
      } else if (hasAnyDeadlines) {
        studentData[sid].deadlineDelta = null;
        studentData[sid].hasDeadlines  = true;
      }
    });
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

  // ─── Cache-invalidering ───────────────────────────────────────────────────
  function invalidateCache() {
    for (const cell of cellCache.values()) cell.remove();
    cellCache.clear();
    if (headerCellEl) { headerCellEl.remove(); headerCellEl = null; }
  }

  // ─── Tegn overlay (smart diff — gjenbruker eksisterende celler) ───────────
  function updateOverlay() {
    if (!overlayEl || isUpdating) return;
    isUpdating = true;

    requestAnimationFrame(() => {
      try {
        if (!cfg.visible) {
          overlayEl.style.display = 'none';
          document.querySelectorAll('.slick-row').forEach(row => {
            const firstCell = row.querySelector('.slick-cell');
            if (firstCell) firstCell.style.backgroundColor = '';
          });
          return;
        }
        overlayEl.style.display = '';

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
        overlayEl.style.left   = (colWidth - COL_W - 4) + 'px';
        overlayEl.style.width  = COL_W + 'px';
        overlayEl.style.height = maxBottom + 'px';

        // Laste-indikator øverst i kolonnen
        if (isLoading && !loadingBarEl) {
          loadingBarEl = document.createElement('div');
          loadingBarEl.className = 'cak-loading-bar';
          overlayEl.appendChild(loadingBarEl);
        } else if (!isLoading && loadingBarEl) {
          loadingBarEl.remove();
          loadingBarEl = null;
        }

        // Header — opprett én gang, oppdater kun posisjon og tekst
        const header = findFrozenHeader();
        if (header) {
          const viewport = frozenCanvas.parentElement;
          const vRect    = viewport.getBoundingClientRect();
          const hRect    = header.getBoundingClientRect();
          const relTop   = hRect.top - vRect.top + viewport.scrollTop;

          if (!headerCellEl) {
            headerCellEl = document.createElement('div');
            headerCellEl.className        = 'cak-col-header';
            headerCellEl.style.cursor     = 'pointer';
            headerCellEl.style.pointerEvents = 'all';
            headerCellEl.addEventListener('click', toggleSort);
            overlayEl.appendChild(headerCellEl);
          }
          headerCellEl.style.top    = relTop + 'px';
          headerCellEl.style.height = hRect.height + 'px';
          headerCellEl.innerHTML = sortActive
            ? 'Prioritet <span style="font-size:10px;margin-left:2px;">↑</span>'
            : 'Aktivitet';
          headerCellEl.title = sortActive
            ? 'Klikk for å tilbakestille sortering'
            : 'Klikk for å sortere etter oppfølgingsbehov';
        }

        // Bygg liste over synlige rader med posisjon og student-ID
        const rowItems = [];
        rows.forEach((row) => {
          const sid    = extractStudentId(row);
          const rowTop = parseInt(row.style.top, 10) || 0;
          rowItems.push({ sid, rowTop, row });
        });

        // Hvis sortering er aktiv: sorter etter prioritetspoeng men behold Canvas-slots
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

        // Smart diff: flytt eksisterende celler, opprett nye, fjern foreldreløse
        const activeSids = new Set();

        displayOrder.forEach(({ sid, rowTop, row }) => {
          const key = sid || ('__row__' + rowTop);
          activeSids.add(key);

          // Trafikklys-tint på navnecellen — alltid oppdatert (kun repaint, ikke reflow)
          const firstRowCell = row.querySelector('.slick-cell');
          if (sid && firstRowCell) {
            const data = studentData[sid] || {};
            const tint = cfg.rowHighlight
              ? activityCellTint(data.leksjonerEtter, data.hasDeadlines)
              : null;
            firstRowCell.style.backgroundColor = tint || '';
          }

          if (cellCache.has(key)) {
            // Bare oppdater posisjon — ingen ny DOM-bygging
            const cached = cellCache.get(key);
            cached.style.top    = rowTop + 'px';
            cached.style.height = rowHeight + 'px';
          } else {
            // Bygg ny celle
            const cell       = document.createElement('div');
            cell.className   = 'cak-cell';
            cell.style.top   = rowTop + 'px';
            cell.style.height = rowHeight + 'px';
            cell.style.background = 'transparent';

            if (sid) {
              const data      = studentData[sid] || {};
              const loginDays = daysSince(data.lastActivity);
              const subDays   = daysSince(data.lastSubmission);
              const delta     = data.deadlineDelta;

              const ring     = document.createElement('span');
              ring.className = 'cak-ring ' + ringClass(loginDays);

              const mark     = document.createElement('span');
              mark.className = 'cak-mark ' + markClass(subDays);

              const tlWrap = document.createElement('div');
              tlWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;background:#f5f4ee;border:0.5px solid #d3d1c7;border-radius:5px;padding:2px 4px;height:22px;flex-shrink:0';
              tlWrap.appendChild(makeTimelineSvg(delta, data.hasDeadlines));

              const iconsWrap = document.createElement('div');
              iconsWrap.className = 'cak-cell-icons';
              iconsWrap.appendChild(ring);
              iconsWrap.appendChild(mark);
              iconsWrap.appendChild(tlWrap);
              cell.appendChild(iconsWrap);

              cell.addEventListener('mouseenter', async (e) => {
                currentHoverSid = sid;
                highlightRow(sid, true);
                const d         = studentData[sid] || {};
                const lDays     = daysSince(d.lastActivity);
                const sDays     = daysSince(d.lastSubmission);

                // Vis umiddelbart med "laster" for batteri
                const cached = moduleCompletionCache.hasOwnProperty(sid)
                  ? moduleCompletionCache[sid]
                  : null; // null = laster
                showTip(e, buildTooltip(lDays, sDays, d.deadlineDelta,
                  d.deadlineCount, d.godkjent, d.venterVurdering,
                  d.totalt, d.leksjonerEtter, cached, d.hoppetOver, d.skippedPerMod), tooltipFontSize);

                // Hent moduldata hvis ikke cachet
                if (!moduleCompletionCache.hasOwnProperty(sid)) {
                  try {
                    moduleCompletionCache[sid] = await fetchModuleCompletion(sid);
                  } catch (err) {
                    moduleCompletionCache[sid] = false;
                  }
                  if (currentHoverSid === sid && tooltipEl.style.display !== 'none') {
                    tooltipEl.innerHTML = buildTooltip(lDays, sDays, d.deadlineDelta,
                      d.deadlineCount, d.godkjent, d.venterVurdering,
                      d.totalt, d.leksjonerEtter, moduleCompletionCache[sid], d.hoppetOver, d.skippedPerMod);
                    if (lastTipEvent) moveTip(lastTipEvent);
                  }
                }
              });
              cell.addEventListener('mousemove',  moveTip);
              cell.addEventListener('mouseleave', () => { currentHoverSid = null; highlightRow(sid, false); hideTip(); });
            }

            cellCache.set(key, cell);
            overlayEl.appendChild(cell);
          }
        });

        // Fjern celler som ikke lenger er synlige
        for (const [key, cell] of cellCache) {
          if (!activeSids.has(key)) {
            cell.remove();
            cellCache.delete(key);
          }
        }

      } finally {
        setTimeout(() => { isUpdating = false; }, 0);
      }
    });
  }

  // ─── Tidslinje SVG ────────────────────────────────────────────────────────
  function makeTimelineSvg(delta, hasDeadlines) {
    const W = 56, H = 16, mid = W / 2;
    const barH = 6, barY = (H - barH) / 2;
    const margin = 3;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.flexShrink = '0';

    // Gradientdefinisjoner
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    const gGreen = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gGreen.setAttribute('id', 'cak-bar-green');
    gGreen.setAttribute('x1', '0%'); gGreen.setAttribute('x2', '100%');
    gGreen.setAttribute('y1', '0%'); gGreen.setAttribute('y2', '0%');
    [['0%', '#97c459'], ['100%', '#3b6d11']].forEach(([offset, color]) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      s.setAttribute('offset', offset); s.setAttribute('stop-color', color);
      gGreen.appendChild(s);
    });

    const gRed = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gRed.setAttribute('id', 'cak-bar-red');
    gRed.setAttribute('x1', '100%'); gRed.setAttribute('x2', '0%');
    gRed.setAttribute('y1', '0%');   gRed.setAttribute('y2', '0%');
    [['0%', '#e57373'], ['100%', '#a32d2d']].forEach(([offset, color]) => {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      s.setAttribute('offset', offset); s.setAttribute('stop-color', color);
      gRed.appendChild(s);
    });

    defs.appendChild(gGreen);
    defs.appendChild(gRed);
    svg.appendChild(defs);

    // Horisontal linje
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(margin));
    line.setAttribute('y1', '8');
    line.setAttribute('x2', String(W - margin));
    line.setAttribute('y2', '8');
    line.setAttribute('stroke', '#d3d1c7');
    line.setAttribute('stroke-width', '1.5');
    svg.appendChild(line);

    // Loddrett midtstrek
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    tick.setAttribute('x', String(mid - 1.2));
    tick.setAttribute('y', '2');
    tick.setAttribute('width', '2.4');
    tick.setAttribute('height', '12');
    tick.setAttribute('rx', '1');
    tick.setAttribute('fill', (delta === undefined && !hasDeadlines) ? '#e0dfd8' : '#888780');
    svg.appendChild(tick);

    if (delta === undefined && !hasDeadlines) {
      // Ingen frister — stiplet sirkel
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
      // Har frister men ikke levert — full rød bar til venstre
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('x', String(margin));
      bar.setAttribute('y', String(barY));
      bar.setAttribute('width', String(mid - margin - 1));
      bar.setAttribute('height', String(barH));
      bar.setAttribute('rx', '2');
      bar.setAttribute('fill', 'url(#cak-bar-red)');
      svg.appendChild(bar);
      return svg;
    }

    // Delta = 0 → bare midtstreken, ingen bar
    if (delta === 0) return svg;

    const clamped   = Math.max(-5, Math.min(5, delta));
    const halfRange = mid - margin - 2;
    const barLen    = Math.max(4, (Math.abs(clamped) / 5) * halfRange);

    const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bar.setAttribute('y', String(barY));
    bar.setAttribute('height', String(barH));
    bar.setAttribute('rx', '2');

    if (delta > 0) {
      bar.setAttribute('x', String(mid + 2));
      bar.setAttribute('width', String(barLen));
      bar.setAttribute('fill', 'url(#cak-bar-green)');
    } else {
      bar.setAttribute('x', String(mid - barLen - 2));
      bar.setAttribute('width', String(barLen));
      bar.setAttribute('fill', 'url(#cak-bar-red)');
    }

    svg.appendChild(bar);
    return svg;
  }

  function dotColor(delta) {
    if (delta === null || delta === undefined) return '#a32d2d';
    if (delta >= 1)  return '#3b6d11'; // foran — minst én leksjon foran
    if (delta === 0) return '#639922'; // i rute
    if (delta >= -2) return '#ba7517'; // litt etter
    return '#a32d2d';                  // klart etter
  }

  function activityCellTint(leksjonerEtter, hasDeadlines) {
    // Ingen frister i kurset → ingen trafikklys-farge
    if (leksjonerEtter === null && !hasDeadlines) return null;
    // Har frister men ikke levert / mangler grunnlag → rød
    if (leksjonerEtter === null) return 'rgba(198, 40, 40, 0.20)';

    // 0-1 etter → ingen farge, 2 → grønn, 3 → gul, 4+ → rød
    if (leksjonerEtter <= 1)  return null;
    if (leksjonerEtter === 2) return 'rgba(46, 125, 50, 0.18)';
    if (leksjonerEtter === 3) return 'rgba(251, 192, 45, 0.20)';
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
    if (days <= 15)              return 'cak-ring-2';
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

  function highlightRow(sid, on) {
    const frozenCanvas = findFrozenCanvas();
    if (!frozenCanvas) return;
    for (const row of frozenCanvas.querySelectorAll('.slick-row')) {
      if (extractStudentId(row) === sid) {
        const cells = row.querySelectorAll('.slick-cell');
        cells.forEach((cell, idx) => {
          if (on) {
            cell.style.backgroundColor = 'rgba(59, 109, 17, 0.07)';
          } else {
            // Gjenopprett trafikklys-farge på første celle hvis rowHighlight er aktiv
            if (idx === 0 && cfg.rowHighlight) {
              const data = studentData[sid] || {};
              cell.style.backgroundColor = activityCellTint(data.leksjonerEtter, data.hasDeadlines) || '';
            } else {
              cell.style.backgroundColor = '';
            }
          }
        });
        break;
      }
    }
  }

  async function fetchModuleCompletion(sid) {
    const courseId = getCourseId();
    const modules  = await paginate(
      `/api/v1/courses/${courseId}/modules?include[]=items&student_id=${sid}&per_page=100`
    );
    return modules.map(mod => {
      const mustView  = (mod.items || []).filter(i =>
        i.completion_requirement && i.completion_requirement.type === 'must_view'
      );
      const completed = mustView.filter(i => i.completion_requirement.completed).length;
      return { id: String(mod.id), name: mod.name, total: mustView.length, completed };
    });
  }

  function detectSemesterOffset() {
    const text = [
      document.title,
      document.querySelector('#breadcrumbs')?.textContent,
      document.querySelector('.context_title')?.textContent,
    ].filter(Boolean).join(' ').toLowerCase();
    return /vår|vaar/.test(text) ? 15 : 0;
  }

  function makeBatterySvg(modules, skippedPerMod = {}, lessonOffset = 0) {
    const labelH = 16;  // plass til leksjonsnummer øverst (45°-rotert tekst)
    const upH = 55, downH = 55;
    const totalH = labelH + upH + downH;
    const midY   = labelH + upH;
    const barW = 7, gap = 11;
    const now  = new Date();
    const n    = modules.length;
    const W    = n * (barW + gap) - gap;

    const defs = `<defs>
      <linearGradient id="cak-v-green" x1="0" x2="0" y1="${midY}" y2="${labelH}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#97c459"/>
        <stop offset="100%" stop-color="#3b6d11"/>
      </linearGradient>
      <linearGradient id="cak-v-red" x1="0" x2="0" y1="${midY}" y2="${totalH}" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#e57373"/>
        <stop offset="100%" stop-color="#a32d2d"/>
      </linearGradient>
    </defs>`;

    let bars = '';

    // 100%-markering øverst (svak stiplet linje)
    bars += `<line x1="0" y1="${labelH + 1}" x2="${W}" y2="${labelH + 1}" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="2,3"/>`;
    // Midtlinje / nullpunkt
    bars += `<line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="#888780" stroke-width="1"/>`;

    modules.forEach((mod, i) => {
      const x   = i * (barW + gap);
      const cx  = x + barW / 2;
      const num = i + 1 + lessonOffset;
      const due       = moduleDeadlineMap[mod.id] || null;
      const isPastDue = due && due <= now;
      const isStarted = mod.total > 0 && mod.completed > 0;

      // Leksjonsnummer — rotert loddrett i labelH-sonen over søylen
      bars += `<text transform="rotate(-45,${cx},${labelH / 2})" x="${cx}" y="${labelH / 2}" font-size="7" fill="#888780" text-anchor="middle" dominant-baseline="central">${num}</text>`;

      if (isStarted) {
        // Grønn bar vokser oppover — intensitet øker mot 100%
        const pct   = mod.completed / mod.total;
        const fillH = Math.max(2, Math.round(pct * upH));
        bars += `<rect x="${x}" y="${midY - fillH}" width="${barW}" height="${fillH}" rx="2" fill="url(#cak-v-green)"/>`;
      } else if (isPastDue) {
        // Passert frist, ikke påbegynt — rød bar full høyde ned
        bars += `<rect x="${x}" y="${midY}" width="${barW}" height="${downH}" rx="2" fill="url(#cak-v-red)"/>`;
      } else {
        // Fremtidig / ikke påbegynt — stiplet grå kontur ned
        bars += `<rect x="${x}" y="${midY}" width="${barW}" height="${downH}" rx="2" fill="none" stroke="#c8c6be" stroke-width="1" stroke-dasharray="3,2"/>`;
      }
    });

    // Hvite sirkler for manglende innleveringer — stables nedover fra midtlinjen
    modules.forEach((mod, i) => {
      const count = skippedPerMod[mod.id] || 0;
      if (count === 0) return;
      const cx     = i * (barW + gap) + barW / 2;
      const r      = 3, dotGap = 2;
      const maxDots = Math.floor(downH / (r * 2 + dotGap));
      const dots    = Math.min(count, maxDots);
      for (let d = 0; d < dots; d++) {
        const cy = midY + r + 2 + d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#3a3a3a" stroke-width="0.8"/>`;
      }
    });

    return `<svg width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}"
      style="display:block;margin-top:8px">${defs}${bars}</svg>`;
  }

  function buildTooltip(loginDays, subDays, delta, count, godkjent, venterVurdering, totalt, leksjonerEtter, batteryModules, hoppetOver, skippedPerMod) {
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
        if (leksjonerEtter >= 2) {
          const leks = leksjonerEtter === 1 ? '1 leksjon' : `${leksjonerEtter} leksjoner`;
          d += `<br>På etterskudd — ${leks} etter skoleruta`;
        }
      } else {
        d = 'I rute — ingen leksjoner under terskel';
      }
    }
    let battery = '';
    if (batteryModules === null) {
      battery = '<div style="margin-top:7px;border-top:0.5px solid #e8e6de;padding-top:6px;color:#b4b2a9;font-size:10px;">Laster lærestoffvisning…</div>';
    } else if (batteryModules && batteryModules.length > 0) {
      const relevant = batteryModules.filter(m => m.total > 0);
      if (relevant.length > 0) {
        battery = '<div style="margin-top:7px;border-top:0.5px solid #e8e6de;padding-top:5px">'
          + '<div style="font-size:10px;color:#888780;margin-bottom:4px">Lærestoff sett per leksjon</div>'
          + makeBatterySvg(batteryModules, skippedPerMod || {}, detectSemesterOffset())
          + '</div>';
      }
    }

    const skipped = hoppetOver > 0
      ? `<br><span style="color:#c62828"><svg width="9" height="9" viewBox="0 0 9 9" style="vertical-align:middle;margin-right:3px"><circle cx="4.5" cy="4.5" r="3.5" fill="white" stroke="#3a3a3a" stroke-width="1"/></svg>${hoppetOver} innlevering${hoppetOver === 1 ? '' : 'er'} med status Mangler</span>`
      : '';

    return `${l}<br>${s}<br>${d}${skipped}${battery}`;
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

    // ResizeObserver på grid-canvas: fanger rad-tillegg og høyde-endringer
    // som MutationObserver (childList) kan misse under Canvas sin init-sekvens
    const frozenCanvas = findFrozenCanvas();
    if (frozenCanvas && window.ResizeObserver) {
      new ResizeObserver(debouncedUpdate).observe(frozenCanvas);
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

})();
