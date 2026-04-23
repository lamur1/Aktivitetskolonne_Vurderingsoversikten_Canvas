# Canvas Aktivitetskolonne

Chrome-utvidelse som legger til en diskret aktivitetskolonne i Canvas vurderingsoversikt. Læreren får et øyeblikksbilde av elevenes innlogging, innleveringsstatus, fremdrift og leseatferd — uten å forlate oversikten.

**Versjon: 23.04.2026 kl. 13:00**

---

## Første gang — det tar litt tid

Første gang du åpner en klasse henter utvidelsen data fra Canvas API i to omganger:

1. **Innlogging vises straks** — ringer dukker opp etter noen sekunder.
2. **Innleveringsdata og fremdrift** — en klasse med 30 elever og 15 leksjoner kan ha 1 000–2 000 innleveringer. Dette tar typisk 10–30 sekunder.
3. **Visningsdata** — lærestoff-prosenten lastes stille i bakgrunnen etter at tabellen er klar og fylles inn rad for rad.

Når alt er lastet caches dataene lokalt i 1 time. Neste gang du åpner samme klasse vises alt umiddelbart.

---

## Installasjon

1. Last ned og pakk ut mappen
2. Åpne Chrome og gå til `chrome://extensions`
3. Slå på **Utviklermodus** (øverst til høyre)
4. Klikk **Last inn upakket** og velg mappen
5. Gå til vurderingsoversikten i et Canvas-kurs — kolonnen vises automatisk

> Versjonsnummeret er alltid datoen for siste oppdatering (DD.MM.ÅÅÅÅ). Sjekk popup-footeren for å bekrefte at kollegiet har lastet ned nyeste versjon.

---

## Slik leser du kolonnen

Kolonnen svever på høyre kant av navnekolonnen.

![Aktivitetscelle — symboloversikt](images/readme-celler.svg)

### Symbol 1 — Ring (innlogging)

Sirkelen viser hvor nylig eleven var innlogget via fyllingsgrad og kanttykkelse.

| Symbol | Betyr |
|--------|-------|
| Fylt ring, tykk kant | Innlogget siste 1–3 dager |
| ¾ fylt, medium kant | Innlogget for 4–7 dager siden |
| ½ fylt, tynn kant | Innlogget for 8–15 dager siden |
| Tom, veldig tynn kant | Ikke sett på over 15 dager |

### Symbol 2 — Firkant (innlevering)

Firkanten viser status for siste innlevering.

| Symbol | Betyr |
|--------|-------|
| Fylt grønn firkant | Levert innen 7 dager |
| Halvt fylt grå firkant | Levert for 8–14 dager siden |
| Tom firkant, rød kant | Ikke levert på lenge, eller aldri |

### Symbol 3 — Fremdriftsindikator (tidslinje)

Den loddrette streken er nullpunktet — her skal eleven være akkurat nå.

| Bar | Betyr |
|-----|-------|
| Grønn bar høyre | Foran skjema |
| Ingen bar | Akkurat i rute |
| Rød bar venstre | Etter skjema |
| Full rød bar venstre | Har frister, ikke levert |
| Stiplet sirkel | Ingen frister satt i kurset |

### Fargemerking av rader

Når fargemerking er slått på får Canvas-radene en dempet trafikklys-farge:

| Farge | Betyr |
|-------|-------|
| Svakt grønn | 2 leksjoner etter skjema |
| Svakt gul | 3 leksjoner etter skjema |
| Svakt rød | 4+ leksjoner etter skjema |

1 leksjon etter regnes som innafor og gir ingen fargemerking.

### Visningsbar (bunn av cellen)

En diskret 3 px grønn stripe i nedkanten av cellen viser snittlig visningsprosent for lærestoff (Canvas-sider med fullføringskrav) i leksjonene eleven har levert oppgaver i.

- **Full grønn bar** → eleven har lest gjennom lærestoffet grundig
- **Kort grønn bar** → eleven har levert, men lest lite
- **Grå pulserende bar** → data lastes i bakgrunnen
- **Ingen bar** → ingen data tilgjengelig ennå

> **Viktig:** En elev kan ha grønn ring, grønn firkant og fremdrift i rute — men likevel ha en svært lav visningsbar. Dette avslører elever som leverer uten å lese lærestoffet. Denne profilen er usynlig i alle andre indikatorer.

---

## Hover-tooltip

Hold musen over en celle for detaljert informasjon og batteridiagrammet.

![Hover-tooltip med batteridiagram](images/readme-hover.svg)

### Tekstlinjer i tooltip

| Linje | Forklaring |
|-------|------------|
| Innlogget: X dager siden | Siste aktivitet i Canvas |
| Innlevert: X dager siden | Siste registrerte innlevering |
| X av 15 leksjoner Fullført · Terskel: Y% | Godkjente leksjoner — se forklaring under |
| N innleveringer venter vurdering | Levert men ikke karaktersatt ennå |
| I forkant / På etterskudd | Avvik fra skoleruta |
| Snitt visning: X % | Gjennomsnittlig andel fullført lærestoff |
| ○ N innleveringer med status Mangler | Antall innleveringer Canvas har flagget som manglende |

