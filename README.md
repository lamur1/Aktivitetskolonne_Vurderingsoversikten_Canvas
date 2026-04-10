# 📌 10.04.2026 GRAFIKK FOR FRAMDRIFT, VISNSING OSV. STEMMER GANSKE BRA. NY VERJSON MED JUSTERTE FORMLAR KJEM ETTER KVART.
# Canvas Aktivitetskolonne

Chrome-utvidelse som legger til en diskret aktivitetskolonne i Canvas vurderingsoversikt. Læreren får et øyeblikksbilde av elevenes innlogging, innleveringsstatus, fremdrift og leseatferd — uten å forlate oversikten.

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

En diskret 3 px grønn stripe i nedkanten av cellen viser snittlig visningsprosent for lærestoff (Canvas-sider med «Vist»-krav) i leksjonene eleven har levert oppgaver i.

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
| X av 15 leksjoner Fullført · Terskel: Y% | Godkjente leksjoner basert på terskelen |
| N innleveringer venter vurdering | Levert men ikke vurdert ennå |
| I forkant / På etterskudd | Avvik fra skoleruta |
| Snitt visning: X % | Gjennomsnittlig andel sett lærestoff |

### Batteridiagrammet — lærestoff sett per leksjon

Diagrammet viser én loddrett søyle per leksjon. En midtlinje skiller positiv og negativ sone.

| Element | Betyr |
|---------|-------|
| Grønn søyle oppover | Andel «Vist»-sider eleven har åpnet. Full høyde = 100 % |
| Rød søyle nedover | Fristen er passert — eleven har ikke åpnet en eneste side |
| Stiplet grå søyle | Fristen er ikke passert ennå — leksjonen er fremtidig |
| Hvite sirkler | Antall innleveringer med passert frist som mangler |

**Dette er det mest pålitelige signalet på om eleven faktisk har jobbet med lærestoffet** — det avslører elever som leverer inn uten å ha gått innom sidene med lærestoff.

---

## Kopiering og nedlasting

Når du holder musen over en celle vises to ikoner:

**Kopieringsikon (øverst)** — kopierer elevens status til utklippstavlen med innleveringslenker.

**Nedlastingsikon (nederst)** — laster ned et PNG-elevkort med navn, status og batteridiagram.

Hvilke oppgaver som tas med styres av innstillingen **Kopieringslenker** i popup-panelet.

---

## Slik tolker du tallene — viktig å vite

### «Fullført» er ikke det samme som «ferdig»

Telleren «X av 15 leksjoner Fullført» er basert på to valg i innstillingene:

**1. Terskelprosent (standard: 50%)**
En leksjon teller som Fullført når minst X% av oppgavene i modulen er godkjent innen fristen.

**2. Hva teller som «godkjent»?**

| Valg | Hva som teller |
|------|----------------|
| Lærergodkjent (standard) | Kun oppgaver lærer har vurdert og satt status på |
| Automatisk rettet | Kun oppgaver Canvas har rettet automatisk |
| Begge | Alt som er registrert som vurdert |

### Bruk signalene sammen

Ingen enkelt indikator forteller hele historien:

- **Ring** → er eleven aktiv i Canvas?
- **Firkant** → har eleven levert noe nylig?
- **Tidslinje** → er eleven foran eller bak skjema?
- **Visningsbar** → har eleven lest lærestoffet?
- **Batteriet** → hvilke leksjoner er lest, hvilke er ikke påbegynt?
- **Hvite sirkler** → i hvilke leksjoner mangler det innleveringer?

---

## Hvordan fremdriften beregnes

Oppgavene grupperes per leksjon basert på hvilken **modul** de tilhører i Canvas. Én modul = én leksjon.

**Per leksjon:**

Kun oppgaver med passert frist teller i beregningen — fremtidige frister ignoreres. Dette gjør beregningen dynamisk: en elev som er i forkant telles som i forkant, ikke som bak.

- **Godkjent** (≥ terskel fullfort av forfalt): teller positivt
- **Levert men ikke vurdert**: vises som «venter vurdering»
- **Ikke godkjent** (< terskel): trekker fra netto fremdrift
- **Leksjon med fremtidig frist, levert**: bidrar positivt som «i forkant»

**Trafikklys-farge:**
```
leksjoner etter skjema = leksjoner med passert frist − godkjente av disse
```

---

## Innstillinger

Klikk utvidelsesikonet i Chrome for å åpne innstillingspanelet.

| Innstilling | Standard | Forklaring |
|-------------|----------|------------|
| Fylt ring | ≤ 3 dager | Grense for nylig innlogging |
| ¾ fylt ring | ≤ 7 dager | Grense for relativt nylig innlogging |
| Levert nylig | ≤ 7 dager | Grense for grønn firkant |
| En stund siden | ≤ 14 dager | Grense for grå firkant |
| Leksjon godkjent når | ≥ 50% | Terskel for leksjonsberegning |
| Godkjenningsgrunnlag | Kun lærer | Hva som teller som godkjent |
| Fargemerking | På | Trafikklys-farge på Canvas-rader |

---

## Personvern og GDPR

Elevdata forlater aldri Canvas sine egne servere.

- Utvidelsen henter data fra Canvas sitt eget API med din eksisterende innloggingssesjon
- Elevdata lagres kortvarig i `chrome.storage.local` kun for caching (maks 1 time)
- Ingen elevdata sendes til eksterne servere eller tredjepart
- Kun dine egne innstillinger synkroniseres mellom maskiner — ingen personopplysninger

---

## Teknisk

- Manifest V3 — versjon 09.04.2026
- Aktiveres kun på `*.instructure.com/courses/*/gradebook*`
- Canvas REST API-endepunkter som brukes:
  - `enrollments` med `last_activity_at`
  - `students/submissions` med `missing`-flagg
  - `assignments` med `due_at` og `submission_types`
  - `modules` med `items` — for leksjonsgruppering og «Vist»-status
- Data caches i `chrome.storage.local` med 1-times utløp per kurs

---

## Kjente begrensninger

- Canvas sin gradebook bruker virtuell scrolling (SlickGrid). DOM-strukturen kan variere mellom Canvas-versjoner
- Utvidelsen er testet på `*.instructure.com`. Andre domener krever endring av `host_permissions` i `manifest.json`

---

## Lisens

MIT
