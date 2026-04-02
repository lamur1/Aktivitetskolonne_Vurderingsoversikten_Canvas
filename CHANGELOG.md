# Endringslogg

## 02.04.26 — Lærestoffgrafikk i hover-tooltip

### Endret
- Batteridiagram erstattet med vertikal divergerende stolpegraf — samme fargesystem og prinsipp som fremdriftsindikatoren, rotert 90°
- Midtlinje skiller positiv sone (grønn, lærestoff åpnet) og negativ sone (rød/stiplet, ikke påbegynt)
- Grønn søyle: vokser oppover, intensitet øker mot 100% (`#97c459 → #3b6d11` gradient)
- Rød søyle: full høyde nedover for leksjoner med passert frist som ikke er påbegynt (`#e57373 → #a32d2d` gradient)
- Stiplet grå søyle: fremtidige leksjoner som ikke er påbegynt
- Hvite sirkler med sort kant stables nedover i negativ sone — viser manglende innleveringer per leksjon
- Søylebredde: 7px, mellomrom: 11px, totalhøyde: 110px (55 opp + 55 ned)
- Sirkel-symbol lagt til foran rød «X innleveringer hoppet over»-tekst
- Tooltip reposisjoneres korrekt etter at batteridataen laster ferdig (lagrer siste museposisjon)

### Fikset
- Tooltip klippet ved skjermkant nederst når batterigrafikkens høyde økte ved lazy-load

---

## 25.03.26 — Aktiv utviklingsdag

### Lagt til
- Leksjonsbasert fremdriftsberegning basert på Canvas `missing`-flagg
- Fullføringsterskel per leksjon (standard 50%), justerbar i popup
- Bryter for frivillige oppgaver i beregningen
- Bryter for selvrettende quizer (`online_quiz`) i beregningen
- Fargemerking av Canvas-rader (3 nivåer, dempede røde toner)
- Bryter for å slå fargemerking av/på
- Lokal caching av API-data (1-times utløp per kurs)
- "Oppdater nå"-knapp i popup med cache-tømming
- "Sist oppdatert"-tidsstempel i popup
- "Avansert"-knapp som skjuler sjeldent brukte innstillinger
- Tooltip med tre linjer: innlogging · innlevering · fremdrift

### Endret
- Overlay festes nå til SlickGrid-viewport som forelder (ikke body) — fikser posisjonering
- Bakgrunnsfarge leses fra `.slick-cell` (ikke `.slick-row`) — fikser zebrastriper
- Kolonnehøyde beregnes fra faktisk siste synlige rad
- Symbolstørrelse økt til 16px ring og 15px tegn
- Tidslinje-SVG pakket i avrundet boks-ramme
- Overlay posisjonert på høyre kant av navnekolonnen (ikke etter den)
- Floating panel med kant og skygge
- Tooltip viser "I rute" og "I forkant" (norsk terminologi)
- Leksjonstelling: trekker 1 per leksjon, ikke antall missing-oppgaver
- Leksjoner i forkant: teller leksjoner, ikke antall oppgaver med fremtidig frist

### Fikset
- Observer-loop: overlay-oppdateringer trigget nye oppdateringer
- `maxBottom` deklarert to ganger i samme funksjon (SyntaxError)
- popup.js: dupliserte funksjoner og manglende event listener
- Frivillige oppgaver telte negativt (skal aldri telle negativt)
- Leksjoner uten aktivitet trakk ned urettmessig
- "30 leksjoner etter"-bug (telte missing-oppgaver, ikke leksjoner)

### Symbolsystem
```
Ring (innlogging):
  ████  tykk  → ≤ 3 dager siden (justerbar)
  ███   medium → ≤ 10 dager siden (justerbar)
  ██    tynn   → ≤ 21 dager siden
  █     veldig tynn → > 21 dager siden

Tegn (innlevering):
  ✓  → levert innen 7 dager (justerbar)
  –  → levert innen 21 dager (justerbar)
  ✗  → lenger siden / aldri

Tidslinje (leksjonsfremdrift):
  prikk høyre → i forkant (grønn)
  prikk midt  → i rute (grønn)
  prikk venstre → etter (oransje/rød)
  stiplet     → ingen fristdata
```

---

## Neste planlagte

- Purreassistent (klikk elev → Canvas Innboks-utkast)
- Journalintegrasjon (webbasert journalsystem)
- Regex-støtte for `L-23`-format
- Forbedret sortering