### Batteridiagrammet — lærestoff sett per leksjon

Diagrammet viser én loddrett søyle per leksjon. En midtlinje skiller positiv og negativ sone.

| Element | Betyr |
|---------|-------|
| Grønn søyle oppover | Andel av Canvas-sider med fullføringskrav eleven har fullført. Full høyde = 100 % |
| Rød søyle nedover | Fristen er passert — eleven har ikke fullført noen lærerstoffsider i modulen |
| Stiplet grå søyle | Fristen er ikke passert ennå — leksjonen er fremtidig |
| Hvite sirkler (prikker) | Antall innleveringer med passert frist som ikke er levert |

**Prikkene** viser innleveringer, quizer og diskusjoner med datofrist som mangler. De forsvinner når eleven leverer og kommer tilbake hvis lærer setter status «Mangler».

**Dette er det mest pålitelige signalet på om eleven faktisk har jobbet med lærestoffet** — det avslører elever som leverer inn uten å ha gått innom sidene med lærestoff.

### De fire informasjonslagene i kombinasjon

De fire elementene utfyller hverandre og gir et komplett bilde:

| Element | Viser |
|---------|-------|
| **X av 15 Fullført** | Lærergodkjent fremdrift |
| **Venter vurdering** | Gapet mellom levert og godkjent |
| **Grønne/røde barer** | Om eleven har lest lærestoffet |
| **Prikker** | Konkrete manglende innleveringer |

En erfaren lærer kan kombinere disse og lese hele elevens situasjon på sekunder uten å klikke seg inn i Canvas.

---

## Kopiering og nedlasting

Når du holder musen over en celle vises to ikoner:

**Kopieringsikon (øverst)** — kopierer elevens status til utklippstavlen med innleveringslenker.

**Nedlastingsikon (nederst)** — laster ned et PNG-elevkort med navn, status og batteridiagram.

Hvilke oppgaver som tas med styres av innstillingen **Kopieringslenker** i popup-panelet.

---

## Slik tolker du tallene — viktig å vite

### «X av 15 leksjoner Fullført» — hva teller?

Tallet 15 er fast og representerer det totale antallet leksjoner i kurset. Det er knyttet til statsstøttekravet om at elever skal ha fullført minst 12 av 15 leksjoner.

En leksjon teller som **Fullført** når tilstrekkelig andel av innleveringene med passert frist er **karaktersatt som godkjent** av lærer eller autorettingssystem — ikke bare levert. Unntak: leksjoner der eleven har levert i forkant (fremtidig frist) teller som fullført siden karaktersetting ikke er forventet ennå.

Gapet mellom det eleven har levert og det som er karaktersatt vises i linjen **«N innleveringer venter vurdering»**. En lærer kan altså kombinere «X av 15» og «venter vurdering» for å forstå om lav score skyldes manglende levering eller manglende retting.

### Terskelprosent

Terskelen styrer hvor mange innleveringer i en leksjon som må være karaktersatt som Fullført for at leksjonen teller. Standard er 100 % — alle innleveringer med passert frist må være godkjent. Kan justeres i popup-panelet.

### Hva teller som «godkjent»?

| Valg | Hva som teller |
|------|----------------|
| Lærergodkjent (standard) | Kun oppgaver lærer har karaktersatt manuelt |
| Automatisk rettet | Kun oppgaver Canvas har rettet automatisk (quizer o.l.) |
| Begge | Alt som er registrert som karaktersatt |

Dette gjør utvidelsen tilpasningsdyktig for fag med ulike vurderingsformer.

---

## Hvordan fremdriften beregnes

Oppgavene grupperes per leksjon basert på hvilken **modul** de tilhører i Canvas. Én modul = én leksjon.

**Per leksjon:**

Kun oppgaver med passert frist teller i beregningen — fremtidige frister ignoreres. Dette gjør beregningen dynamisk: en elev som er i forkant telles som i forkant, ikke som bak.

- **Godkjent** (≥ terskel karaktersatt av passerte): teller positivt
- **Levert men ikke karaktersatt**: vises som «venter vurdering», teller ikke som Fullført
- **Ikke godkjent** (< terskel): trekker fra netto fremdrift
- **Leksjon med fremtidig frist, levert**: bidrar positivt som «i forkant» og teller som Fullført

**Trafikklys-farge:**
```
leksjoner etter skjema = leksjoner med passert frist − godkjente av disse
```

**Batteridiagrammets barer** beregnes separat fra fremdriften. De henter Canvas sin egen fullføringsstatus for sider med fullføringskrav (`must_view`, `must_mark_done`, `must_submit` osv.) via modul-API-et — uavhengig av innleveringsdata.

---

## Innstillinger

Klikk utvidelsesikonet i Chrome for å åpne innstillingspanelet.

