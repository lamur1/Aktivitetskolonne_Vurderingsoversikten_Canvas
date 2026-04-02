# Canvas Aktivitetskolonne

Chrome-utvidelse som legger til en diskret aktivitetskolonne i Canvas vurderingsoversikt. Læreren får et øyeblikksbilde av elevenes innlogging, innleveringsstatus og fremdrift mot leksjonsfrister — uten å forlate oversikten.

---

## Første gang — det tar litt tid

Første gang du åpner en klasse henter utvidelsen data fra Canvas API i to omganger:

1. **Innlogging vises straks** — ringer dukker opp etter noen sekunder. En grønn strek animeres i kolonnehodet mens resten lastes.
2. **Innleveringsdata og fremdrift** — dette er den tunge delen. En klasse med 30 elever og 15 leksjoner kan ha 1 000–2 000 innleveringer som skal hentes og beregnes. Dette tar typisk 10–30 sekunder avhengig av klassestørrelse og internettforbindelsen din.

Når alt er lastet caches dataene lokalt i 1 time. Neste gang du åpner samme klasse vises alt umiddelbart.

> **Tips:** Klikk **📌 Fest fanen** i innstillingspanelet for å feste vurderingsoversikten som en pinned tab i Chrome. Da kan ikke fanen lukkes ved et uhell med Ctrl+W, og den ligger alltid klar ytterst til venstre i nettleseren.

---

## Installasjon

1. Last ned og pakk ut mappen
2. Åpne Chrome og gå til `chrome://extensions`
3. Slå på **Utviklermodus** (øverst til høyre)
4. Klikk **Last inn upakket** og velg mappen `canvas-aktivitet`
5. Gå til vurderingsoversikten i et Canvas-kurs — kolonnen vises automatisk

---

## Slik leser du kolonnen

Kolonnen svever på høyre kant av navnekolonnen slik at Merknader-kolonnen alltid er synlig.

```
  ◉  ✓  [——●——]
  │   │      │
  │   │      └─ Fremdriftsindikator (tidslinje)
  │   └──────── Innlevering (tegn)
  └──────────── Innlogging (ring)
```

### Symbol 1 — Sirkel (innlogging)

Sirkelen bruker to redundante kanaler — fyllingsgrad og kanttykkelse — for å vise hvor nylig eleven var innlogget.

| Symbol | Betyr |
|--------|-------|
| Fylt sirkel, tykk kant | Innlogget siste 1–3 dager |
| ¾ fylt, medium kant | Innlogget for 4–7 dager siden |
| ½ fylt, tynn kant | Innlogget for 8–15 dager siden |
| Tom, veldig tynn kant | Ikke sett på over 15 dager |

### Symbol 2 — Firkant (innlevering)

Firkanten viser status for siste innlevering. Formen skiller den tydelig fra sirkelen.

| Symbol | Betyr |
|--------|-------|
| Fylt grønn firkant | Levert innen 7 dager |
| Halvt fylt grå firkant | Levert for 8–21 dager siden |
| Tom firkant, rød kant | Ikke levert på lenge, eller aldri |

### Symbol 3 — Fremdriftsindikator (tidslinje)

Den loddrette streken er nullpunktet — her skal eleven være akkurat nå. En bar vokser ut fra nullpunktet og viser retning og omfang av avviket.

```
  [████|————]   Etter skjema — rød bar til venstre
  [————|————]   I rute — bare midtstreken
  [————|████]   Foran skjema — grønn bar til høyre
  [————|--○-]   Ingen fristdata (stiplet sirkel)
```

Barens farge bruker gradient: lys nær nullpunktet, mørkere mot enden — jo lenger baren strekker seg, jo mer intens blir fargen.

| Bar | Betyr |
|-----|-------|
| Grønn bar høyre | Foran skjema |
| Ingen bar | I rute |
| Rød bar venstre | Etter skjema |
| Full rød bar venstre | Har frister, ikke levert |

Hover over en celle for nøyaktige tall:
```
Innlogget: 2 dager siden
Innlevert: 5 dager siden
8 av 15 leksjoner Fullført · Terskel: 50%
2 innleveringer venter vurdering
På etterskudd — 3 leksjoner etter skoleruta
```

**"Fullført"** teller kun leksjoner hvor lærer har gitt tilbakemelding og satt status til Fullført. Innleveringer som er levert men ikke vurdert ennå vises på egen linje som «venter vurdering». Elever som er etter skoleruta får en egen linje som viser hvor mange leksjoner de henger etter.

