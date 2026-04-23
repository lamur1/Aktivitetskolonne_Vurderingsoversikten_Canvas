// ============================================================
// DESIGNREGLER — ikke endre uten å forstå konsekvensene:
//
// GRØNN BAR = kun must_view (Vis-krav) — lærestoff uten dato.
//             Filtrer ALLTID på: completion_requirement.type === 'must_view'
//             Aldri alle completion_requirement — da trekkes innleveringer inn.
//
// PRIKKER    = must_submit (innleveringer med dato) — vises under streken.
//             Bruker missing-flagg og due_at fra Canvas API.
//
// FREMTIDSPRIKKER = futureCount minus allerede leverte — aldri isStarted-sjekk.
//
// Disse reglene ble brutt 20.04.2026 og kostet en økt å rette opp.
// ============================================================

$.getScript('https://www.nrk.no/serum/latest/js/video_embed.js');

var h5pScript = document.createElement('script');
h5pScript.setAttribute('charset', 'UTF-8');
h5pScript.setAttribute('src', 'https://h5p.com/canvas-resizer.js');
document.body.appendChild(h5pScript);

// ============================================================
// Globalskolen – Tooltip med lenke til modulside,
// premieikon og autovisning på modulside, diplom ved fullføring
//
// Tekster og premieikon hentes fra Canvas-siden med slug
// «gs-tekster» i kurset. Faller tilbake til standardtekster
// hvis siden ikke finnes.
// ============================================================

