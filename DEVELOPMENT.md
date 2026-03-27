# Canvas Aktivitetskolonne — Utviklerdokumentasjon

Dette dokumentet beskriver arkitektur, designbeslutninger, kjente begrensninger og fremtidig retning for prosjektet. Beregnet for videre utvikling.

---

## Kontekst

Utvidelsen er utviklet for en norsk nettskole (Globalskolen) med:
- Elever i alderen 6–16 år i over 100 land
- Alle tidssoner representert
- Canvas LMS på `globalskolen.instructure.com`
- Kurs organisert i leksjoner med navneformat `L 23 – Oppgavetittel`
- To semester per år (høst/vår), kursinnhold kopieres mellom år
- Lærere på faste kontorplasser, noen mobile

**Kjernebehovet:** Lærere trenger raskt å identifisere elever som henger etter og trenger oppfølging, uten å navigere bort fra vurderingsoversikten.

---

## Arkitektur

```
canvas-aktivitet/
├── manifest.json       Chrome Manifest V3
├── content.js          Hovedlogikk — injiseres på gradebook-siden
├── popup.html          Innstillingspanel (klikk utvidelsesikon)
├── popup.js            Innstillingslogikk
├── icons/              PNG-ikoner (16, 48, 128px) — grønn ring
└── README.md           Brukerdokumentasjon
```

### Dataflyt

```
Canvas API (3 parallelle kall)
    ├── /enrollments?include[]=last_activity_at
    ├── /students/submissions
    └── /assignments
            ↓
    Beregning i content.js (kun i RAM)
            ↓
    chrome.storage.local (cache, 1 time)
            ↓
    SVG overlay injisert i SlickGrid viewport
```

### Overlay-teknikk

Canvas sin gradebook bruker SlickGrid med virtuell scrolling. Vi kan ikke manipulere grid-radene direkte uten at Canvas overskriver endringene.

**Løsning:** Et absolutt-posisjonert overlay-element festes som barn av SlickGrid sin fryst viewport (`.slick-viewport-left`). Dette gir samme koordinatsystem som radenes `style.top`-verdier, slik at ingen scroll-kalkuleringer er nødvendig.

Overlay-panelet er posisjonert på høyre kant av navnekolonnen (`colWidth - COL_W - 10`px) slik at Merknader-kolonnen alltid er synlig.

---

## Innstillinger

Lagres i `chrome.storage.sync` (synkroniseres mellom maskiner):

| Nøkkel | Type | Standard | Beskrivelse |
|--------|------|----------|-------------|
| `visible` | bool | true | Vis/skjul kolonnen |
| `loginGreen` | number | 3 | Tykk ring: innlogget innen X dager |
| `loginYellow` | number | 10 | Medium ring: innlogget innen X dager |
| `submissionGreen` | number | 7 | ✓: levert innen X dager |
| `submissionYellow` | number | 21 | –: levert innen X dager |
| `lessonThreshold` | number | 50 | % levert for at leksjon regnes som godkjent |
| `countVoluntary` | bool | false | Tell frivillige oppgaver (uten due_at) |
| `countQuizzes` | bool | false | Tell online_quiz-oppgaver |
| `rowHighlight` | bool | true | Fargemark rader basert på leksjonsfremdrift |

Cache lagres i `chrome.storage.local` med nøkkel `cak_data_{courseId}` og tidsstempel `cak_last_updated`.

---

## Leksjonsbasert fremdriftsberegning

### Bakgrunn

Skolen bruker Canvas "missing"-flagget for oppgaver som ikke er levert etter fristen. Vi baserer oss på dette fremfor å beregne forsinkelse selv.

Oppgaver grupperes per leksjon basert på tittelprefix: `/L\s*(\d+)/i`

Eksempel: `"L 23 – Innleveringsoppgave"` → leksjon `"23"`

### Algoritme

```javascript
for each leksjon:
  total    = antall relevante oppgaver (ekskl. quiz/frivillig hvis bryterne er av)
  delivered = antall med submitted_at
  missing  = antall med missing: true (kun obligatoriske)
  ahead    = antall levert med fremtidig due_at

  completion = delivered / total

  if completion >= threshold:
    if ahead > 0: netDelta += 1   // leksjonen teller positivt
  else:
    netDelta -= 1                  // leksjonen trekker ned

// Ignorer leksjoner uten noen aktivitet (delivered=0, missing=0)
```

### Viktige designbeslutninger

- **Trekk 1 per leksjon, ikke per missing-oppgave** — unngår eksplosive verdier
- **Tell leksjoner i forkant, ikke oppgaver** — én leksjon = +1 uansett antall oppgaver
- **Ignorer uleverte uten missing** — fremtidige frister er ikke forsinkelse
- **Frivillige teller aldri negativt** — de er ikke et krav
- **Leksjoner ikke påbegynt ignoreres** — eleven er i rute, ikke på etterskudd

### Tidslinjevisualisering

```
delta klemmes til [-5, +5] for visuell mapping
x = mid + (clamped / 5) * halfRange

Farger:
  delta >= 1  → #3b6d11 (mørk grønn)
  delta == 0  → #639922 (grønn)
  delta >= -2 → #ba7517 (oransje)
  delta < -2  → #a32d2d (rød)
```

### Fargemerking av rader

```
delta <= -4 → rgba(200, 70, 60, 0.13)   rød
delta <= -3 → rgba(210, 100, 80, 0.09)  lys rød
delta <= -2 → rgba(210, 140, 100, 0.06) lys rosa
```

Fargen settes på `.slick-cell`-elementene direkte i Canvas sin DOM.

---

## DOM-selektorer

Canvas bruker SlickGrid og DOM-strukturen kan variere mellom versjoner:

```javascript
// Fryst canvas (navnekolonnen)
'.slick-viewport.slick-viewport-bottom.slick-viewport-left .grid-canvas'
'.slick-viewport.slick-viewport-top.slick-viewport-left .grid-canvas'
'.container_0 .slick-viewport .grid-canvas'
'.grid-canvas-left'
'.grid-canvas'  // fallback

// Fryst header
'.slick-header.slick-header-left'
'.container_0 .slick-header'
'.slick-header-left'
'.slick-header'

// Student-ID fra rad
// 1. <a href="/courses/X/grades/STUDENT_ID">
// 2. <a href="/courses/X/users/STUDENT_ID">
// 3. data-student-id attributt
```

---

## Caching

Data caches per kurs i `chrome.storage.local`:

```javascript
cak_data_{courseId}: {
  ts: Date.now(),
  data: { [userId]: { lastActivity, lastSubmission, deadlineDelta, deadlineCount, hasDeadlines } }
}
```

Cache-levetid: 1 time (3 600 000 ms)

"Oppdater nå"-knappen i popup:
1. Sletter `cak_data_{courseId}` fra local storage
2. Laster Canvas-siden på nytt
3. content.js henter ferske data fra API

---

## MutationObserver

Observer er festet til `#gradebook_grid` / `.Gradebook__GradebookBody` / `#application`.

Viktig: Observer ignorerer mutasjoner som stammer fra vårt eget overlay (sjekker `overlayEl.contains(m.target)`). Uten denne sjekken vil overlay-oppdateringer trigge nye overlay-oppdateringer i en evig løkke.

`isUpdating`-flagget brukes som sekundær guard.

---

## Kjente begrensninger og bugs

### DOM
- SlickGrid-strukturen varierer mellom Canvas-versjoner. Hvis overlay ikke vises, er sannsynlig årsak at selectorene ikke treffer.
- Kolonnen henger av og til ved navigering mellom kurs. "Oppdater nå" løser det.

### Leksjonslogikk
- Regex `/L\s*(\d+)/i` matcher ikke `L-23` (bindestrek). Enkel fix: `/L[\s-]*(\d+)/i`
- Oppgaver uten `L`-prefix havner i `__ukjent__`-leksjon og kan påvirke beregningen uventet
- Frivillige quizer som er levert teller ikke positivt selv om `countVoluntary` er på, hvis `countQuizzes` er av

### Sortering
- Sorteringsfunksjonen (klikk på header) er implementert men sorterer kun overlay-cellene, ikke Canvas sine rader. Resultatet er at symbolene ikke stemmer med elevnavnene i sorteringsmodus. Midlertidig deaktivert i praksis.

### Cache
- Cache lagres per kurs-ID, ikke per lærer. Hvis to lærere bruker samme maskin og kurs, deles cachen.

---

## Fremtidig utvikling

### Planlagt (avklart med bruker)

**Purreassistent**
Klikk på elev i aktivitetskolonnen → panel åpnes med:
- Elevens aktivitetsdata
- Logg over tidligere kontakt (lagres i chrome.storage.local)
- Knapp: "Åpne i Canvas Innboks" med ferdig utkast til melding

**Journalintegrasjon**
Skolen har et webbasert journalsystem. Mål: klikk i Canvas → åpner journalsystemet direkte på riktig elev, evt. med forhåndsutfylt notat via URL-parametere eller API.

**Fargemerking-forbedringer**
Vurdere å bruke samme fargeskala som Canvas sin egen "Mangler"-rosa for bedre visuell harmonering.

**Sortering**
Fungerende sortering krever enten:
a) Manipulering av Canvas sin SlickGrid-datamodell (komplekst)
b) Et eget panel/modal som viser elevene sortert etter prioritet, separat fra gradebook-griden

**Regex-utvidelse**
Støtte for `L-23`-format: bytt `/L\s*(\d+)/i` med `/L[\s-]*(\d+)/i`

**Semester-reset**
Ved semesterstart nullstilles cachen automatisk basert på dato, slik at ny leksjonsstruktur plukkes opp uten manuell oppdatering.

### Vurdert men ikke besluttet

- Eksport av aktivitetsdata til CSV for møter med foresatte
- Støtte for egendefinerte leksjonsformat (konfigurerbart regex)
- Notifikasjoner når elever ikke har vært innlogget over X dager

---

## Prioritetsformel (for fremtidig sortering)

```javascript
score = (dager siden innlogging  × 1.0)
      + (dager siden innlevering × 1.5)
      + (leksjoner under terskel × 2.0)

// Ukjente elever (ingen data) → score 99999 (øverst)
// Høyest score = trenger mest oppfølging
```

---

## Canvas API-endepunkter

```
GET /api/v1/courses/:id/enrollments
  ?type[]=StudentEnrollment
  &include[]=last_activity_at
  &per_page=100

GET /api/v1/courses/:id/students/submissions
  ?student_ids[]=all
  &per_page=100
  (returnerer: submitted_at, missing, assignment_id, user_id)

GET /api/v1/courses/:id/assignments
  ?per_page=100
  (returnerer: id, name, due_at, submission_types)
```

Alle kall bruker `credentials: 'include'` — autentisering via eksisterende Canvas-sesjon, ingen API-token nødvendig.

Paginering håndteres via `Link`-header med `rel="next"`.

---

## Fargepalett

Symbolfarger (grønn-skala fra Canvas sin egen palett):
```
#3b6d11  Mørk grønn — aktiv/i forkant
#639922  Grønn — i rute
#97c459  Lys grønn — medium aktivitet
#b4b2a9  Grå — inaktiv/ingen data
#ba7517  Oransje — litt etter
#a32d2d  Rød — klart etter / aldri levert
```

---

## Versionshistorikk

Se CHANGELOG.md