### Fargemerking av rader

Når fargemerking er slått på får Canvas-radene en dempet trafikklys-farge basert på leksjonsfremdrift:

| Farge | Betyr |
|-------|-------|
| Svakt grønn | 2 leksjoner etter skjema |
| Svakt gul | 3 leksjoner etter skjema |
| Svakt rød | 4+ leksjoner etter skjema, eller har frister men ikke levert |

1 leksjon etter regnes som innafor og gir ingen fargemerking. Fargene er bevisst dempet (lav opacity) for å ikke dominere Canvas sitt eget grensesnitt.

---

## Slik tolker du tallene — viktig å vite

### Batterigrafikkens er det mest direkte signalet

Hover-vinduet viser et batteridiagram med én søyle per leksjon. Høyden på søylen viser hvor stor andel av lærebogsidene (Canvas-sider med «Vist»-krav) eleven faktisk har åpnet. **Dette er det mest pålitelige signalet på om eleven har jobbet med lærestoffet** — det avslører elever som leverer inn via gjøremålslisten uten å ha gått innom sidene med lærestoff.

Stiplete søyler = leksjoner som ikke er påbegynt ennå (fristen er ikke passert).

Hvite prikker på søylene = antall innleveringer som er hoppet over i den leksjonen.

### «Fullført» er ikke det samme som «ferdig»

Telleren «X av 15 leksjoner Fullført» er basert på to valg du gjør i innstillingene:

**1. Terskelprosent (standard: 50%)**
En leksjon teller som Fullført når minst X% av oppgavene i modulen er godkjent. Med 50% terskel og 4 oppgaver holder det med 2 godkjente — eleven kan ha hoppet over de viktigste. En høyere terskel gir et strengere krav, men ingen terskel kan fortelle deg *hvilke* oppgaver som er gjort.

**2. Hva teller som «godkjent»?**

| Valg | Hva som teller |
|------|----------------|
| Lærergodkjent (standard) | Kun oppgaver lærer har vurdert og satt status på |
| Automatisk rettet | Kun quizer som Canvas har rettet automatisk |
| Begge | Alt som er registrert som vurdert, uansett hvem |

**Lærerrettet og automatisk rettet er fundamentalt forskjellige ting.** En quiz som autoavsluttes gir «vurdert»-status selv om eleven fikk 0%. En lærerrettet oppgave krever at lærer aktivt har godkjent arbeidet. Standardvalget «Lærergodkjent» er det strengeste og mest meningsfulle for oppfølging.

### Konklusjon for tolkning

Ingen enkelt indikator forteller hele historien. Bruk dem sammen:

- **Sirkel** → er eleven aktiv i Canvas?
- **Firkant** → har eleven levert noe nylig?
- **Tidslinje** → er eleven foran eller bak skjema?
- **Batteriet** → har eleven faktisk lest lærestoffet?
- **Prikker** → i hvilke leksjoner mangler det innleveringer?
- **Rød tekst** → totalt antall hoppede over innleveringer

En elev med grønn sirkel, grønn firkant og 12 av 15 Fullført kan likevel ha tomme batterisøyler og røde prikker — og trenger oppfølging.

---

## Hvordan fremdriften beregnes

Oppgavene grupperes per leksjon basert på hvilken **modul** de tilhører i Canvas. Én modul = én leksjon. Alle innleveringstyper som ligger som element i en modul telles: oppgaver, New Quizzes og diskusjoner. Totalt antall leksjoner er fast satt til 15.

Moduler som kun inneholder upublisert innhold filtreres automatisk ut og påvirker ikke beregningene. Unngå å ha publiserte oppgaver med frister i moduler som ikke er en del av de 15 leksjonene.

**Per leksjon:**

En leksjon regnes som **Fullført** når andelen lærergodkjente innleveringer er ≥ terskel (standard: 50 %). Det samme grunnlaget — lærergodkjenning — brukes for alle tre indikatorene: bakgrunnsfarge, prikkposisjon og hover-tekst.

- Leksjon **Fullført** (≥ terskel, lærergodkjent): teller som godkjent
- Leksjon **levert men ikke vurdert**: teller ikke som Fullført — vises som «venter vurdering» i hover-teksten
- Leksjon **ikke godkjent** (< terskel): trekker 1 fra netto fremdrift
- Leksjon **ikke påbegynt** (ingen levering, ingen mangler): ignoreres