(function () {
  'use strict';

  var FORSINKELSE = 280;
  var PREMIE_IKONER = ['🏆', '🌟', '🎖️', '🥇', '🎯', '🚀', '💎'];

  var ITEM_SELEKTORER = [
    '.planner-todosidebar li',
    '.ToDoSidebar li',
    '.todo-list li',
    '[data-testid="todo-item"]',
    '.PlannerItem',
    '.planner-item',
  ];

  // Slug på Canvas-siden som inneholder redigerbare tekster og premieikon
  var SIDE_SLUG = 'gs-tekster';

  // Standardtekster – overskrives av innholdet i gs-tekster-siden hvis den finnes.
  var TEKSTER = {
    'tooltip-ikon':           '💻',
    'tooltip-tittel':         'Gått gjennom lærestoffet?',
    'tooltip-tekst':          'Husk å starte med Startsiden i leksjonen. Arbeid med lærestoffet før du gjør oppgavene. 👍',
    'tooltip-knapp':          'Gå til leksjonsoversikten →',
    'infoboks-ikon':          '🏆',
    'infoboks-overskrift':    'Fullfør en leksjon – få et premieikon!',
    'infoboks-tekst':         'Når du har gjort ferdig alt i en leksjon, får den et premieikon og foldes sammen automatisk. Leksjoner du ikke er ferdig med er åpne og klare til bruk.',
    'premie-ikon-url':        '', // URL til bilde – tom = bruk emoji-array som fallback
  };

  var alleModuler = []; // lagres for diplom-generering

  // ============================================================
  // TOOLTIP STYLES
  // ============================================================

  var style = document.createElement('style');
  style.textContent = `
    #gs-lapp {
      position: fixed;
      z-index: 99999;
      max-width: 270px;
      min-width: 210px;
      text-decoration: none;
      display: block;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease, transform 0.22s ease;
      transform: translateX(-6px) scale(0.97);
    }
    #gs-lapp.gs-synlig {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(0) scale(1);
    }
    /* Pil peker venstre (tooltip til høyre for element) */
    #gs-lapp.gs-pil-venstre #gs-lapp-inner::before {
      content: "";
      position: absolute;
      left: -27px;
      top: 20px;
      border: 14px solid transparent;
      border-right-color: #1a1a1a;
    }
    #gs-lapp.gs-pil-venstre #gs-lapp-inner::after {
      content: "";
      position: absolute;
      left: -21px;
      top: 23px;
      border: 11px solid transparent;
      border-right-color: #fff9d6;
    }
    /* Pil peker høyre (tooltip til venstre for element) */
    #gs-lapp.gs-pil-hoyre #gs-lapp-inner::before {
      content: "";
      position: absolute;
      right: -27px;
      top: 20px;
      border: 14px solid transparent;
      border-left-color: #1a1a1a;
    }
    #gs-lapp.gs-pil-hoyre #gs-lapp-inner::after {
      content: "";
      position: absolute;
      right: -21px;
      top: 23px;
      border: 11px solid transparent;
      border-left-color: #fff9d6;
    }
    #gs-lapp-inner {
      background: #fff9d6;
      border: 3.5px solid #1a1a1a;
      border-radius: 18px;
      padding: 0.85rem 1rem 0.9rem;
      position: relative;
      box-shadow: 5px 5px 0 #1a1a1a;
    }
    #gs-lapp-ikon {
      font-size: 2rem;
      display: block;
      text-align: center;
      margin-bottom: 0.25rem;
      line-height: 1;
    }
    #gs-lapp-tittel {
      font-size: 18px;
      font-weight: 900;
      color: #1a1a1a;
      margin: 0 0 0.3rem;
      font-family: sans-serif;
      text-align: center;
      letter-spacing: 0.01em;
    }
    #gs-lapp-tekst {
      font-size: 16px;
      line-height: 1.55;
      color: #333;
      margin: 0 0 0.65rem;
      font-family: sans-serif;
      font-weight: 500;
    }
    #gs-lapp-knapp {
      display: block;
      text-align: center;
      background: #fbbf24;
      color: #1a1a1a;
      font-size: 15px;
      font-weight: 900;
      padding: 0.4rem 0.8rem;
      border-radius: 20px;
      border: 2.5px solid #1a1a1a;
      font-family: sans-serif;
      box-shadow: 3px 3px 0 #1a1a1a;
      letter-spacing: 0.01em;
    }

    /* Premie badge – emoji-variant via CSS ::after */
    .context_module.gs-fullfort .ig-header-title .name::after {
      content: var(--gs-premie-ikon, "\uD83C\uDFC6");
      font-size: 2.6em;
      line-height: 1;
      display: inline-block;
      vertical-align: middle;
      margin-left: 0.45em;
      pointer-events: none;
      filter: drop-shadow(0 1px 3px rgba(0,0,0,0.22));
      animation: gs-premie-pop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    /* Premie badge – bildevariant via CSS ::after */
    .context_module.gs-fullfort-bilde .ig-header-title .name::after {
      content: "";
      display: inline-block;
      width: 2.6em;
      height: 2.6em;
      background-image: var(--gs-premie-bilde-url);
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      vertical-align: middle;
      margin-left: 0.45em;
      pointer-events: none;
      animation: gs-premie-pop 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    @keyframes gs-premie-pop {
      0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
      75%  { transform: scale(1.25) rotate(4deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Bygg tooltip-DOM med standardtekster (oppdateres etter teksthenting)
  var lapp = document.createElement('a');
  lapp.id = 'gs-lapp';
  lapp.href = '#';
  lapp.className = 'gs-pil-venstre';

  var lappInner = document.createElement('div');
  lappInner.id = 'gs-lapp-inner';

  var ikon = document.createElement('span');
  ikon.id = 'gs-lapp-ikon';
  ikon.textContent = TEKSTER['tooltip-ikon'];

  var tittel = document.createElement('p');
  tittel.id = 'gs-lapp-tittel';
  tittel.textContent = TEKSTER['tooltip-tittel'];

  var tekst = document.createElement('p');
  tekst.id = 'gs-lapp-tekst';

  var knapp = document.createElement('span');
  knapp.id = 'gs-lapp-knapp';
  knapp.textContent = TEKSTER['tooltip-knapp'];

  lappInner.appendChild(ikon);
  lappInner.appendChild(tittel);
  lappInner.appendChild(tekst);
  lappInner.appendChild(knapp);
  lapp.appendChild(lappInner);
  document.body.appendChild(lapp);

  var visTimer = null;
  var skjulTimer = null;
  var aktivEl = null;

  // ============================================================
  // TOOLTIP-LOGIKK
  // ============================================================

  function plasserLapp(el) {
    var rect = el.getBoundingClientRect();
    var tw = lapp.offsetWidth  || 270;
    var th = lapp.offsetHeight || 210;
    var romHoyre   = window.innerWidth  - rect.right  - 20;
    var romVenstre = rect.left - 20;

    var x;
    if (romHoyre >= tw || romHoyre >= romVenstre) {
      x = rect.right + 14;
      lapp.className = 'gs-pil-venstre';
    } else {
      x = rect.left - tw - 14;
      lapp.className = 'gs-pil-hoyre';
    }

    var y = rect.top + rect.height / 2 - th / 2;
    y = Math.max(8, Math.min(y, window.innerHeight - th - 8));

    lapp.style.left = x + 'px';
    lapp.style.top  = y + 'px';
  }

  function lagTekst() {
    return TEKSTER['tooltip-tekst'];
  }

  function visLapp(el, kursId, leksjonNavn) {
    clearTimeout(skjulTimer);
    clearTimeout(visTimer);
    aktivEl = el;

    visTimer = setTimeout(function () {
      if (aktivEl !== el) return;
      lapp.href = kursId ? '/courses/' + kursId + '/modules' : '#';
      tekst.textContent = lagTekst();
      plasserLapp(el);
      lapp.classList.add('gs-synlig');
    }, FORSINKELSE);
  }

  function skjulLapp() {
    clearTimeout(visTimer);
    aktivEl = null;
    skjulTimer = setTimeout(function () {
      lapp.classList.remove('gs-synlig');
    }, 130);
  }

  lapp.addEventListener('mouseenter', function () { clearTimeout(skjulTimer); });
  lapp.addEventListener('mouseleave', skjulLapp);
  lapp.addEventListener('click', skjulLapp);

  function hentKursIdFraElement(el) {
    var lenker = el.querySelectorAll('a[href*="/courses/"]');
    if (!lenker.length) return null;
    var match = lenker[0].href.match(/\/courses\/(\d+)/);
    return match ? match[1] : null;
  }

  function hentLeksjonNavnFraElement(el) {
    var lenker = el.querySelectorAll('a[href*="/courses/"]');
    if (!lenker.length) return null;
    return lenker[0].textContent.trim();
  }

  function leggTilLyttere(el) {
    if (el._gsTooltipFestet) return;
    el._gsTooltipFestet = true;
    var kursId = hentKursIdFraElement(el);
    var leksjonNavn = hentLeksjonNavnFraElement(el);

    el.addEventListener('mouseenter', function () { visLapp(el, kursId, leksjonNavn); });
    el.addEventListener('mouseleave', skjulLapp);

    el.addEventListener('touchstart', function () {
      lapp.href = kursId ? '/courses/' + kursId + '/modules' : '#';
      tekst.textContent = lagTekst();
      plasserLapp(el);
      lapp.classList.add('gs-synlig');
      setTimeout(skjulLapp, 5000);
    }, { passive: true });
  }

  function finnOgFest() {
    ITEM_SELEKTORER.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(leggTilLyttere);
    });
    injiserElementnummer();
  }

  // ============================================================
  // TALLBADGES — injiserer løpenummer på hvert modulitem
  // i moduloversikten, slik at numrene samsvarer med
  // fremdriftsbarerens kuler når eleven går inn i leksjonen.
  // SubHeaders telles ikke og får ikke badge.
  // ============================================================

  function injiserElementnummer() {
    if (!window.location.pathname.match(/\/courses\/\d+\/modules/)) return;

    document.querySelectorAll('.context_module').forEach(function (modulEl) {
      var teller = 0;
      modulEl.querySelectorAll('li.context_module_item').forEach(function (itemEl) {
        // Hopp over SubHeaders — de er ikke navigerbare og inngår ikke i numreringen
        if (itemEl.classList.contains('context_module_sub_header')) return;

        // Ikke nummerer samme item to ganger
        if (itemEl.querySelector('.gs-tal-badge')) return;

        teller++;

        // Finn tittel-elementet å injisere foran
        var tittelEl = itemEl.querySelector('.ig-title');
        if (!tittelEl) return;

        var badge = document.createElement('span');
        badge.className = 'gs-tal-badge';
        badge.textContent = String(teller);
        badge.setAttribute('aria-hidden', 'true');
        Object.assign(badge.style, {
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          width:          '20px',
          height:         '20px',
          borderRadius:   '50%',
          background:     '#fff',
          border:         '2.5px solid #1a1a1a',
          color:          '#1a1a1a',
          fontSize:       '11px',
          fontWeight:     '700',
          marginRight:    '8px',
          flexShrink:     '0',
          verticalAlign:  'middle',
          lineHeight:     '1',
          fontFamily:     'sans-serif',
        });

        tittelEl.style.display = tittelEl.style.display || 'flex';
        tittelEl.style.alignItems = 'center';
        tittelEl.insertBefore(badge, tittelEl.firstChild);
      });
    });
  }

  finnOgFest();
  var observer = new MutationObserver(finnOgFest);
  observer.observe(document.body, { childList: true, subtree: true });

  // ============================================================
  // MODULSIDE – premieikon + autokollapset + scroll
  // ============================================================

  function finnTittelEl(modulEl) {
    var selektorer = [
      '.ig-header-title .name',
      '.ig-header-title',
      '.module_header_title .name',
      '.module_header_title',
      '.ig-header .title',
    ];
    for (var i = 0; i < selektorer.length; i++) {
      var el = modulEl.querySelector(selektorer[i]);
      if (el) return el;
    }
    return null;
  }

  function settInnPremieikon(modulEl, modulId) {
    if (modulEl.classList.contains('gs-fullfort') ||
        modulEl.classList.contains('gs-fullfort-bilde')) return;

    if (TEKSTER['premie-ikon-url']) {
      modulEl.style.setProperty('--gs-premie-bilde-url', 'url("' + TEKSTER['premie-ikon-url'] + '")');
      modulEl.classList.add('gs-fullfort-bilde');
    } else {
      modulEl.style.setProperty('--gs-premie-ikon', '"' + PREMIE_IKONER[modulId % PREMIE_IKONER.length] + '"');
      modulEl.classList.add('gs-fullfort');
    }
  }

  function kollapsModul(modulEl) {
    var innhold = modulEl.querySelector('.content');
    if (!innhold) return;
    var erKollapset = innhold.style.display === 'none' ||
                      modulEl.classList.contains('collapsed_module');
    if (!erKollapset) {
      var toggle = modulEl.querySelector(
        '.collapse_module_link, [aria-label*="ollapse"]'
      );
      if (toggle) {
        toggle.click();
      } else {
        innhold.style.display = 'none';
        modulEl.classList.add('collapsed_module');
      }
    }
  }

  function ekspanderModul(modulEl) {
    var innhold = modulEl.querySelector('.content');
    if (!innhold) return;
    var erKollapset = innhold.style.display === 'none' ||
                      modulEl.classList.contains('collapsed_module');
    if (erKollapset) {
      var toggle = modulEl.querySelector(
        '.collapse_module_link, .expand_module_link, [aria-label*="ollapse"], [aria-label*="xpand"]'
      );
      if (toggle) {
        toggle.click();
      } else {
        innhold.style.display = '';
        modulEl.classList.remove('collapsed_module');
      }
    }
  }

  function behandleModuler(moduler) {
    if (!Array.isArray(moduler)) return;
    alleModuler = moduler;
    moduler.forEach(function (modul) {
      var modulEl = document.getElementById('context_module_' + modul.id);
      if (!modulEl) return;

      if (modul.state === 'completed') {
        settInnPremieikon(modulEl, modul.id);
        kollapsModul(modulEl);
      } else if (modul.state === 'locked') {
        // La låste moduler være i fred
      } else {
        ekspanderModul(modulEl);
      }
    });

    var erElev = typeof ENV !== 'undefined' && ENV.current_user_roles &&
                 ENV.current_user_roles.indexOf('student') !== -1;
    if (erElev) {
      var forsteUfullfort = null;
      for (var i = 0; i < moduler.length; i++) {
        if (moduler[i].state !== 'completed' && moduler[i].state !== 'locked') {
          forsteUfullfort = document.getElementById('context_module_' + moduler[i].id);
          break;
        }
      }
      setTimeout(function () {
        if (forsteUfullfort) {
          forsteUfullfort.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 1000);
    }
  }

  // ============================================================
  // DIPLOM
  // ============================================================

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function leggTilDiplomKnapp() {
    if (!window.location.pathname.match(/\/courses\/\d+\/modules/)) return;
    if (document.getElementById('gs-diplom-knapp')) return;
    var erElev = typeof ENV !== 'undefined' && ENV.current_user_roles &&
                 ENV.current_user_roles.indexOf('student') !== -1;
    if (!erElev) return;
    var anker = document.querySelector('#context_modules, .item-group-condensed, #modules');
    if (!anker) return;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'text-align:center;margin:2.5rem 0 1.5rem';

    var knappEl = document.createElement('button');
    knappEl.id = 'gs-diplom-knapp';
    knappEl.innerHTML = '🎓 Skriv ut diplom';
    knappEl.style.cssText = [
      'background:#fff9d6',
      'border:3px solid #1a1a1a',
      'border-radius:22px',
      'box-shadow:4px 4px 0 #1a1a1a',
      'padding:0.6rem 1.6rem',
      'font-size:1rem',
      'font-weight:900',
      'font-family:sans-serif',
      'cursor:pointer',
      'transition:transform 0.1s',
    ].join(';');
    knappEl.addEventListener('mouseenter', function () { knappEl.style.transform = 'translate(-2px,-2px)'; knappEl.style.boxShadow = '6px 6px 0 #1a1a1a'; });
    knappEl.addEventListener('mouseleave', function () { knappEl.style.transform = ''; knappEl.style.boxShadow = '4px 4px 0 #1a1a1a'; });
    knappEl.addEventListener('click', apneDiplom);

    var hint = document.createElement('p');
    hint.textContent = 'Ser ikke diplomet bra ut? Prøv å åpne Canvas i en annen nettleser.';
    hint.style.cssText = 'margin-top:0.5rem;font-size:12px;color:#888;font-family:sans-serif;';

    wrapper.appendChild(knappEl);
    wrapper.appendChild(hint);
    if (anker.nextSibling) {
      anker.parentNode.insertBefore(wrapper, anker.nextSibling);
    } else {
      anker.parentNode.appendChild(wrapper);
    }
  }

  function apneDiplom() {
    fetch('/api/v1/users/self', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.json(); })
    .then(function (bruker) { genererDiplom(bruker.name || 'Eleven'); })
    .catch(function () { genererDiplom('Eleven'); });
  }

  function hentSemesterTittel() {
    var aar = new Date().getFullYear();
    for (var i = 0; i < alleModuler.length; i++) {
      var match = alleModuler[i].name.match(/\d+/);
      if (match) {
        return parseInt(match[0]) >= 16
          ? 'Globalskolen \u2013 v\u00E5rsemesteret ' + aar
          : 'Globalskolen \u2013 h\u00F8stsemesteret ' + aar;
      }
    }
    return 'Globalskolen ' + aar;
  }

  function genererDiplom(elevNavn) {
    var dato = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
    var diplomTittel = hentSemesterTittel();

    var erIPad = /iPad/i.test(navigator.userAgent) ||
                 (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

    var cellerHtml = alleModuler.map(function (modul) {
      var fullfort = modul.state === 'completed';
      var ikonHtml = (fullfort && TEKSTER['premie-ikon-url'])
        ? '<img src="' + escapeHtml(TEKSTER['premie-ikon-url']) + '" style="width:100%;height:100%;object-fit:contain;" alt="premie">'
        : PREMIE_IKONER[modul.id % PREMIE_IKONER.length];
      return '<div class="celle' + (fullfort ? ' fullfort' : '') + '">'
        + '<div class="ikon">' + ikonHtml + '</div>'
        + '<div class="namn">' + escapeHtml(modul.name) + '</div>'
        + '</div>';
    }).join('');

    var css = ''
      + '* { box-sizing:border-box; margin:0; padding:0; }'
      + '@page { size:A4 portrait; margin:10mm 12mm; }'
      + '@media print { html,body { height:100%; } .ikon { filter:none !important; } }'
      + 'body { font-family:Georgia,"Times New Roman",serif; color:#454544; background:#fff; }'
      + '.topp { text-align:center; padding-bottom:8px; border-bottom:2.5px solid #0460a7; margin-bottom:10px; }'
      + '.tittel { font-size:3rem; font-weight:700; color:#263a59; letter-spacing:0.03em; line-height:1.1; }'
      + '.undertittel { font-family:sans-serif; font-size:0.95rem; font-weight:400; color:#0460a7; letter-spacing:0.06em; margin-top:4px; }'
      + '.elev-seksjon { text-align:center; }'
      + '.elev-label { font-family:sans-serif; font-size:9px; text-transform:uppercase; letter-spacing:0.18em; color:#0460a7; margin-bottom:3px; }'
      + '.elev-navn { font-size:1.35rem; font-weight:700; color:#263a59; }'
      + '.celle { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; border-radius:7px; background:#f5f7fb; border:1.5px solid #dde3ee; }'
      + '.celle.fullfort { background:#eef3fa; border-color:#0460a7; }'
      + '.ikon { line-height:1; opacity:0.1; filter:grayscale(1); flex-shrink:0; display:flex; align-items:center; justify-content:center; }'
      + '.celle.fullfort .ikon { opacity:1; filter:none; }'
      + '.namn { font-family:sans-serif; color:#ccc; line-height:1.25; }'
      + '.celle.fullfort .namn { color:#454544; font-weight:700; }'
      + '.bunntekst { border-top:1.5px solid #0460a7; display:flex; justify-content:space-between; font-family:sans-serif; font-size:8px; color:#999; letter-spacing:0.05em; }'
      + '.bunntekst .stempel { color:#b01e40; font-weight:700; }';

    if (erIPad) {
      css += ''
        + '.ramme-ytre { border:9px solid #263a59; border-radius:4px; padding:5px; display:flex; flex-direction:column; overflow:hidden; }'
        + '.side { border:3px solid #0460a7; border-radius:2px; padding:14px 18px 10px; flex:1; display:flex; flex-direction:column; }'
        + '.elev-seksjon { margin-bottom:10px; }'
        + '.grid { display:grid; grid-template-columns:repeat(3,1fr); grid-auto-rows:auto; gap:5px 8px; flex:1; }'
        + '.celle { padding:5px 4px; }'
        + '.ikon { font-size:min(3.2rem,6.5vh); width:min(3.2rem,6.5vh); height:min(3.2rem,6.5vh); margin-bottom:3px; }'
        + '.namn { font-size:clamp(10px,1.5vh,13px); }'
        + '.bunntekst { margin-top:8px; padding-top:5px; }';
    } else {
      css += ''
        + '.ramme-ytre { border:9px solid #263a59; border-radius:4px; padding:5px; min-height:265mm; display:flex; flex-direction:column; }'
        + '.side { border:3px solid #0460a7; border-radius:2px; padding:22px 28px 16px; flex:1; display:flex; flex-direction:column; }'
        + '.elev-seksjon { margin-bottom:16px; }'
        + '.grid { display:grid; grid-template-columns:repeat(3,1fr); grid-auto-rows:1fr; gap:10px 14px; flex:1; }'
        + '.celle { padding:14px 10px; min-height:0; }'
        + '.ikon { font-size:min(3rem,6vh); width:min(3rem,6vh); height:min(3rem,6vh); margin-bottom:6px; }'
        + '.namn { font-size:clamp(13px,2vh,16px); }'
        + '.bunntekst { margin-top:14px; padding-top:7px; }';
    }

    var html = '<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8">'
      + '<title>Diplom \u2013 ' + escapeHtml(elevNavn) + '</title>'
      + '<style>' + css + '</style></head><body>'
      + '<div class="ramme-ytre"><div class="side">'
      + '<div class="topp">'
      + '<div class="tittel">Diplom</div>'
      + '<div class="undertittel">' + diplomTittel + '</div>'
      + '</div>'
      + '<div class="elev-seksjon"><div class="elev-label">Tildelt</div>'
      + '<div class="elev-navn">' + escapeHtml(elevNavn) + '</div></div>'
      + '<div class="grid">' + cellerHtml + '</div>'
      + '<div class="bunntekst"><span>Globalskolen</span>'
      + '<span class="stempel">Hentet: ' + dato + '</span></div>'
      + '</div></div>'
      + '<script>window.onload=function(){window.print();}<\/script>'
      + '</body></html>';

    var vindu = window.open('', '_blank');
    if (vindu) { vindu.document.write(html); vindu.document.close(); }
  }

  // ============================================================
  // TEKSTHENTING FRA gs-tekster-siden
  // ============================================================

  function hentKursId() {
    var urlMatch = window.location.pathname.match(/\/courses\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    if (typeof ENV !== 'undefined') {
      if (ENV.COURSE_ID) return String(ENV.COURSE_ID);
      if (ENV.context_asset_string) {
        var m = ENV.context_asset_string.match(/course_(\d+)/);
        if (m) return m[1];
      }
    }
    var lenke = document.querySelector('a[href*="/courses/"]');
    if (lenke) {
      var m2 = lenke.href.match(/\/courses\/(\d+)/);
      if (m2) return m2[1];
    }
    return null;
  }

  function hentTekster(kursId, callback) {
    if (!kursId) { callback(); return; }
    fetch('/api/v1/courses/' + kursId + '/pages/' + SIDE_SLUG, {
      headers: { 'Accept': 'application/json' }
    })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (side) {
      if (!side.body) { callback(); return; }
      var parser = new DOMParser();
      var doc = parser.parseFromString(side.body, 'text/html');
      doc.querySelectorAll('table tr').forEach(function (rad) {
        var celler = rad.querySelectorAll('td');
        if (celler.length < 2) return;
        var nokkel = celler[0].textContent.trim();
        if (!nokkel || !TEKSTER.hasOwnProperty(nokkel)) return;
        if (nokkel === 'premie-ikon-url') {
          var img = celler[1].querySelector('img');
          if (img && img.src) TEKSTER[nokkel] = img.src;
        } else {
          var verdi = celler[1].textContent.trim();
          TEKSTER[nokkel] = verdi; // Tom celle = bevisst blank, ikke fallback til standard
        }
      });
      callback();
    })
    .catch(function () { callback(); });
  }

  // ============================================================
  // INFOBOKS ØVERST PÅ MODULSIDE
  // ============================================================

  function visInfoboks() {
    if (!window.location.pathname.match(/\/courses\/\d+\/modules/)) return;
    if (document.getElementById('gs-infoboks')) return;

    var boks = document.createElement('div');
    boks.id = 'gs-infoboks';
    boks.style.cssText = [
      'background:#fff9d6',
      'border:3.5px solid #1a1a1a',
      'border-radius:18px',
      'box-shadow:5px 5px 0 #1a1a1a',
      'padding:0.85rem 1.2rem',
      'margin:1rem 0 1.4rem',
      'display:flex',
      'align-items:center',
      'gap:0.9rem',
      'font-family:sans-serif',
      'max-width:720px',
    ].join(';');

    var ikonSpan = document.createElement('span');
    ikonSpan.textContent = TEKSTER['infoboks-ikon'];
    ikonSpan.style.cssText = 'font-size:2rem;line-height:1;flex-shrink:0';

    var tekstDiv = document.createElement('div');

    var overskrift = document.createElement('div');
    overskrift.textContent = TEKSTER['infoboks-overskrift'];
    overskrift.style.cssText = 'font-weight:900;color:#1a1a1a;margin-bottom:0.2rem';

    var beskrivelse = document.createElement('div');
    beskrivelse.textContent = TEKSTER['infoboks-tekst'];
    beskrivelse.style.cssText = 'color:#333;font-weight:500;line-height:1.5';

    tekstDiv.appendChild(overskrift);
    tekstDiv.appendChild(beskrivelse);
    boks.appendChild(ikonSpan);
    boks.appendChild(tekstDiv);

    var anker = document.querySelector('#context_modules, .item-group-condensed, #modules');
    if (anker) {
      anker.parentNode.insertBefore(boks, anker);
    }
  }

  // ============================================================
  // MODULSJEKK OG OPPSTART
  // ============================================================

  function sjekkOgEkspander() {
    var match = window.location.pathname.match(/\/courses\/(\d+)\/modules/);
    if (!match) return;
    var kursId = match[1];
    var forsok = 0;
    var intervall = setInterval(function () {
      forsok++;
      var moduler = document.querySelectorAll('.context_module');
      if (moduler.length > 0 || forsok > 20) {
        clearInterval(intervall);
        if (moduler.length > 0) {
          fetch('/api/v1/courses/' + kursId + '/modules?per_page=100', {
            headers: { 'Accept': 'application/json' }
          })
          .then(function (r) { return r.json(); })
          .then(function (moduler) {
            behandleModuler(moduler);
            leggTilDiplomKnapp();
          })
          .catch(function (err) {
            console.warn('[Globalskolen] Modulhenting feilet:', err);
          });
        }
      }
    }, 300);
  }

  function oppdaterTeksterIDom() {
    ikon.textContent   = TEKSTER['tooltip-ikon'];
    tittel.textContent = TEKSTER['tooltip-tittel'];
    knapp.textContent  = TEKSTER['tooltip-knapp'];
  }

  hentTekster(hentKursId(), function () {
    oppdaterTeksterIDom();
    sjekkOgEkspander();
    visInfoboks();
  });

  // Følg med på navigasjon (Canvas er en SPA)
  var sisteUrl = window.location.href;
  setInterval(function () {
    if (window.location.href !== sisteUrl) {
      sisteUrl = window.location.href;
      alleModuler = [];
      hentTekster(hentKursId(), function () {
        oppdaterTeksterIDom();
        sjekkOgEkspander();
        visInfoboks();
      });
    }
  }, 500);

})();


// ============================================================
// Elev-fremdrift – viser elevens batterygrafikk i en modal
// Vises bare for elever, på alle kurssider
// ============================================================

(function () {
  'use strict';

  const m = location.pathname.match(/\/courses\/(\d+)/);
  if (!m) return;
  const courseId = m[1];

  const ENV = window.ENV || {};
  const userId = ENV.current_user_id;
  if (!userId) return;

  const roles = ENV.current_user_roles || [];
  const isTeacherOrAdmin = roles.some(r =>
    r === 'teacher' || r === 'TeacherEnrollment' ||
    r === 'admin'   || r === 'AccountAdmin' ||
    r === 'DesignerEnrollment' || r === 'TaEnrollment'
  );
  if (isTeacherOrAdmin) return;

  if (document.getElementById('ef-btn')) return;

  const efStyle = document.createElement('style');
  efStyle.textContent = `
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
      font-size: 14px;
      color: #4a4a4a;
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
      font-size: 12px;
      color: #4a4a4a;
      margin-bottom: 6px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #ef-modal .ef-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 16px;
      font-size: 13px;
      color: #3a3a3a;
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
      font-size: 12px;
      color: #4a4a4a;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(efStyle);

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
      <div class="ef-subtitle">Oversikt over arbeidet ditt dette semesteret.</div>
      <div id="ef-content"><div id="ef-loading">Henter data…</div></div>
    `;
    modal.querySelector('.ef-close').addEventListener('click', closeModal);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

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

  const CACHE_KEY = `ef_data_${courseId}_${userId}`;
  const CACHE_TTL = 60 * 60 * 1000;

  async function loadAndRender() {
    const contentEl = document.getElementById('ef-content');
    if (!contentEl) return;

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
    // Henter moduler med items, oppgaver og innleveringer parallelt.
    //
    // Modulferdigstilling beregnes fra item-nivå (completion_requirement.completed)
    // — ikke fra completed_count på modulnivå som Canvas ikke alltid returnerer.
    //
    // Prikke-logikk: et item teller bare hvis tilhørende oppgave HAR due_at satt
    // OG ikke er markert som frivillig (omit_from_final_grade).

    const [modulesRaw, assignments, submissions] = await Promise.all([
      fetchModulesRaw(),
      fetchAssignments(),
      fetchSubmissions()
    ]);

    // assignment_id → full assignment-objekt (for due_at og omit_from_final_grade)
    const assignmentMap = {};
    assignments.forEach(a => { assignmentMap[String(a.id)] = a; });

    // content_id → modul-ID
    // content_id → fristdato (content_details.due_at fra item, eller assignment.due_at som fallback)
    // modul-ID   → antall tellende items
    const contentModMap  = {};
    const itemDueMap     = {}; // content_id → due_at streng
    const modAssignCount = {};

    modulesRaw.forEach(mod => {
      const mid = String(mod.id);
      (mod.items || []).forEach(item => {
        if (!item.content_id) return;
        const a = assignmentMap[String(item.content_id)];
        // Frivillige assignments ekskluderes
        if (a && a.omit_from_final_grade) return;
        // Frist: hent fra content_details direkte på item (fanger NQ og LTI-er),
        // faller tilbake på assignment.due_at
        const dueAt = (item.content_details && item.content_details.due_at)
                   || (a && a.due_at);
        if (!dueAt) return; // ingen frist → ikke i spill
        contentModMap[String(item.content_id)] = mid;
        itemDueMap[String(item.content_id)]    = dueAt;
        modAssignCount[mid] = (modAssignCount[mid] || 0) + 1;
      });
    });

    // Seneste frist per modul (for Nå-linja i grafikken)
    const modDeadlineMap = {};
    Object.entries(itemDueMap).forEach(([contentId, dueAt]) => {
      const mid = contentModMap[contentId];
      if (!mid) return;
      const due = new Date(dueAt);
      if (!modDeadlineMap[mid] || due > new Date(modDeadlineMap[mid])) {
        modDeadlineMap[mid] = dueAt;
      }
    });

    // assignment_id → submission
    const subMap = {};
    submissions.forEach(s => { subMap[String(s.assignment_id)] = s; });

    const deliveredPerMod = {};
    const skippedPerMod   = {};
    const now = new Date();

    modulesRaw.forEach(mod => {
      const mid = String(mod.id);
      // Bare items som har frist og ikke er frivillige
      const items = (mod.items || []).filter(it =>
        it.content_id && contentModMap[String(it.content_id)] === mid &&
        !(it.completion_requirement && it.completion_requirement.type === 'must_view')
      );
      let delivered = 0, missing = 0;

      items.forEach(item => {
        const sub   = subMap[String(item.content_id)];
        const dueAt = itemDueMap[String(item.content_id)];
        const due   = dueAt ? new Date(dueAt) : null;
        const hasActivity = sub && (
          sub.submitted_at || sub.graded_at ||
          sub.workflow_state === 'submitted' ||
          sub.workflow_state === 'graded' ||
          sub.workflow_state === 'complete' ||
          (sub.grade && sub.grade !== null)
        );
        const isExcused = sub && sub.excused;
        if (isExcused) return;
        if (hasActivity) {
          delivered++;
        } else {
          const isMissing = (sub && sub.missing === true) || (due && due <= now);
          if (isMissing) missing++;
        }
      });

      if (delivered > 0) deliveredPerMod[mid] = delivered;
      if (missing   > 0) skippedPerMod[mid]   = missing;
    });

    // Visningsmoduler for batterygrafikken.
    // Modulferdigstilling beregnes fra item.completion_requirement.completed
    // — dette er alltid tilgjengelig i API-responsen med student_id.
    const modules = modulesRaw.map(mod => {
      const items    = mod.items || [];
      const withReq  = items.filter(it => it.completion_requirement && it.completion_requirement.type === 'must_view');
      const done     = withReq.filter(it => it.completion_requirement.completed).length;
      return {
        id:        String(mod.id),
        name:      mod.name,
        total:     withReq.length || items.length,
        completed: done
      };
    });

    const godkjent       = Object.keys(deliveredPerMod).length;
    const totalLeksjoner = modules.length;
    const venter = submissions.filter(s =>
      s.workflow_state === 'submitted' || s.workflow_state === 'pending_review'
    ).length;

    return {
      modules,
      modDeadlineMap,
      modAssignMap: modAssignCount,
      deliveredPerMod,
      skippedPerMod,
      godkjent,
      totalLeksjoner,
      venter
    };
  }

  async function fetchModulesRaw() {
    // include[]=content_details gir due_at direkte på hvert item (dekker NQ og andre LTI-er)
    return fetchAllPages(
      `/api/v1/courses/${courseId}/modules?include[]=items&include[]=content_details&student_id=${userId}&per_page=50`
    );
  }

  async function fetchAssignments() {
    // Henter due_at og omit_from_final_grade — ingen avhengighet av module_ids
    return fetchAllPages(
      `/api/v1/courses/${courseId}/assignments?per_page=100`
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

  function renderData(data) {
    const contentEl = document.getElementById('ef-content');
    if (!contentEl) return;

    const {
      modules, modDeadlineMap, modAssignMap,
      deliveredPerMod, skippedPerMod,
      godkjent, totalLeksjoner, venter
    } = data;

    const deadlineMap = {};
    Object.entries(modDeadlineMap || {}).forEach(([k, v]) => {
      deadlineMap[k] = new Date(v);
    });

    const batterySvg = modules.length > 0
      ? makeBatterySvgStudent(modules, skippedPerMod || {}, deliveredPerMod || {}, deadlineMap, modAssignMap || {})
      : '';

    const foran = countForan(modules, deliveredPerMod, deadlineMap);

    // Snitt visning — samme logikk som aktivitetskolonnen:
    // Gjennomsnitt av completed/total for leksjoner eleven har startet (completed > 0).
    // Leksjoner som ikke er påbegynt holdes utenfor beregningen.
    const snitModuler = modules.filter(m => m.total > 0 && m.completed > 0);
    const snitVisning = snitModuler.length > 0
      ? Math.round(snitModuler.reduce((acc, m) => acc + m.completed / m.total, 0) / snitModuler.length * 100)
      : null;

    const efter = countEtter(modules, skippedPerMod || {}, deadlineMap);
    let statusTekst = '';
    if (efter > 0 || godkjent === 0) {
      statusTekst = `<span style="color:#5f5e5a">Grafikken under viser om lærestoff og oppgaver er glemt eller hoppet over.</span>`;
    } else if (foran > 0) {
      statusTekst = `<span style="color:#3b6d11">Du er i forkant — bra jobbet!</span>`;
    } else {
      statusTekst = `<span style="color:#3b6d11">Du følger planen</span>`;
    }

    contentEl.innerHTML = `
      <div class="ef-stat-row">
        <div class="ef-stat">
          <div class="ef-stat-num">${godkjent}</div>
          <div class="ef-stat-lbl">av ${totalLeksjoner} leksjoner<br>med innleveringer</div>
        </div>
        ${venter > 0 ? `<div class="ef-stat">
          <div class="ef-stat-num" style="color:#b07d00">${venter}</div>
          <div class="ef-stat-lbl">innleveringer<br>venter tilbakemelding</div>
        </div>` : ''}
        ${snitVisning !== null ? `<div class="ef-stat">
          <div class="ef-stat-num" style="color:${snitVisning >= 60 ? '#3b6d11' : snitVisning >= 30 ? '#5f5e5a' : '#b07d00'}">${snitVisning}%</div>
          <div class="ef-stat-lbl">snitt lærestoff<br>sett</div>
        </div>` : ''}
      </div>
      <div style="font-size:15px;margin-bottom:4px">${statusTekst}</div>
      ${venter > 0 ? `<div style="margin-top:6px;font-size:14px;color:#3a3a3a;">
        ${venter} innlevering${venter === 1 ? '' : 'er'} venter på tilbakemelding fra læreren
      </div>` : ''}

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
            <svg width="14" height="10"><circle cx="7" cy="5" r="3" fill="white" stroke="#3b6d11" stroke-width="0.8"/></svg>
            Levert oppgave
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10"><circle cx="7" cy="5" r="3" fill="white" stroke="#3a3a3a" stroke-width="0.8"/></svg>
            Mangler - oppgave ikke levert
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10"><circle cx="7" cy="5" r="3" fill="none" stroke="#888780" stroke-width="1.2" stroke-dasharray="2,1.5"/></svg>
            Fremtidig leksjon
          </div>
          <div class="ef-legend-item">
            <svg width="14" height="10"><line x1="7" y1="0" x2="7" y2="10" stroke="#888780" stroke-width="0.8" stroke-dasharray="3,2"/></svg>
            Nå
          </div>
        </div>
      </div>` : ''}

      <div style="margin-top:16px;border-top:1px solid #e8e6e0;padding-top:12px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <span style="font-size:11px;color:#9e9c97;">Data fra Canvas. Oppdateres automatisk etter 1 time.</span>
        <button id="ef-refresh-btn"
          style="background:#2d3b45;border:none;color:#fff;cursor:pointer;font-size:13px;font-weight:600;padding:8px 18px;border-radius:8px;font-family:inherit;white-space:nowrap;">
          ↻ Oppdater grafikken
        </button>
      </div>
    `;
    const refreshBtn = document.getElementById('ef-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        localStorage.removeItem(CACHE_KEY);
        const ce = document.getElementById('ef-content');
        if (ce) ce.innerHTML = '<div id="ef-loading">Henter data…</div>';
        loadAndRender();
      });
    }
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

  // Trekker ut første tall fra modulnavnet (f.eks. "Leksjon 3 – Tittel" → 3)
  function parseLessonNum(name) {
    const m = (name || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

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

    bars += `<line x1="0" y1="${labelH + 1}" x2="${W}" y2="${labelH + 1}" stroke="#d3d1c7" stroke-width="0.5" stroke-dasharray="2,3"/>`;
    bars += `<line x1="0" y1="${midY}" x2="${W}" y2="${midY}" stroke="#888780" stroke-width="1"/>`;

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
      // Linja strekkes fra -12 (over SVG-grensen, overflow:visible) til bunn
      bars += `<line x1="${nowLineX}" y1="-12" x2="${nowLineX}" y2="${totalH}" stroke="#888780" stroke-width="0.8" stroke-dasharray="3,2" opacity="0.7"/>`;
      // "Nå"-tekst plasseres godt over leksjonsnumrene (negative y, over SVG-toppen)
      bars += `<text x="${nowLineX}" y="-14" font-size="6.5" fill="#888780" text-anchor="middle" dominant-baseline="auto">Nå</text>`;
    }

    modules.forEach((mod, i) => {
      const mid       = String(mod.id);
      const x         = i * (barW + gap);
      const cx        = x + barW / 2;
      // Leksjonsnummer fra modulnavn (f.eks. "Leksjon 7") — fallback til løpenummer
      const num       = parseLessonNum(mod.name) ?? (i + 1);
      const due       = deadlineMap[mid] || null;
      const isPastDue = due && due <= now;
      const isStarted = mod.total > 0 && mod.completed > 0;

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

    modules.forEach((mod, i) => {
      const count = (deliveredPerMod || {})[String(mod.id)] || 0;
      if (count === 0) return;
      const cx = i * (barW + gap) + barW / 2;
      const r = 3, dotGap = 2;
      const maxD = Math.floor(upH / (r * 2 + dotGap));
      const dots = Math.min(count, maxD);
      for (let d = 0; d < dots; d++) {
        const cy = midY - r - 2 - d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#3b6d11" stroke-width="0.8"/>`;
      }
    });

    modules.forEach((mod, i) => {
      const count = (skippedPerMod || {})[String(mod.id)] || 0;
      if (count === 0) return;
      const cx = i * (barW + gap) + barW / 2;
      const r = 3, dotGap = 2;
      const maxD = Math.floor(downH / (r * 2 + dotGap));
      const dots = Math.min(count, maxD);
      for (let d = 0; d < dots; d++) {
        const cy = midY + r + 2 + d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="white" stroke="#3a3a3a" stroke-width="0.8"/>`;
      }
    });

    modules.forEach((mod, i) => {
      const mid       = String(mod.id);
      const due       = deadlineMap[mid] || null;
      const isPastDue = due && due <= now;
      if (isPastDue) return;
      const futureCount      = modAssignCountMap[mid] || 0;
      const alreadyDelivered = (deliveredPerMod || {})[mid] || 0;
      const remaining        = futureCount - alreadyDelivered;
      if (remaining <= 0) return;
      const cx = i * (barW + gap) + barW / 2;
      const r = 3, dotGap = 2;
      const maxD = Math.floor(downH / (r * 2 + dotGap));
      const dots = Math.min(remaining, maxD);
      for (let d = 0; d < dots; d++) {
        const cy = midY + r + 2 + d * (r * 2 + dotGap);
        bars += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dedad4" stroke="#888780" stroke-width="1"/>`;
      }
    });

    return `<svg width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}"
      overflow="visible" style="display:block;margin-top:20px;min-width:${W}px">${defs}${bars}</svg>`;
  }

})();