| Innstilling | Standard | Forklaring |
|-------------|----------|------------|
| Fylt ring | ≤ 3 dager | Grense for nylig innlogging |
| ¾ fylt ring | ≤ 7 dager | Grense for relativt nylig innlogging |
| Levert nylig | ≤ 7 dager | Grense for grønn firkant |
| En stund siden | ≤ 14 dager | Grense for grå firkant |
| Leksjon godkjent når | ≥ 100% | Terskel for leksjonsberegning |
| Godkjenningsgrunnlag | Kun lærer | Hva som teller som godkjent |
| Fargemerking | Av | Trafikklys-farge på Canvas-rader |

---

## Personvern og GDPR

Elevdata forlater aldri Canvas sine egne servere.

- Utvidelsen henter data fra Canvas sitt eget API med din eksisterende innloggingssesjon
- Elevdata lagres kortvarig i `chrome.storage.local` kun for caching (maks 1 time)
- Ingen elevdata sendes til eksterne servere eller tredjepart
- Kun dine egne innstillinger synkroniseres mellom maskiner — ingen personopplysninger

---

## Canvas-skript for elever — fire filer

Det følger med fire JavaScript-filer som limes inn i Canvas sitt globale JavaScript-felt (Admin → Tema → JS). Velg én fra hver gruppe:

### Gruppe 1 — Tooltip og modulside (`canvas-global-…`)

Håndterer tooltip på gjøremålslenker, automatisk kollaps/ekspander av leksjoner på modulside, premieikon ved fullføring og diplom ved kursslutt.

| Fil | Forskjell |
|-----|-----------|
| `canvas-global_med_kulelenker.js` | Prikkene i batteridiagrammet er **klikkbare lenker** til den aktuelle oppgaven |
| `canvas-global_uten_kulelenker.js` | Prikkene er **ikke klikkbare** — kun visuelle indikatorer |

### Gruppe 2 — Leksjonsfremdrift og Min fremdrift (`canvas-leksjonsfremdrift-…`)

Håndterer den flytende fremdriftsbjelken øverst på siden og «Min fremdrift»-modalen med batteridiagram og statistikk.

| Fil | Forskjell |
|-----|-----------|
| `canvas-leksjonsfremdrift-og-min-fremdrift_med_kulelenker.js` | Prikkene i batteridiagrammet er **klikkbare lenker** til den aktuelle oppgaven |
| `canvas-leksjonsfremdrift-og-min-fremdrift_uten_kulelenker.js` | Prikkene er **ikke klikkbare** — kun visuelle indikatorer |

> Velg konsekvent — bruk enten begge `med_kulelenker`-filene eller begge `uten_kulelenker`-filene.

---

## Teknisk

- Manifest V3 — versjon 23.04.2026 kl. 13:00
- Aktiveres kun på `*.instructure.com/courses/*/gradebook*`
- Canvas REST API-endepunkter som brukes:
  - `enrollments` med `last_activity_at`
  - `students/submissions` med `missing`-flagg, `workflow_state`, `grader_id`, `submitted_at`, `graded_at`
  - `assignments` med `due_at`, `grading_type`, `submission_types`
  - `modules` med `items` og `student_id` — for leksjonsgruppering og fullføringsstatus
- Data caches i `chrome.storage.local` med 1-times utløp per kurs

---

## Kjente begrensninger og åpne punkter

- Canvas sin gradebook bruker virtuell scrolling (SlickGrid). DOM-strukturen kan variere mellom Canvas-versjoner
- Utvidelsen er testet på `*.instructure.com`. Andre domener krever endring av `host_permissions` i `manifest.json`
- Batteridiagrammet viser kun moduler som har Canvas-sider med fullføringskrav. Moduler som kun inneholder oppgaver/quizer uten sider kan mangle søyle selv om de har prikker
- Prikkene bruker `completion_requirement.completed` fra Canvas modulAPI som primærsignal. Lærer-satt «Mangler» (`sub.missing = true`) overstyrer og flytter prikken under streken selv om Canvas viser grønn hake i modulen. «Ikke fullført» som karakterverdi uten manuelt «Mangler»-flagg fanges ikke opp — dette er en kjent begrensning som krever rutine hos lærerne
- `must_mark_done` (Merk som ferdig) er ikke i bruk på skolen og fanges ikke opp i prikkelogikken. Items med dette kravet vil ikke vises i batteridiagrammet
- Aktivitetskolonnen (lærervisning) henter moduldata uten `student_id` og kan ikke bruke `completion_requirement.completed` per elev. Prikkelogikken der er fortsatt submissions-basert og fanger ikke opp `must_mark_done` eller items uten datofrist
- **«Legg til elevoppgave» + «Vis»-krav** på en Canvas-side er trygt å bruke. Siden forblir en `Page` i API-et og teller normalt i de grønne barene — ikke som innlevering. Kombinasjonen gjør at siden vises i elevens gjøreliste og kalender uten å påvirke X av 15, prikker eller venter-vurdering. Testet og bekreftet 10.04.2026.

---

## Lisens

MIT
