# Veikart — Canvas Elevoppfølgingsplattform

Dette dokumentet beskriver planlagt videre utvikling. Aktivitetskolonnen er første byggestein i en større plattform for elevoppfølging.

---

## Visjon

En lærer med 20 minutter til oppfølging skal med ett blikk kunne:
1. Se hvem som trenger kontakt (aktivitetskolonnen)
2. Se hva som er avtalt tidligere (journalintegrasjon)
3. Sende en melding eller logge en hendelse (purreassistent)

Alt uten å forlate Canvas.

---

## Utvidelse 1 — Aktivitetskolonne ✅ (i beta)

Se README.md og DEVELOPMENT.md.

---

## Utvidelse 2 — Purreassistent (planlagt)

### Konsept
Klikk på en elev i aktivitetskolonnen → et panel åpnes med:

```
┌─────────────────────────────────────┐
│ Kari Nordmann                        │
│ ○ ✗ [●───]  2 leksjoner etter       │
│                                     │
│ Hendelseslogg:                      │
│ 24.03 Purret i Innboks              │
│ 10.03 Avtale med mor — ny frist     │
│                                     │
│ Logg:  [Purret] [Avtale] [Annet]    │
│ Notat: [________________________]   │
│                                     │
│ [Åpne i Canvas Innboks →]           │
└─────────────────────────────────────┘
```

### Datalagring
- Hendelseslogg lagres i `chrome.storage.local` per elev per kurs
- Ingen elevdata sendes ut av nettleseren
- Format: `cak_journal_{courseId}_{userId}: [{dato, type, notat}]`

### Canvas Innboks-integrasjon
Canvas Innboks-URL med forhåndsutfylt mottaker:
```
/conversations?user_id=STUDENT_ID
```
Eller direkte melding via Canvas API:
```
POST /api/v1/conversations
{ recipients: [userId], body: "...", subject: "..." }
```

### Meldingsutkast
Genereres automatisk basert på aktivitetsdata:
```
Hei [navn]!

Vi ser at det er [X] dager siden du sist var inne på Canvas,
og at [Y] leksjoner ligger under godkjenningsterskel.

Kan du gi oss en statusoppdatering?

Hilsen [lærernavn]
```

---

## Utvidelse 3 — Journalintegrasjon (planlagt)

### Konsept
Skolen har et webbasert journalsystem. Mål: klikk i Canvas → åpner journalen på riktig elev.

### Avklart med bruker
- Journalsystemet er webbasert
- API-tilgang er mulig (avklares)
- URL-struktur undersøkes

### Alternativ A — API-integrasjon
```javascript
// Direkte POST til journalsystem
await fetch('https://journal.skole.no/api/entries', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify({ studentId, note, date })
});
```

### Alternativ B — Smart URL-lenke
```
https://journal.skole.no/elev?id=12345&notat=Purret+25.03
```

### Neste steg
1. Identifiser journalsystemets navn og URL-struktur
2. Undersøk om det finnes et API
3. Implementer Alternativ A eller B basert på funn

---

## Tekniske forbedringer (ikke utvidelser)

### Sortering
Gjeldende implementasjon sorterer kun overlay-celler, ikke Canvas sine rader.
To mulige løsninger:
- **A:** Manipuler Canvas sin SlickGrid DataView direkte (komplekst, Canvas-versjonssensitivt)
- **B:** Eget sortert panel/modal som viser elevliste ved siden av gradebook

### Leksjonsformat-konfigurasjon
Tillat lærere å konfigurere regex-mønster for leksjonsnummer i popup.
Standard: `L\s*(\d+)` — støtter `L 23`, `L23`
Utvidet: `L[\s-]*(\d+)` — støtter også `L-23`

### Semester-håndtering
Ved semesterstart (konfigurerbar dato) nullstilles cachen automatisk.
Forhindrer at gamle leksjonsdata påvirker nye semester.

### Eksport
Knapp i popup: "Eksporter aktivitetsdata" → CSV-fil med alle elevers status.
Nyttig for møter med foresatte og dokumentasjon mot myndigheter.

---

## Dokumentasjonsaktiviteter

Skolen bruker aktivitetsdata for å søke statsstøtte. Aktivitetskolonnen gir visuell støtte, men for formell dokumentasjon trengs:

1. **Eksport** — se over
2. **Rapport per elev** — detaljert aktivitetslogg for én elev
3. **Klasserapport** — aggregert oversikt for hele klassen

---

## Arkitekturnotat

Alle utvidelsene bør dele:
- Samme `manifest.json`-grunnlag
- Samme GDPR-prinsipp: ingen elevdata ut av Canvas
- Samme visuelle språk (ring, tegn, fargepalett)
- Felles popup-infrastruktur med faner for hver utvidelse

Vurder å samle alt i én utvidelse med faner:
```
[Aktivitet] [Purr] [Journal] [Innstillinger]
```

---

## Avklarte designbeslutninger (26.03.26)

### Leksjonslogikk — forenklet regel
```
Obligatorisk = har due_at  → teller alltid, uansett oppgavetype
Frivillig    = ingen due_at → teller aldri, uansett oppgavetype
Quiz         = følger samme regel (due_at = obligatorisk)
```
- Bryter "Selvrettende quizer teller" **fjernes** fra popup
- Bryter "Frivillige oppgaver teller" **fjernes** fra popup
- `submission_types` brukes ikke lenger som filter
- Begrunnelse: Canvas-quizer er ikke garantert selvrettende — essay-spørsmål og blandingsquizer krever lærer uansett

### `__ukjent__`-leksjon må ignoreres
Oppgaver uten `L XX`-prefix havner i `__ukjent__`-leksjon og gir feil beregning.
Løsning: ignorer `__ukjent__` i netDelta:
```javascript
Object.entries(lessons).forEach(([key, l]) => {
  if (key === '__ukjent__') return;
  ...
});
```

### Regex-utvidelse (lav prioritet)
Støtte for `L-23`-format: bytt `/L\s*(\d+)/i` med `/L[\s-]*(\d+)/i`

### Modul-filtrering — høyeste prioritet neste runde
Kun oppgaver som er publisert i en Canvas-modul skal telle i beregningen.
Oppgaver som ligger løst i kurset (ikke i modul) skal ignoreres.

```javascript
// Nytt API-kall:
GET /api/v1/courses/:id/modules?include[]=items&per_page=100

// Bygg godkjent-sett:
const moduleAssignmentIds = new Set();
modules.forEach(mod => {
  mod.items?.forEach(item => {
    if (item.type === 'Assignment' || item.type === 'Quiz') {
      moduleAssignmentIds.add(item.content_id);
    }
  });
});

// Filtrer før beregning:
const relevant = assignments.filter(a => moduleAssignmentIds.has(a.id));
```

Dette løser i ett grep:
- Velkomstoppgaver og andre ikke-modul-oppgaver ignoreres
- Duplikater fra API-et forsvinner (modul-IDer er unike)
- `__ukjent__`-leksjonsproblemet løses automatisk