**Trafikklys-farge** (når fargemerking er slått på):
```
leksjoner etter skjema = leksjoner med passert frist - godkjente av disse
```

**Prikkposisjon** (fremdriftsindikator):
```
delta = (godkjente leksjoner levert før fremtidig frist)
      - (leksjoner under terskel)
```

**Innleveringer uten frist** ignoreres. Bare oppgaver med satt frist bidrar til leksjonsberegningen.

---

## Innstillinger

Klikk utvidelsesikonet i Chrome-verktøylinjen for å åpne innstillingspanelet.

### Vis/skjul kolonnen
Togglen øverst skjuler kolonnen raskt når du trenger mer plass.

### Innlogging (sirkel)
- Fylt sirkel: innlogget innen X dager (standard: 3)
- ¾ fylt: innlogget innen X dager (standard: 7)
- Over grensen → ½ fylt (til 15 dager) → tom sirkel (over 15 dager)

### Innlevering (firkant)
- Fylt grønn firkant: levert innen X dager (standard: 7)
- Halvt fylt grå firkant: levert innen X dager (standard: 21)
- Tom rødkantet firkant: over grensen eller aldri levert

### Fremdriftsindikator (tidslinje)

**Leksjon Fullført når ≥ X % er godkjent av lærer** (standard: 50%)
Terskel for når en leksjon regnes som Fullført. Gjelder for alle tre indikatorene: bakgrunnsfarge, prikkposisjon og hover-tekst. Totalt antall leksjoner er fast 15.

### Fargemerking av rader
Slår av/på dempet trafikklys-farging av Canvas-rader basert på leksjonsfremdrift (grønn → gul → rød).

### Cache og oppdatering
Viser når data sist ble hentet. Klikk **⟳ Oppdater nå** for å tvinge en ny henting fra Canvas API — nyttig hvis en elev nettopp har levert og du vil se det med en gang.

Data caches lokalt i 1 time. Ved neste sideinnlasting innen 1 time vises ikonene umiddelbart uten ventetid.

---

## Personvern og GDPR

Elevdata forlater aldri Canvas sine egne servere.

```
Canvas sine servere  →  Din nettleser  →  Vises på skjermen  →  Ingenting mer
```

- Utvidelsen henter data fra Canvas sitt eget API med din eksisterende innloggingssesjon
- Elevdata lagres kortvarig i `chrome.storage.local` kun for caching (maks 1 time), og slettes ved "Oppdater nå"
- Ingen elevdata sendes til eksterne servere eller tredjepart
- Det eneste som synkroniseres mellom maskiner (`chrome.storage.sync`) er dine egne innstillinger — kun tall og brytervalg, ingen personopplysninger

Som lærer er du allerede autorisert i Canvas til å se denne informasjonen. Utvidelsen gjør det samme som å klikke seg rundt i Canvas manuelt, bare raskere og mer oversiktlig.

Utvidelsen inneholder ingen sporings- eller analysekode.

---

## Teknisk

- Manifest V3
- Aktiveres kun på `*.instructure.com/courses/*/gradebook*`
- Bruker Canvas REST API:
  - `enrollments` med `last_activity_at` — innloggingsdata
  - `students/submissions` med `missing`-flagg — innleveringsdata
  - `assignments` med `due_at` og `submission_types` — frist- og oppgavetype-data
  - `modules` med `items` — modulstruktur brukes til leksjonsgruppering; oppgaver, NQ (Quiz) og diskusjoner i moduler telles
- Data caches i `chrome.storage.local` med 1-times utløp per kurs
- Injiserer et flytende overlay-panel festet til Canvas sin SlickGrid-viewport

---

## Kjente begrensninger

- Canvas sin gradebook bruker virtuell scrolling (SlickGrid). DOM-strukturen kan variere mellom Canvas-versjoner. Ta kontakt hvis kolonnen ikke vises
- Utvidelsen er testet på `*.instructure.com`. Andre domener krever endring av `host_permissions` i `manifest.json`

---

## Del av en serie

Denne utvidelsen er én av flere Canvas-utvidelser utviklet for intern bruk ved en nettskole med elever i over 100 land. Felles for alle: ingen elevdata forlater Canvas, og de er laget for å være så lite påtrengende som mulig i det daglige arbeidet.

---

## Lisens

MIT