// ============================================================
// Leksjonsfremdrift – horisontal chevron-bar per modul
// Vises bare for elever (og lærere i student view) når
// ENV.MODULE_ITEM_ID eller ?module_item_id er satt.
// ============================================================

(function () {
  'use strict';

  const ENV = window.ENV || {};
  const userId = ENV.current_user_id;
  if (!userId) return;

  // Skjul for lærere og administratorer (student view gir student-rolle)
  const roles = ENV.current_user_roles || [];
  if (roles.some(r => ['teacher','TeacherEnrollment','admin','AccountAdmin',
                        'DesignerEnrollment','TaEnrollment'].includes(r))) return;

  // ─── Konstanter ───────────────────────────────────────────────────────────
  const BAR_ID    = 'ef-chevron-bar';
  const BAR_H     = 44;  // px, bar-høyde — rommer den store gjeldende-kulen
  const BEAD_D    = 26;  // px, normal kule-diameter
  const BEAD_CUR  = 38;  // px, gjeldende kule — markant større
  const LINE_H    = 5;   // px, linjetykkelse
  const CACHE_TTL = 5 * 60 * 1000;

  // Elementtyper som typisk har datofrist (oppgaver/quiz — avrundet firkant i baren)
  const DEADLINE_TYPES = new Set(['Assignment', 'Quiz', 'Discussion']);

  let lastUrl      = location.href;
  let lastItemId   = null;

  // ─── Hjelpere ─────────────────────────────────────────────────────────────
  function getCourseId() {
    const m = location.pathname.match(/\/courses\/(\d+)/);
    return m ? m[1] : null;
  }

  function getCurrentItemId() {
    // 1. ENV satt av Canvas på modulside
    if (ENV.MODULE_ITEM_ID) return String(ENV.MODULE_ITEM_ID);
    // 2. URL query-param (Canvas SPA-navigasjon bruker denne)
    const qp = new URLSearchParams(location.search).get('module_item_id');
    if (qp) return qp;
    // 3. Direkte URL /modules/items/123
    const m = location.pathname.match(/\/modules\/items\/(\d+)/);
    if (m) return m[1];
    // 4. sessionStorage — satt av Todo-navigasjonshjelper, overlever Canvas /taking/-redirect
    try {
      const nav = JSON.parse(sessionStorage.getItem('gs_todo_nav') || 'null');
      if (nav && String(nav.courseId) === String(getCourseId())) {
        const re = new RegExp('/(assignments|quizzes|discussion_topics|pages)/' + nav.contentId + '(/|$|\\?)');
        if (re.test(location.pathname)) return nav.itemId;
      }
    } catch (e) { /* ignorér */ }
    return null;
  }

  function getNavHeight() {
    // Canvas sin globale navigasjon er en VERTIKAL venstre-sidebar (id="header"),
    // ikke en horisontal topbar — å bruke offsetHeight på den gir hele sidehøyden.
    // Sjekk i stedet etter en eventuell masquerade-banner øverst på siden.
    const topBanner = document.querySelector(
      '.ic-app-header__secondary-navigation, .ic-StickyBar--top, [data-testid="masquerade-bar"], #masquerade_bar'
    );
    if (topBanner) {
      const h = topBanner.getBoundingClientRect().height;
      if (h > 0) return h;
    }
    return 0;
  }

  async function fetchAllPages(url) {
    const results = [];
    let next = url;
    while (next) {
      const r = await fetch(next, { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const page = await r.json();
      results.push(...(Array.isArray(page) ? page : [page]));
      const link = r.headers.get('Link') || '';
      const m = link.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return results;
  }

  async function fetchModules(courseId) {
    const cacheKey = `ef_chevron_${courseId}_${userId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch (e) { /* ignorér */ }

    let data = await fetchAllPages(
      `/api/v1/courses/${courseId}/modules?include[]=items&student_id=${userId}&per_page=50`
    );

    // Fallback: Canvas returnerer av og til moduler uten items inline.
    // Hent da items separat per modul via eget endepunkt.
    if (data.length > 0 && !Array.isArray(data[0].items)) {
      data = await Promise.all(data.map(async mod => {
        try {
          const items = await fetchAllPages(
            `/api/v1/courses/${courseId}/modules/${mod.id}/items?student_id=${userId}&per_page=100`
          );
          return { ...mod, items };
        } catch (e) {
          return { ...mod, items: [] };
        }
      }));
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
    } catch (e) { /* ignorér */ }

    return data;
  }

  function findModuleForItem(modules, itemId) {
    for (const mod of modules) {
      if (!Array.isArray(mod.items)) continue;
      const item = mod.items.find(it => String(it.id) === String(itemId));
      if (item) return { mod, item };
    }
    return null;
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  function removeBar() {
    const el = document.getElementById(BAR_ID);
    if (el) el.remove();
    // Gjenopprett flytende Min fremdrift-knapp på sider uten bar
    const efBtn = document.getElementById('ef-btn');
    if (efBtn) efBtn.style.display = '';
  }

  function render(mod, currentItemId) {
    removeBar();

    const items = (mod.items || []).filter(it => it.type !== 'SubHeader');
    if (items.length < 2) return;

    // ── Kuleramme-design ──────────────────────────────────────────────────────
    // Tykk mørk horisontal linje med kuler for hvert element.
    // Linjestykket mellom to kuler er delt i to halvdeler (to divs):
    //   venstre halvdel: grønn skygge hvis venstre kule er fullført, ellers grå
    //   høyre halvdel:   grønn skygge hvis høyre kule er fullført, ellers grå
    // Linjefargen er alltid mørk grå — det er SKYGGEN som er grønn.
    // Gjeldende kule er markant større enn de andre.
    // Oppgaver/quiz: avrundet firkant + liten amber-prikk.

    const LINE_COLOR     = '#2e2e2e';
    const SH_GRAY_TOP    = 'rgba(0,0,0,0.24)';
    const SH_GRAY_BOT    = 'rgba(0,0,0,0.10)';
    const SH_GREEN_TOP   = 'rgba(52,160,71,0.55)';  // tydelig men ikke voldsom
    const SH_GREEN_BOT   = 'rgba(52,160,71,0.14)';

    const bar = document.createElement('div');
    bar.id = BAR_ID;
    Object.assign(bar.style, {
      position:            'sticky',
      top:                 '0',
      display:             'flex',
      alignItems:          'center',
      zIndex:              '8500',
      background:          'rgba(252,251,248,0.95)',
      backdropFilter:      'blur(8px)',
      WebkitBackdropFilter:'blur(8px)',
      borderBottom:        '1px solid rgba(0,0,0,0.07)',
      boxShadow:           '0 1px 6px rgba(0,0,0,0.08)',
      padding:             '0 12px',
      minHeight:           BAR_H + 'px',
      marginBottom:        '8px',
      overflow:            'visible',
    });

    // Modulnavn-etikett til venstre
    const modLabel = document.createElement('span');
    Object.assign(modLabel.style, {
      fontSize:      '9px',
      fontWeight:    '600',
      color:         '#4a4a4a',
      whiteSpace:    'nowrap',
      marginRight:   '12px',
      letterSpacing: '0.06em',
      flexShrink:    '0',
      textTransform: 'uppercase',
    });
    modLabel.textContent = mod.name || 'Leksjon';
    modLabel.title = mod.name || '';
    bar.appendChild(modLabel);

    // Stepper-wrapper
    const stepWrap = document.createElement('div');
    Object.assign(stepWrap.style, {
      flex:       '1',
      display:    'flex',
      alignItems: 'center',
      minWidth:   '0',
      overflow:   'visible',
    });

    items.forEach((item, i) => {
      const isCurrent    = String(item.id) === String(currentItemId);
      const isDone       = !!(item.completion_requirement && item.completion_requirement.completed);
      const isAssignment = DEADLINE_TYPES.has(item.type);
      const beadD        = isCurrent ? BEAD_CUR : BEAD_D;

      // ── Linjestykke mellom forrige og gjeldende kule ──────────────────────
      if (i > 0) {
        const prevDone    = !!(items[i-1].completion_requirement && items[i-1].completion_requirement.completed);
        const shLeft  = prevDone
          ? `0 -5px 10px ${SH_GREEN_TOP}, 0 3px 6px ${SH_GREEN_BOT}`
          : `0 -3px 6px ${SH_GRAY_TOP}, 0 3px 4px ${SH_GRAY_BOT}`;
        const shRight = isDone
          ? `0 -5px 10px ${SH_GREEN_TOP}, 0 3px 6px ${SH_GREEN_BOT}`
          : `0 -3px 6px ${SH_GRAY_TOP}, 0 3px 4px ${SH_GRAY_BOT}`;

        const seg = document.createElement('div');
        Object.assign(seg.style, { flex: '1', display: 'flex', minWidth: '8px', overflow: 'visible' });

        const lh = document.createElement('div');
        Object.assign(lh.style, { flex: '1', height: LINE_H + 'px', background: LINE_COLOR, boxShadow: shLeft });

        const rh = document.createElement('div');
        Object.assign(rh.style, { flex: '1', height: LINE_H + 'px', background: LINE_COLOR, boxShadow: shRight });

        seg.appendChild(lh);
        seg.appendChild(rh);
        stepWrap.appendChild(seg);
      }

      // ── Kule ──────────────────────────────────────────────────────────────
      const bead = document.createElement('a');
      bead.title = item.title || '';
      if (item.html_url) bead.href = item.html_url;

      // Gjeldende: mørk fyll, hvit tekst, markant større — "du er her"
      // Fullførte: lett transparent grønn fyll + grønn kant + hvit ✓
      // Øvrige: hvit fyll, svart kant, svart tall (outline)
      let beadBg, beadBorder, beadColor, beadWeight, beadShadow, beadFs;
      if (isCurrent) {
        beadBg     = '#1a1a1a';
        beadBorder = 'none';
        beadColor  = '#fff';
        beadWeight = '800';
        beadShadow = '0 0 0 4px rgba(26,26,26,0.13), 0 3px 12px rgba(0,0,0,0.28)';
        beadFs     = '14px';
      } else if (isDone) {
        beadBg     = 'rgba(52,160,71,0.13)';
        beadBorder = '2px solid #2d7a3a';
        beadColor  = '#1a5c2e';
        beadWeight = '700';
        beadShadow = '0 0 0 2px rgba(52,160,71,0.18), 0 2px 6px rgba(45,122,58,0.20)';
        beadFs     = '12px';
      } else {
        beadBg     = '#fff';
        beadBorder = '2px solid #1a1a1a';
        beadColor  = '#1a1a1a';
        beadWeight = '600';
        beadShadow = '0 2px 5px rgba(0,0,0,0.15)';
        beadFs     = '12px';
      }

      Object.assign(bead.style, {
        width:          beadD + 'px',
        height:         beadD + 'px',
        borderRadius:   isAssignment ? '5px' : '50%',
        background:     beadBg,
        border:         beadBorder,
        color:          beadColor,
        fontWeight:     beadWeight,
        fontSize:       beadFs,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        textDecoration: 'none',
        flexShrink:     '0',
        position:       'relative',
        boxShadow:      beadShadow,
        cursor:         'pointer',
        fontFamily:     'inherit',
        zIndex:         '1',
      });

      bead.textContent = isDone ? '✓' : String(i + 1);

      // Liten amber-prikk for oppgaver/quiz som ikke er fullført
      if (isAssignment && !isDone) {
        const dot = document.createElement('span');
        Object.assign(dot.style, {
          position: 'absolute', top: '-2px', right: '-2px',
          width: '6px', height: '6px', borderRadius: '50%',
          background: '#d4940a', border: '1.5px solid #f5f4f0',
          pointerEvents: 'none',
        });
        bead.appendChild(dot);
      }

      stepWrap.appendChild(bead);
    });

    bar.appendChild(stepWrap);
    bar.appendChild(makePill());
    injectBar(bar);
  }

  // ── Hjelpere delt mellom render() og renderMinimalBar() ───────────────────

  function makePill() {
    const pill = document.createElement('button');
    Object.assign(pill.style, {
      flexShrink:   '0',
      marginLeft:   '0',
      background:   '#fff',
      color:        '#1a1a1a',
      border:       '2px solid #1a1a1a',
      borderRadius: '20px',
      padding:      '5px 14px 5px 10px',
      fontSize:     '14px',
      fontWeight:   '600',
      cursor:       'pointer',
      display:      'flex',
      alignItems:   'center',
      gap:          '4px',
      whiteSpace:   'nowrap',
      fontFamily:   'inherit',
      transition:   'background 0.12s, color 0.12s',
      boxShadow:    '0 1px 4px rgba(0,0,0,0.10)',
    });
    pill.innerHTML = `<svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
      <rect x="1.5" y="3.5" width="14" height="10" rx="2"/>
      <rect x="15.5" y="6" width="1.5" height="5" rx="0.75" fill="currentColor" stroke="none"/>
      <rect x="3" y="9" width="2.5" height="3" rx="0.5" fill="currentColor" stroke="none"/>
      <rect x="7" y="6.5" width="2.5" height="5.5" rx="0.5" fill="currentColor" stroke="none"/>
      <rect x="11" y="7.5" width="2.5" height="4.5" rx="0.5" fill="currentColor" stroke="none"/>
    </svg>Min fremdrift`;
    pill.setAttribute('aria-label', 'Se din fremdrift');
    pill.addEventListener('mouseenter', () => { pill.style.background = '#1a1a1a'; pill.style.color = '#fff'; });
    pill.addEventListener('mouseleave', () => { pill.style.background = '#fff'; pill.style.color = '#1a1a1a'; });
    pill.addEventListener('click', () => {
      const efBtn = document.getElementById('ef-btn');
      if (efBtn) efBtn.click();
    });
    return pill;
  }

  function injectBar(bar) {
    // Skjul flytende knapp — pille i baren tar over
    const efBtn = document.getElementById('ef-btn');
    if (efBtn) efBtn.style.display = 'none';

    const anchor = document.querySelector('#breadcrumbs, .ic-app-crumbs, .ic-app-nav-toggle-and-crumbs');
    if (anchor) {
      anchor.insertAdjacentElement('afterend', bar);
    } else {
      const container = document.querySelector('.ic-Layout-contentMain, #content, #main');
      if (container) container.insertBefore(bar, container.firstChild);
      else document.body.appendChild(bar);
    }
  }

  // ── Minimal bar — vises på kurssider uten leksjonsinnhold ─────────────────
  // Holder "Min fremdrift"-pille på fast plass etter brødsmulestien.
  // Viser "X av Y leksjoner" fra cache hvis tilgjengelig.

  function renderMinimalBar() {
    removeBar();
    if (!location.pathname.match(/\/courses\/\d+/)) return;

    const bar = document.createElement('div');
    bar.id = BAR_ID;
    Object.assign(bar.style, {
      position:            'sticky',
      top:                 '0',
      display:             'flex',
      alignItems:          'center',
      justifyContent:      'flex-end',
      gap:                 '12px',
      zIndex:              '8500',
      background:          'rgba(252,251,248,0.95)',
      backdropFilter:      'blur(8px)',
      WebkitBackdropFilter:'blur(8px)',
      borderBottom:        '1px solid rgba(0,0,0,0.07)',
      boxShadow:           '0 1px 6px rgba(0,0,0,0.08)',
      padding:             '0 16px',
      minHeight:           BAR_H + 'px',
      marginBottom:        '8px',
    });

    // Vis "Oppsummering: X av Y leksjoner har innleveringer →" fra cache
    const courseId = getCourseId();
    if (courseId) {
      try {
        const cacheKey = `ef_data_${courseId}_${userId}`;
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const { ts, data } = JSON.parse(raw);
          if (Date.now() - ts < 60 * 60 * 1000 && data && data.totalLeksjoner) {
            const summary = document.createElement('span');
            Object.assign(summary.style, {
              fontSize:   '14px',
              color:      '#2d3b45',
              fontFamily: 'inherit',
            });
            summary.textContent = `Oppsummering: ${data.godkjent} av ${data.totalLeksjoner} leksjoner har innleveringer →`;
            bar.appendChild(summary);
          }
        }
      } catch (e) { /* ignorér */ }
    }

    bar.appendChild(makePill());
    injectBar(bar);
  }

  // ─── URL-matching som fallback ────────────────────────────────────────────
  // Når module_item_id mangler i ENV og URL, sammenligner vi gjeldende
  // nettleser-sti mot html_url på hvert modulitem fra API-responsen.
  function findItemByPath(modules, pathname) {
    // Normaliser stien: fjern /taking/\d+ (Canvas redirecter hit når quiz er påbegynt)
    const normalizedPath = pathname.replace(/\/taking\/\d+$/, '');
    for (const mod of modules) {
      for (const item of (mod.items || [])) {
        if (!item.html_url) continue;
        try {
          const itemPath = new URL(item.html_url, location.origin).pathname;
          // Fjern eventuell trailing slash før sammenligning
          if (itemPath.replace(/\/$/, '') === normalizedPath.replace(/\/$/, '')) {
            return { mod, item };
          }
        } catch (e) { /* ignorér ugyldig URL */ }
      }
    }
    return null;
  }

  // ─── Oppdatering ──────────────────────────────────────────────────────────
  async function update() {
    const courseId = getCourseId();
    if (!courseId) { removeBar(); return; }

    const itemId = getCurrentItemId();

    // Ugyldiggjør cache ved hvert sideskifte så fullføringsstatus er fersk
    const cacheKey = `ef_chevron_${courseId}_${userId}`;
    if (itemId !== lastItemId) {
      try { sessionStorage.removeItem(cacheKey); } catch (e) { /* ignorér */ }
      lastItemId = itemId;
    }

    try {
      const modules = await fetchModules(courseId);

      let found = null;

      // Primær: item-ID fra ENV eller URL-param
      if (itemId) {
        found = findModuleForItem(modules, itemId);
      }

      // Fallback: match gjeldende URL-sti mot html_url på modulitems
      // Dekker tilfeller der module_item_id mangler (direktelenke, maskerering)
      if (!found) {
        found = findItemByPath(modules, location.pathname);
      }

      if (!found) { renderMinimalBar(); return; }

      render(found.mod, found.item ? found.item.id : itemId);
    } catch (e) {
      console.warn('[ef-chevron] Feil ved henting:', e);
    }
  }

  // Vent til DOM er klar, deretter start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }

  // SPA-navigasjon — Canvas endrer URL uten full reload
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeBar();
      setTimeout(update, 350); // Liten pause så Canvas rekker å sette ENV
    }
  }, 400);

})();


// ============================================================
// Startside-redirect — elever sendes alltid til første item
// i en leksjon (modul) dersom de ikke har fullført det ennå.
// Gjelder klikk på modulsiden OG lenker i todo-lista.
// ============================================================

(function () {
  'use strict';

  const ENV = window.ENV || {};
  const userId = ENV.current_user_id;
  if (!userId) return;

  // Bare elever
  const roles = ENV.current_user_roles || [];
  if (roles.some(r => ['teacher','TeacherEnrollment','admin','AccountAdmin',
                        'DesignerEnrollment','TaEnrollment'].includes(r))) return;

  const CACHE_TTL = 5 * 60 * 1000;

  function getCourseId() {
    const m = location.pathname.match(/\/courses\/(\d+)/);
    return m ? m[1] : null;
  }

  async function fetchAllPages(url) {
    const results = [];
    let next = url;
    while (next) {
      const r = await fetch(next, { credentials: 'include' });
      if (!r.ok) return results;
      const page = await r.json();
      results.push(...(Array.isArray(page) ? page : [page]));
      const link = r.headers.get('Link') || '';
      const m = link.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return results;
  }

  async function getModules(courseId) {
    const key = `ef_chevron_${courseId}_${userId}`;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch (e) { /* ignorér */ }

    let data = await fetchAllPages(
      `/api/v1/courses/${courseId}/modules?include[]=items&student_id=${userId}&per_page=50`
    );
    // Fallback: Canvas returnerer av og til moduler uten items inline
    if (data.length > 0 && !Array.isArray(data[0].items)) {
      data = await Promise.all(data.map(async mod => {
        try {
          const items = await fetchAllPages(
            `/api/v1/courses/${courseId}/modules/${mod.id}/items?student_id=${userId}&per_page=100`
          );
          return { ...mod, items };
        } catch (e) { return { ...mod, items: [] }; }
      }));
    }
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch (e) { /* ignorér */ }
    return data;
  }

  // Finn modulen som inneholder et gitt item-ID
  function findModule(modules, itemId) {
    for (const mod of modules) {
      const item = (mod.items || []).find(it => String(it.id) === String(itemId));
      if (item) return { mod, item };
    }
    return null;
  }

  // Er første navigerbare item i modulen fullført?
  function firstItemCompleted(mod) {
    const navigable = (mod.items || []).filter(it => it.type !== 'SubHeader' && it.html_url);
    if (navigable.length === 0) return true; // ingen items = ikke relevant
    const first = navigable[0];
    return !!(first.completion_requirement && first.completion_requirement.completed);
  }

  // Hent URL til første navigerbare item i modulen
  function firstItemUrl(mod) {
    const navigable = (mod.items || []).filter(it => it.type !== 'SubHeader' && it.html_url);
    return navigable.length > 0 ? navigable[0].html_url : null;
  }

  // Beregn hvilken URL brukeren skal sendes til.
  // Returnerer startsideURL dersom første item ikke er fullført, ellers originalHref.
  async function getDestinationUrl(itemId, courseId, originalHref) {
    const modules  = await getModules(courseId);
    const found    = findModule(modules, itemId);
    if (!found) return originalHref;

    const navigable = (found.mod.items || []).filter(it => it.type !== 'SubHeader' && it.html_url);
    if (navigable.length === 0) return originalHref;
    // Klikket er allerede på første item → ikke redirect
    if (String(navigable[0].id) === String(itemId)) return originalHref;

    if (!firstItemCompleted(found.mod)) {
      const url = firstItemUrl(found.mod);
      if (url) return url;
    }
    return originalHref;
  }

  // ─── Modulsiden ───────────────────────────────────────────────────────────
  function attachModulePageListener() {
    if (!location.pathname.match(/\/courses\/\d+\/modules/)) return;
    const courseId = getCourseId();
    if (!courseId) return;

    document.addEventListener('click', function (e) {
      const link = e.target.closest('.ig-title a, .module-item-title a, .item_link');
      if (!link) return;

      const params = new URLSearchParams(new URL(link.href, location.origin).search);
      const itemId = params.get('module_item_id');
      if (!itemId) return;

      // preventDefault MÅ kalles synkront — ikke inne i en await
      e.preventDefault();
      e.stopPropagation();

      getDestinationUrl(itemId, courseId, link.href)
        .then(dest => { location.href = dest; })
        .catch(() => { location.href = link.href; });
    }, true);
  }

  // ─── Todo-lista ───────────────────────────────────────────────────────────
  function attachTodoListener() {
    const TODO_SELS = [
      '.planner-todosidebar a[href*="/courses/"]',
      '.ToDoSidebar a[href*="/courses/"]',
      '.todo-list a[href*="/courses/"]',
      '[data-testid="todo-item"] a[href*="/courses/"]',
      '.PlannerItem a[href*="/courses/"]',
    ];

    document.addEventListener('click', function (e) {
      const link = e.target.closest(TODO_SELS.join(', '));
      if (!link) return;

      try {
        const url      = new URL(link.href, location.origin);
        const cm       = url.pathname.match(/\/courses\/(\d+)/);
        const courseId = cm ? cm[1] : null;
        if (!courseId) return;

        // Prøv module_item_id direkte fra URL
        const itemId = new URLSearchParams(url.search).get('module_item_id');
        if (itemId) {
          e.preventDefault();
          e.stopPropagation();
          getDestinationUrl(itemId, courseId, link.href)
            .then(dest => { location.href = dest; })
            .catch(() => { location.href = link.href; });
          return;
        }

        // Fallback: finn content_id fra URL-stien og søk i modul-cachen
        const contentMatch = url.pathname.match(/\/(assignments|quizzes|discussion_topics)\/(\d+)/);
        if (!contentMatch) return;
        const contentId = contentMatch[2];

        e.preventDefault();
        e.stopPropagation();

        getModules(courseId).then(modules => {
          for (const mod of modules) {
            const item = (mod.items || []).find(it =>
              String(it.content_id) === String(contentId) && it.html_url
            );
            if (item) {
              // Lagre item-ID i sessionStorage — overlever Canvas /taking/-redirect
              try { sessionStorage.setItem('gs_todo_nav', JSON.stringify({ courseId, itemId: String(item.id), contentId })); } catch (e2) {}
              location.href = item.html_url;
              return;
            }
          }
          location.href = link.href; // ikke funnet i modul — gå til original
        }).catch(() => { location.href = link.href; });

      } catch (err) { /* ignorér */ }
    }, true);
  }

  // Start — vent til DOM er klar
  function init() {
    attachModulePageListener();
    attachTodoListener();

    // SPA: koble på nytt når Canvas navigerer til modulsiden
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        attachModulePageListener();
      }
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
