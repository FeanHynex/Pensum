# Pensum – Technische Architektur

Stand: 08.09.2026 (mit Ergänzung: Versionsnummer für die Testphase)

## 1. Architekturprinzip

Pensum ist aktuell eine **clientseitige Single-Page-Web-App**.

```text
Browser
  │
  ├── React UI
  │     └── src/App.jsx
  │
  ├── lokale Persistenz
  │     └── localStorage
  │
  └── externer Ferien-Dienst
        └── schulferien-api.de
```

Es gibt keine eigene API, keinen eigenen Server und keine Datenbank.

## 2. Einstiegspunkt

```text
index.html
   ↓
src/main.jsx
   ↓
ReactDOM.createRoot(...)
   ↓
App aus src/App.jsx
```

`src/index.css` wird in `main.jsx` importiert.

## 3. Hauptdateien

### `src/App.jsx`

Aktuell zentrale Datei der Anwendung. Sie enthält:

- Konstanten und Standardwerte
- Datums- und Zeit-Helfer
- kleine UI-Komponenten
- Tagesansicht
- Auswertung
- Stundenplan-Editor
- Einstellungen
- zentrale App-State-Verwaltung

### `src/storage.js`

Sehr kleine Persistenzschicht:

```text
loadJSON(key, fallback)
       ↓
localStorage.getItem()
       ↓
JSON.parse()
```

und:

```text
saveJSON(key, value)
       ↓
JSON.stringify()
       ↓
localStorage.setItem()
```

Fehler werden abgefangen und über `console.error` gemeldet.

### `src/main.jsx`

Initialisiert React und rendert `<App />` in `#root`.

### `vite.config.js`

Konfiguriert React, PWA und GitHub-Pages-Basis `/Pensum/`. Stellt außerdem per `define` die globale Build-Konstante
`__APP_VERSION__` bereit, deren Wert `process.env.npm_package_version` ist (also die `"version"` aus
`package.json`, ohne zusätzliche Abhängigkeit oder JSON-Import). `src/App.jsx` liest daraus die Konstante
`APP_VERSION` (mit Fallback `"0.0.0"`, falls das Define ausnahmsweise fehlt) und zeigt sie in
`EinstellungenView` an.

### `.github/workflows/deploy.yml`

Automatisiertes Build- und GitHub-Pages-Deployment.

## 4. React-Komponentenstruktur – aktueller Stand

```text
App
├── IconBtn
├── EntryForm
├── PauseSlotRow
├── TagView
├── AuswertungView
│   ├── CategoryDonut
│   └── TrendChart
├── TemplateEditor
└── EinstellungenView
```

Die Komponenten sind derzeit alle in `src/App.jsx` definiert.

### `App`

Verwaltet den globalen Anwendungszustand:

- `config` (inkl. `config.employment` – Arbeitszeitmodell)
- `templates`
- `holidaySettings`
- `entries`
- `dayStatus` (Tages-Status: Krank/Urlaub)
- `classTripDays` (Klassenfahrt-Tage, siehe Abschnitt „Klassenfahrten“)
- `theme` (Design-Modus: `"light" | "dark" | "system"`)
- aktuell gewählter Tab
- aktuell gewähltes Datum

Außerdem verbindet `App` React-State und `localStorage`.

Zusätzlich enthält `App` einen `useEffect`, der abhängig von `theme` die Klasse `dark` auf
`document.documentElement` setzt bzw. entfernt. Bei `theme === "system"` wird der aktuelle Wert von
`window.matchMedia("(prefers-color-scheme: dark)")` herangezogen und ein `change`-Listener registriert, damit ein
Wechsel der Geräte-Einstellung ohne Neuladen der App übernommen wird; der Listener wird beim Verlassen des
`system`-Modus bzw. beim Unmount wieder entfernt.

### `TagView`

Verantwortlich für die Erfassung eines einzelnen Tages.

Sie erhält unter anderem:

- `date`
- `entries`
- `config`
- `templates`
- `holidays`
- `dayStatus`
- `classTripDays`

und verwendet `setDayEntries()` zum Speichern der Tagesdaten, `setDayStatus(dateKey, value)` zum Setzen bzw.
(bei `value = null`) Löschen des Tages-Status sowie `setClassTripDay(dateKey, boolean)` zum Setzen/Löschen des
Klassenfahrt-Flags für den Tag. `value` bei `setDayStatus` ist entweder `null` (= Status `WORK`) oder
`{ status: "SICK" | "VACATION", from?: "HH:MM", to?: "HH:MM" }` (siehe Abschnitt 6, `dayStatus`). Das
Klassenfahrt-Flag ist von Krank/Urlaub unabhängig – ein Tag kann z. B. gleichzeitig `WORK` und Klassenfahrt sein
(siehe Abschnitt „Klassenfahrten“).

Bei ganztägiger Abwesenheit (weder `from` noch `to` gesetzt) wird das komplette Schulstundenraster ausgeblendet. Bei
teilweiser Abwesenheit (`from` oder `to` gesetzt) bleibt das Raster sichtbar; Schulstunden ohne eigenen Eintrag, die
im markierten Zeitraum liegen, werden als reiner Status-Hinweis dargestellt statt als bearbeitbarer/leerer Slot –
dafür ist keine Tätigkeitsauswahl mehr nötig. Bereits vorhandene Einträge in dieser Zeitspanne bleiben unverändert
editierbar.

Zusätzlich rendert `TagView` (sofern `config.schoolArrivalTime` gesetzt und vor dem Start der 1. Stunde liegt) vor
der 1. Stunde einen weiteren Pausen-Slot (`slot: "pause-vor-1"`) für die Ankunftszeit, mit derselben
`PauseSlotRow`-Komponente wie die Pausen zwischen den
Schulstunden (siehe unten).

### `PauseSlotRow`

Gemeinsame Darstellungskomponente für alle Pausen-Slots: die kurzen Pausen zwischen zwei Schulstunden (`slot:
"pause-{nr}"`) sowie den optionalen Vorlauf-Block vor der 1. Stunde (`slot: "pause-vor-1"`). Erhält u. a. `start`,
`end`, `slotEntry`, `autoCounts` und `autoMinutes` und entscheidet rein anhand dieser Props über die Darstellung:

- vorhandener `slotEntry` → normale Anzeige von Tätigkeit, Zeit und Dauer (wie ein regulärer Eintrag).
- kein `slotEntry`, aber `autoCounts === true` → Platzhalter mit Hinweis „zählt automatisch zur Stunde“ und
  `autoMinutes` als angezeigte Dauer (ohne dass dafür ein Eintrag existiert).
- kein `slotEntry`, `autoCounts === false` → unveränderter Platzhalter wie bisher (kein Eintrag, keine Dauer).

Die Berechnung von `autoCounts`/`autoMinutes` erfolgt außerhalb (in `TagView`, siehe Abschnitt 7/8) – `PauseSlotRow`
selbst enthält keine fachliche Logik zur automatischen Anrechnung.

### `EntryForm`

Gemeinsames Formular für:

- Startzeit
- Endzeit
- Tätigkeit
- Bemerkung
- Speichern
- Abbrechen
- Löschen bei vorhandenen Einträgen

### `AuswertungView`

Ermittelt anhand von `entries` einen Zeitraum und aggregiert die Ist-Arbeitszeit. Berechnet zusätzlich anhand von
`templates`, `dayStatus`, `employment` und `config` (für das Schulstunden-Zeitfenster bei anteiliger Anrechnung) die
Soll-Arbeitszeit und die anrechenbare Abwesenheitszeit des Zeitraums (siehe Abschnitt 12a), begrenzt auf den
Zeitraum ab dem frühesten jemals erfassten Eintrag (`firstEntryDate()`, siehe Abschnitt 12b).

Bei der Ist-Arbeitszeit werden zusätzlich zu den erfassten Einträgen die automatisch angerechneten Minuten aus
kurzen Pausen und der Ankunftszeit ergänzt (siehe Abschnitt 8, „Automatische Anrechnung kurzer Pausen“) – dafür
iteriert `AuswertungView` pro Kalendertag zusätzlich über `config.periods`, nicht nur über `entries[dateKey]`.

Für die Ist-Arbeitszeit wird zusätzlich eine Aufteilung nach Kategorie (`byCategory`, über `categoryOf()`) sowie ein
Tagesverlauf (`dayStats`: Ist/Soll je Kalendertag im Zeitraum) ermittelt und über `CategoryDonut` bzw. `TrendChart`
dargestellt (siehe Abschnitt 12c). Die automatisch angerechneten Minuten fließen dabei in `byActivity`/`byCategory`
der Tätigkeit der zugehörigen Schulstunde ein.

Zusätzlich erhält `AuswertungView` die Prop `classTripDays` und ermittelt im selben Tages-Durchlauf eine getrennte
Klassenfahrten-Statistik (`classTrip`: Anzahl Tage, tatsächliche Arbeitszeit, Fahrtzeit, Nachtbereitschaft,
Pausen, Anrechnung in Unterrichtsstunden/Minuten via `classTripCreditMinutesPerDay()`). Die Anrechnung fließt
zusätzlich zu `creditedAbsence` in `effective` (und damit in die Bilanz) ein, aber nicht in `actual`. Siehe
Abschnitt „Klassenfahrten“ für Details.

### `CategoryDonut`

Reine Darstellungskomponente: rendert ein SVG-Ringdiagramm für eine Liste `[kategorieKey, minuten]` plus
Gesamtsumme. Keine eigene Logik oder Zustand, keine externe Chart-Bibliothek.

### `TrendChart`

Reine Darstellungskomponente: rendert für eine Liste `{ dateKey, actual, target }` einen horizontal scrollbaren
Balkenverlauf (Ist als Balken, Soll als gestrichelte Linie) mit reinen `div`-Elementen/Tailwind-Klassen, ebenfalls
ohne externe Chart-Bibliothek.

### `TemplateEditor`

Bearbeitet eine Stundenplan-Vorlage mit Zeitraum und Einträgen je Wochentag/Stunde.

### `EinstellungenView`

Verwaltet:

- Design-Modus (Hell/Dunkel/System) über die von `App` durchgereichten Props `theme`/`setTheme`
- Schulstunden
- Pausen & Ankunftszeit (`config.schoolArrivalTime` – feste Ankunftszeit vor der 1. Stunde, leer/""
  deaktiviert sie; die Schwelle für automatisch angerechnete kurze Pausen zwischen Schulstunden,
  `SHORT_PAUSE_THRESHOLD_MIN`, ist bewusst nicht konfigurierbar und fest im Code hinterlegt)
- Bereinigung alter „Eigene Pause“-Einträge in kurzen Pausen-Slots/`pause-vor-1` (`computePauseCleanup()`, siehe
  Abschnitt 7/8 „Automatische Anrechnung kurzer Pausen“ und Abschnitt 12 für die Filterkriterien) – mutiert direkt
  `entries` über `setEntries`, unabhängig von `config`
- Arbeitszeitmodell (`config.employment`: Beschäftigungsumfang, Vollzeit-Wochenreferenz, individuelle Wochen-Sollzeit)
- Stundenplan-Vorlagen
- Ferien
- Tätigkeiten
- Datenexport/-import (inkl. `dayStatus`, `classTripDays` und `appVersion`, aber **ohne** `theme` – der
  Design-Modus ist eine reine Anzeigeeinstellung des Geräts/Browsers, kein Arbeitszeit-Datum)
- Zurücksetzen (`resetAll` setzt ausdrücklich nicht `theme` zurück)
- Anzeige der aktuellen App-Version (`APP_VERSION`, Abschnitt „Info") – reine Anzeige, kein `localStorage`-Wert

## 5. State- und Datenfluss

```text
localStorage
   ↓ loadJSON()
App State
   ↓
┌───────────────┬──────────────────┬────────────────────┐
│ TagView       │ AuswertungView   │ EinstellungenView  │
└───────┬───────┴──────────────────┴─────────┬──────────┘
        │                                     │
        └──────────── set...() ───────────────┘
                          ↓
                     saveJSON()
                          ↓
                    localStorage
```

Die Daten werden nicht über einen globalen Context oder Redux verwaltet.

## 6. Persistente Daten

Es existieren sieben logische Speicherbereiche:

### `config`

```text
config
├── periods[]
│   ├── nr
│   ├── start
│   └── end
├── activities[]
├── schoolArrivalTime                      (feste Ankunftszeit vor der 1. Stunde, "HH:MM", "" = deaktiviert)
└── employment
    ├── percentage                        (Beschäftigungsumfang in %)
    ├── fullTimeWeeklyReferenceMinutes     (Vollzeit-Wochenreferenz in Minuten)
    └── individualWeeklyTargetMinutes      (optionale individuelle Wochen-Sollzeit, überschreibt percentage)
```

`config.employment` wird beim Laden aus `localStorage` additiv mit Standardwerten zusammengeführt (siehe `App`), damit
ältere gespeicherte Configs ohne dieses Feld weiterhin funktionieren. `config.schoolArrivalTime` benötigt keine
gesonderte Merge-Logik: Da es Teil von `DEFAULT_CONFIG` ist und die Ladefunktion `{ ...DEFAULT_CONFIG, ...loaded }`
verwendet, fällt ein fehlender Wert automatisch auf den Standard („07:45“) zurück. Ein älteres, gleichnamig
gemeintes Feld `leadTimeMinutes` (Minuten-Offset statt fester Uhrzeit, bis 09.09.2026) wird dabei nicht migriert,
sondern schlicht ignoriert.

### `templates`

```text
templates[]
├── id
├── name
├── from
├── to
└── days
    └── weekday
        └── period number → Fach/Klasse-Text
```

Wochentag-Index:

```text
0 Montag
1 Dienstag
2 Mittwoch
3 Donnerstag
4 Freitag
5 Samstag
6 Sonntag
```

Für Stundenplan-Vorlagen werden praktisch nur Schultage verwendet.

### `holidays`

```text
holidays
├── bundesland
└── holidays[]
    ├── id
    ├── name
    ├── start
    └── end
```

### `entries`

Schlüssel ist das lokale ISO-Datum `YYYY-MM-DD`.

```text
entries
└── YYYY-MM-DD
    └── []
        ├── id
        ├── periodNr
        ├── slot
        ├── start
        ├── end
        ├── activity
        └── note
```

### `dayStatus`

```text
dayStatus
└── YYYY-MM-DD
    ├── status   ("SICK" | "VACATION")
    ├── from     (optional, "HH:MM" – abwesend ab dieser Uhrzeit bis Tagesende)
    └── to       (optional, "HH:MM" – abwesend von Tagesbeginn bis zu dieser Uhrzeit)
```

Nur Tage mit Abwesenheitsstatus haben einen Eintrag. Ohne Eintrag gilt ein Datum implizit als `"WORK"`. `from` und
`to` schließen sich gegenseitig aus; sind beide nicht gesetzt, gilt der ganze Tag als abwesend.

### `classTripDays`

```text
classTripDays
└── YYYY-MM-DD → true
```

Nur als Klassenfahrt markierte Tage haben einen Eintrag (analog zu `dayStatus`). Das Flag ist unabhängig von
`dayStatus` – ein Tag kann z. B. gleichzeitig `WORK` (kein `dayStatus`-Eintrag) und Klassenfahrt
(`classTripDays[dateKey] === true`) sein. Siehe Abschnitt 12d „Klassenfahrten“.

### `theme`

```text
theme: "light" | "dark" | "system"
```

Einfacher String (kein Objekt), ebenfalls über `loadJSON`/`saveJSON` gespeichert. Fehlt der Key, gilt `"system"`
als Default. Kein Bestandteil von `entries`/`config`/etc. und daher bewusst außerhalb von JSON-Export/-Import und
`resetAll()` gehalten, da es sich um eine Geräte-/Anzeigeeinstellung handelt, nicht um Arbeitszeitdaten.

## 7. Eintragsarten

### Reguläre Schulstunde

```js
{
  id,
  periodNr: 1,
  slot: null,
  start: "08:00",
  end: "08:45",
  activity: "Unterricht",
  note: "..."
}
```

### Pause zwischen Schulstunden

Nur relevant, wenn die Lehrkraft für diesen Pausen-Slot **bewusst** einen eigenen Eintrag anlegt (z. B. um eine
längere Pause wie die „große Pause“ tatsächlich als `Eigene Pause` zu erfassen, oder um dort eine echte Tätigkeit
wie `Pausenaufsicht` zu buchen). Ohne einen solchen Eintrag existiert für kurze Pausen keine Zeile in `entries` –
sie werden stattdessen zur Laufzeit automatisch mitgezählt (siehe Abschnitt 8, „Automatische Anrechnung kurzer
Pausen“). Öffnet die Lehrkraft den Slot zum Bearbeiten, ist bewusst **keine** Tätigkeit wie `Eigene Pause`
vorbelegt, sondern – wie bei einer Schulstunde ohne Vorlage – die erste konfigurierte Tätigkeit (`activities[0]`);
die Lehrkraft trifft die Wahl aktiv (siehe `PauseSlotRow` in Abschnitt 4).

```js
{
  id,
  periodNr: null,
  slot: "pause-1",
  start: "08:45",
  end: "08:50",
  activity: "Pausenaufsicht", // von der Lehrkraft frei gewählt, kein automatischer Vorgabewert
  note: ""
}
```

### Ankunftszeit vor der 1. Stunde

Technisch derselbe Eintragstyp wie eine Pause zwischen Schulstunden, mit dem reservierten Slot-Schlüssel
`"pause-vor-1"` und Zeitspanne `[config.schoolArrivalTime, 1. Stunde Start]`. Wird ebenfalls nur gespeichert, wenn
die Lehrkraft den Slot bewusst bearbeitet; andernfalls greift dieselbe automatische Anrechnung wie bei kurzen
Pausen.

```js
{
  id,
  periodNr: null,
  slot: "pause-vor-1",
  start: "07:45",
  end: "08:00",
  activity: "Unterricht", // von der Lehrkraft frei gewählt, kein automatischer Vorgabewert
  note: ""
}
```

### Freier Eintrag

```js
{
  id,
  periodNr: null,
  slot: null,
  start: "15:00",
  end: "15:45",
  activity: "Korrektur",
  note: "..."
}
```

### Ausgefallene Stunde

Eine reguläre Stunde kann mit `activity: "Ausgefallen"` gespeichert werden. Sie wird visuell speziell dargestellt und zählt nicht als Arbeitszeit.

### Fahrt / Nachtbereitschaft (Klassenfahrt)

Wie jeder andere freie oder Schulstunden-Eintrag, nur mit `activity: "Fahrt"` bzw. `activity: "Nachtbereitschaft"`.
Beide sind Teil von `NONWORK` und zählen daher – wie `Eigene Pause`/`Ausgefallen` – nicht zur Ist-Arbeitszeit,
werden aber vollständig erfasst und in der Klassenfahrten-Auswertung getrennt ausgewiesen (siehe Abschnitt 12d).
Typischerweise (aber nicht zwingend) nur an Tagen mit `classTripDays[dateKey] === true` verwendet.

## 8. Zeitberechnung

Zeitwerte werden als `HH:MM` gespeichert.

```text
"08:45"
   ↓ toMin()
525
```

Dauer:

```text
durationOf(entry)
= max(0, toMin(end) - toMin(start))
```

Arbeitszeit:

```text
isWorkEntry(entry)
= !NONWORK.has(entry.activity)
```

Aktuelle `NONWORK`-Menge:

```js
new Set(["Eigene Pause", "Ausgefallen"])
```

### Automatische Anrechnung kurzer Pausen

Zusätzlich zur entrybasierten Berechnung oben gibt es eine zweite, rein zur Laufzeit berechnete Ergänzung (kein
eigener `entries`-Eintrag), umgesetzt sowohl in `TagView` (Anzeige) als auch in `AuswertungView` (Aggregation):

```text
isShortGap(gapMinutes) = gapMinutes > 0 && gapMinutes <= SHORT_PAUSE_THRESHOLD_MIN   // Standard: 10

Für jede Schulstunde p mit nachfolgender Stunde next:
  gap = toMin(next.start) - toMin(p.end)
  zählt automatisch, wenn:
    - p besitzt einen Eintrag UND isWorkEntry(eintrag_p) UND
    - isShortGap(gap) UND
    - für Slot "pause-{p.nr}" existiert KEIN eigener Eintrag
  → gap Minuten werden der Ist-Arbeitszeit sowie byActivity/byCategory der Tätigkeit von eintrag_p zugerechnet

Zusätzlich, für die 1. Stunde:
  leadMinutes = toMin(1. Stunde Start) - toMin(config.schoolArrivalTime)
  zählt automatisch, wenn:
    - config.schoolArrivalTime ist gesetzt UND
    - die 1. Stunde besitzt einen Eintrag UND isWorkEntry(eintrag_1) UND
    - leadMinutes > 0 UND
    - für Slot "pause-vor-1" existiert KEIN eigener Eintrag
  → leadMinutes werden der Ist-Arbeitszeit sowie byActivity/byCategory der Tätigkeit von eintrag_1 zugerechnet
```

`SHORT_PAUSE_THRESHOLD_MIN` (Standard 10 Minuten) ist fest im Code hinterlegt und nicht über die Einstellungen
konfigurierbar; `config.schoolArrivalTime` (Standard „07:45“, leerer Wert deaktiviert den Block) ist konfigurierbar
(siehe Abschnitt 6, `config`) und bewusst als feste Uhrzeit statt als Minuten-Offset zur 1. Stunde modelliert, da
die tatsächliche Ankunftszeit einer Lehrkraft in der Regel unabhängig vom jeweiligen Beginn der 1. Stunde ist.
Legt die Lehrkraft für einen betroffenen Pausen-Slot selbst einen Eintrag an, hat dieser immer Vorrang – die
automatische Anrechnung greift dann für diesen Slot nicht mehr, unabhängig davon, ob der eigene Eintrag
`isWorkEntry` ist oder nicht (auch ein bereits vor dieser Änderung angelegter `Eigene Pause`-Eintrag blockiert die
Automatik weiterhin, bis er gelöscht wird).

Da diese Minuten keinen eigenen `entries`-Eintrag erzeugen, tauchen sie nicht als eigene Zeile im CSV-Export auf
(siehe Abschnitt 13); sie sind ausschließlich in der von `AuswertungView` berechneten Ist-Arbeitszeit sowie den
Tätigkeits-/Kategorie-Aggregaten enthalten.

### Bereinigung alter „Eigene Pause“-Einträge (`computePauseCleanup`)

Da ein eigener Eintrag die Automatik oben blockiert, kann es – insbesondere bei flächendeckend vorausgeplanten
zukünftigen Tagen aus der Zeit vor Einführung der Automatik – vorkommen, dass sehr viele Tage bereits einen
manuellen `Eigene Pause`-Eintrag für kurze Pausen-Slots besitzen. `EinstellungenView` bietet dafür eine gebündelte
Bereinigung über alle Tage in `entries`:

```text
für jeden Tag in entries:
  für jeden Eintrag e des Tages:
    behalten, außer:
      - e.slot ist "pause-vor-1" ODER beginnt mit "pause-" UND
      - e.activity === "Eigene Pause" UND
      - (e.slot === "pause-vor-1" ODER isShortGap(durationOf(e)))
    → dann: löschen, Zähler ++
```

Das Ergebnis (Anzahl + bereinigtes `entries`-Objekt) wird zunächst nur berechnet und zur Bestätigung angezeigt;
erst nach explizitem „Ja, löschen“ wird `setEntries(next)` aufgerufen (zweistufiges Bestätigungsmuster wie bei
„Alle Daten zurücksetzen“, Abschnitt 13). Bewusst **nicht** entfernt werden `Eigene Pause`-Einträge in normal
langen `pause-<nr>`-Slots (z. B. die 20-minütige große Pause) sowie Pausen-Slots mit einer anderen, echten
Tätigkeit (z. B. `Pausenaufsicht`) – diese wurden bewusst so erfasst und sollen erhalten bleiben.

## 9. Tagesansicht – Entscheidungslogik

```text
Datum
 │
 ├── Wochenende? ──────────────── Ja ──> kein Schulstundenraster
 │
 ├── Ferien? ──────────────────── Ja ──> kein Schulstundenraster
 │
 ├── Status "Krank"/"Urlaub", ganztägig? ─ Ja ──> kein Schulstundenraster
 │
 └── sonst ─────────────────────────────> Schulstundenraster
                                              │
                                              ├── vorhandener Eintrag
                                              ├── (falls Zeit im Abwesenheitsfenster liegt) Status-Hinweis, ohne Tätigkeitsauswahl
                                              ├── geplante Vorlage
                                              └── leer
```

Der Tages-Status wird direkt aus `dayStatus[dateKey]` gelesen (`status`, optional `from`/`to`) und ist unabhängig von
Wochenende/Ferien. Freie Einträge bleiben in allen "kein Schulstundenraster"-Fällen weiterhin möglich.

Bei teilweiser Abwesenheit (`from` oder `to` gesetzt) wird pro Schulstunde und Pausenslot per `isCoveredByAbsence()`
geprüft, ob deren Zeitspanne mit dem Abwesenheitsfenster überlappt. Nur Slots **ohne** vorhandenen Eintrag werden
dabei durch den Status-Hinweis ersetzt bzw. (bei Pausen) ausgeblendet – ein bereits erfasster Eintrag wird nie
verdeckt oder verworfen.

Zwischen zwei Schulstunden wird aus der Differenz von `p.end` und `next.start` ein optionaler Pausenslot erzeugt.

## 10. Stundenplan-Vorlagen

Für ein Datum wird mit `findTemplateFor()` eine Vorlage gesucht, deren Zeitraum das Datum einschließt.

Danach wird über den Wochentag die Tageskonfiguration gelesen:

```text
template
  ↓
from <= Datum <= to
  ↓
days[Wochentag]
  ↓
days[Wochentag][periodNr]
  ↓
geplante Stunde
```

Eine Vorlage erzeugt **keinen** Arbeitszeiteintrag. Erst die Bestätigung erzeugt einen echten Eintrag.

## 11. Ferienlogik

`findHolidayFor(holidays, date)` sucht einen Ferienzeitraum, der das Datum einschließt.

Wenn ein Ferienzeitraum gefunden wird:

- kein Schulstundenraster
- freie Einträge bleiben möglich

### Online-Import

Die App lädt drei Jahre:

```text
aktuelles Jahr - 1
aktuelles Jahr
aktuelles Jahr + 1
```

über:

```text
https://schulferien-api.de/api/v1/{jahr}/{bundesland}/
```

Die Ergebnisse werden mit vorhandenen Ferien zusammengeführt.

### ICS-Import

`EinstellungenView` enthält einen einfachen ICS-Parser. Er verarbeitet insbesondere:

- `BEGIN:VEVENT`
- `END:VEVENT`
- `SUMMARY`
- `DTSTART`
- `DTEND`

Bei ganztägigen ICS-Terminen wird das exklusive `DTEND` berücksichtigt, indem ein Tag abgezogen wird.

## 12. Auswertung

`AuswertungView` bestimmt zunächst einen Zeitraum:

```text
Tag      → anchor bis anchor
Woche    → Montag bis Sonntag
Monat    → erster bis letzter Tag des Monats
Frei     → customFrom bis customTo
```

Danach werden alle passenden Einträge durchlaufen.

Für jeden Eintrag:

```text
durationOf()
      ↓
Gesamtdauer
      ↓
falls isWorkEntry()
      ├── Gesamtarbeitszeit erhöhen
      └── Tätigkeit aggregieren
sonst falls Tag als Klassenfahrt markiert und activity ∈ {"Fahrt", "Nachtbereitschaft", "Eigene Pause"}
      └── getrennt in classTrip-Statistik aggregieren (siehe Abschnitt 12d), NICHT in Gesamtarbeitszeit
```

Die Detailzeilen werden zusätzlich für den CSV-Export gesammelt.

Anschließend wird pro Tag zusätzlich `config.periods` durchlaufen, um automatisch anrechenbare kurze Pausen und die
Ankunftszeit vor der 1. Stunde zu ergänzen (siehe Abschnitt 8, „Automatische Anrechnung kurzer Pausen“):

```text
für jede Schulstunde p mit Eintrag, isWorkEntry(eintrag_p):
    falls isShortGap(gap zu next) und kein eigener Eintrag für "pause-{p.nr}"
        → gap-Minuten zusätzlich auf Gesamtarbeitszeit, byActivity[eintrag_p.activity], byCategory anrechnen
für die 1. Stunde, falls dort ein Eintrag mit isWorkEntry existiert:
    leadMinutes = toMin(1. Stunde Start) - toMin(config.schoolArrivalTime)
    falls config.schoolArrivalTime gesetzt, leadMinutes > 0 und kein eigener Eintrag für "pause-vor-1"
        → leadMinutes zusätzlich anrechnen
```

Diese zusätzlichen Minuten erzeugen keine eigene Zeile in den CSV-Detailzeilen (siehe Abschnitt 13) – sie fließen
ausschließlich in Gesamtarbeitszeit, `byActivity` und `byCategory` ein.

## 12a. Soll-Arbeitszeit und Anrechnung (Arbeitszeitmodell)

Zusätzlich zur Ist-Arbeitszeit berechnet `AuswertungView` für denselben Zeitraum:

```text
für jeden Tag im Zeitraum:
    dayTarget = dailyTargetMinutes(templates, employment, tag)
    target += dayTarget
    statusEntry = dayStatus[tag]  (oder null)
    falls statusEntry vorhanden:
        creditedAbsence += dayTarget × dayAbsenceFraction(config, statusEntry)
    falls classTripDays[tag] vorhanden:
        classTripCreditMinutes += classTripCreditMinutesPerDay(config)   (siehe Abschnitt 12d)

effective = actual + creditedAbsence + classTripCreditMinutes
difference = effective - target
```

`dayAbsenceFraction()`:

```text
kein statusEntry ──> 0
statusEntry ohne from/to (ganztägig) ──> 1
statusEntry mit from/to ──> Anteil der Überschneidung von [from, to] mit dem Schulstunden-Zeitfenster
    (erste bis letzte konfigurierte Schulstunde aus config.periods), relativ zur Fensterlänge
```

`dailyTargetMinutes()`:

```text
Wochenende? ──> 0

effektives Wochensoll = effectiveWeeklyTargetMinutes(employment)
    (individualWeeklyTargetMinutes falls gesetzt, sonst fullTimeWeeklyReferenceMinutes × percentage / 100)

aktive Stundenplan-Vorlage für den Tag vorhanden und enthält geplante Stunden?
    ├── Ja ──> Wochensoll × (geplante Stunden an diesem Wochentag / geplante Stunden gesamt Mo–Fr in der Vorlage)
    └── Nein ─> Wochensoll / 5
```

Diese Berechnung ist unabhängig von den tatsächlich erfassten Einträgen (`entries`) und von Ferien/Feiertagen – sie
iteriert rein über Kalendertage und die für das jeweilige Datum aktive Stundenplan-Vorlage. Die dabei entstehenden
Zwischenwerte sind bewusst nicht gerundet (z. B. bei ungerader Aufteilung auf 5 Werktage oder anteiliger
Krankheits-/Urlaubsanrechnung); erst `fmtDur()` rundet für die Anzeige auf ganze Minuten.

## 12b. Startgrenze „erster Eintrag“

`firstEntryDate(entries)` liefert das früheste Datum mit mindestens einem Eintrag über den kompletten `entries`-
Bestand (nicht auf den aktuell gewählten Zeitraum begrenzt), oder `null`, falls noch keine Einträge existieren.

In `AuswertungView` wird dieser Wert als `floorDate` in die Tagesschleife der Soll-/Anrechnungsberechnung
eingebunden:

```text
für jeden Tag im Zeitraum:
    beforeFirstEntry = floorDate vorhanden UND Tag < floorDate
    dayTarget = beforeFirstEntry ? 0 : dailyTargetMinutes(...)
    creditedAbsence-Zuwachs nur, falls NICHT beforeFirstEntry
```

Die Ist-Arbeitszeit (`actual`) ist davon unberührt, da vor `floorDate` ohnehin keine Einträge existieren können. Der
Effekt: Soll, anrechenbare Abwesenheit und Bilanz laufen nie rückwirkend vor dem tatsächlichen Beginn der
App-Nutzung, auch wenn ein gewählter Zeitraum (z. B. „Frei“ oder „Monat“) weiter zurückreicht.

Ein Hinweistext in `AuswertungView` wird angezeigt, wenn `floorDate` nach dem (auf Kalendertag normalisierten)
Anfang des aktuell dargestellten Zeitraums liegt – also nur dann, wenn die Begrenzung die angezeigten Werte
tatsächlich beeinflusst.

## 12c. Diagramme in der Auswertung

Zusätzlich zur Tagesschleife für Soll/Anrechnung aggregiert `AuswertungView` in derselben Schleife:

- `byCategory`: Summe der Ist-Arbeitszeit je Kategorie (`categoryOf(activity)`), analog zu `byActivity`.
- `dayStats`: Liste `{ dateKey, actual, target }` je Kalendertag im Zeitraum (Ist aus den Einträgen dieses Tages,
  Soll aus `dailyTargetMinutes()` bzw. `0` vor `floorDate`).

`categoryOf(activity)` schlägt die Kategorie in `ACTIVITY_TO_CATEGORY` nach; ohne Treffer (z. B. bei
benutzerdefinierten Tätigkeiten) wird `"sonstiges"` verwendet. `CATEGORY_META` enthält je Kategorie Anzeigename und
Farbe für `CategoryDonut`.

`CategoryDonut` zeichnet für `byCategory` (sortiert nach Anteil) ein SVG-Ringdiagramm mittels mehrerer
`<circle>`-Elemente mit `strokeDasharray`/`strokeDashoffset` (kumulativer Offset je Segment) – keine externe
Bibliothek. `TrendChart` zeichnet für `dayStats` je Kalendertag eine Balkensäule (Ist, gefüllt) mit einer
gestrichelten Linie auf Höhe des Tages-Solls, in einem horizontal scrollbaren Container für längere Zeiträume. Der
Verlauf wird nur ab Modus „Woche“ aufwärts angezeigt (nicht bei Modus „Tag“).

## 12d. Klassenfahrten

In derselben Tagesschleife wie 12/12a/12c aggregiert `AuswertungView` zusätzlich, sofern `classTripDays[tag]`
gesetzt ist:

```text
classTripDayCount += 1
classTripActual   += Ist-Arbeitszeit dieses Tages (isWorkEntry-Einträge + automatisch angerechnete Minuten)
classTripFahrt     += Dauer der Einträge mit activity === "Fahrt"
classTripNacht      += Dauer der Einträge mit activity === "Nachtbereitschaft"
classTripPause      += Dauer der Einträge mit activity === "Eigene Pause"
classTripCreditMinutes += classTripCreditMinutesPerDay(config)
```

`classTripCreditMinutesPerDay(config)` = `CLASS_TRIP_CREDIT_LESSON_PERIODS` (aktuell `1`) ×
`lessonPeriodMinutesFor(config.periods)`. Letzteres liefert die Dauer der 1. konfigurierten Schulstunde
(`toMin(end) - toMin(start)`) bzw. `45` Minuten als Fallback ohne konfigurierte Stunden – bewusst **nicht**
pauschal 60 Minuten, um „Unterrichtsstunde“ nicht mit „Zeitstunde“ gleichzusetzen.

Die aggregierten Werte (`classTrip`) werden nur dann als eigener Abschnitt „Klassenfahrten im Zeitraum“ gerendert,
wenn `classTrip.dayCount > 0`. `classTripCreditMinutes` fließt zusätzlich in `effective`/die Bilanz-Kachel ein
(siehe Abschnitt 12a); dort erscheint bei `classTrip.creditMinutes > 0` ein zusätzlicher Hinweistext.

Bewusste Einschränkung dieser ersten Version: Es gibt weder ein übergeordnetes `ClassTrip`-Objekt noch ein
`employment_type`-Feld (verbeamtet/angestellt); die Anrechnung wird pauschal für alle Beschäftigungsarten und
Teilzeitumfänge in gleicher Höhe angesetzt und in der Tagesansicht sowie der Auswertung entsprechend als
„pauschal berechnet“ gekennzeichnet. Details und offene Punkte siehe `AI_CONTEXT.md`, Abschnitt 16.

## 13. Import/Export

### JSON

Der JSON-Export speichert den kompletten aktuellen App-Zustand, inklusive `dayStatus` und `classTripDays`, sowie
zusätzlich `appVersion` (die `APP_VERSION` zum Exportzeitpunkt) als reine Migrations-/Diagnoseinformation.

Der Import setzt die vorhandenen Bereiche nur dann, wenn der entsprechende Schlüssel in der Datei vorhanden ist.
`appVersion` wird beim Import aktuell nicht ausgewertet oder geprüft – ältere Sicherungen ohne dieses Feld bleiben
vollständig kompatibel. Das Feld ist als Grundlage für eine spätere Migrationslogik (Gerätewechsel, Übergang in
eine mögliche „Vollversion") vorgesehen, ohne dass dafür bereits jetzt eine Versionsprüfung nötig wäre.

### CSV

Der CSV-Export kommt aus `AuswertungView` und exportiert nur den aktuell gewählten Zeitraum. Er enthält
ausschließlich echte `entries`-Einträge (`rows`); automatisch angerechnete kurze Pausen und Ankunftszeit ohne
eigenen Eintrag (siehe Abschnitt 8/12) erzeugen keine eigene CSV-Zeile, sind aber in der zugehörigen
Ist-Arbeitszeit-Anzeige enthalten.

## 14. Styling

Tailwind CSS wird über `src/index.css` eingebunden.

Globale Basis:

- `html`, `body`, `#root` volle Höhe
- Hintergrund `#f5f5f4` (hell); bei aktivem Darkmode (`html.dark`) `#0c0a09` (dunkel)
- mobile Tap-Hervorhebung deaktiviert

Das konkrete Design befindet sich überwiegend direkt in JSX über Tailwind-Klassen.

### Darkmode

`tailwind.config.js` verwendet `darkMode: "class"`. Ob die Klasse `dark` auf `document.documentElement` gesetzt
ist, wird zur Laufzeit in `App` anhand des `theme`-States (`"light" | "dark" | "system"`) entschieden (siehe
Abschnitt 4). Farbbezogene Tailwind-Klassen im gesamten `src/App.jsx` besitzen dafür durchgängig passende
`dark:`-Geschwistervarianten (z. B. `text-stone-800 dark:text-stone-100`, `border-stone-300
dark:border-stone-700`, `bg-white dark:bg-stone-800`). Ausgenommen sind bewusst dunkel gehaltene Flächen wie die
Kopf-/Fußleiste (`bg-emerald-950`) sowie einzelne gefüllte Akzent-/Auswahl-Buttons – diese bleiben in beiden
Modi unverändert, da ihr Kontrast bereits ausreicht.

Bei künftigen Änderungen an Farben in `src/App.jsx` sollte für neue helle Flächen/Texte/Ränder jeweils eine
passende `dark:`-Variante ergänzt werden, damit der Darkmode konsistent bleibt.

Zusätzlich wird `color-scheme` gesetzt (`<meta name="color-scheme" content="light dark">` in `index.html` sowie
`html { color-scheme: light }` / `html.dark { color-scheme: dark }` in `src/index.css`). Das ist erforderlich,
damit (a) native Formularelemente (`<input type="time">`/`date`/`number`, Scrollbars) im jeweiligen Modus
passend eingefärbt werden und (b) manche Browser die Seite nicht ungefragt per eigener „Force Dark"-Heuristik
abdunkeln, was sonst zu Kontrastfehlern führt (z. B. weiße native Inputs auf sonst dunkel gerendertem Hintergrund).

## 15. Deployment

GitHub Actions:

```text
Push auf main
    ↓
Checkout
    ↓
Node 24
    ↓
npm ci
    ↓
npm run build
    ↓
dist
    ↓
GitHub Pages Artifact
    ↓
GitHub Pages Deployment
```

Vite-Basis:

```js
base: "/Pensum/"
```

Dieser Pfad ist für das Repository als GitHub-Pages-Projektseite wichtig und darf bei Änderungen nicht versehentlich entfernt werden.

## 16. Architekturgrenzen / zukünftige Entwicklung

Die derzeitige zentrale Datei `src/App.jsx` ist mit rund 945 Zeilen bereits relativ groß.

Bei künftigen größeren Änderungen kann schrittweise ausgelagert werden, beispielsweise:

```text
src/
├── components/
├── views/
├── utils/
└── storage.js
```

Eine solche Aufteilung soll jedoch schrittweise erfolgen und nur dann, wenn sie die Wartbarkeit tatsächlich verbessert oder für eine Funktion erforderlich ist.

Speziell zum Klassenfahrten-Modul (siehe Abschnitt 12d) bewusst zurückgestellte Erweiterungen: ein
übergeordnetes `ClassTrip`-Objekt, ein `employment_type`-Feld (verbeamtet/angestellt) mit eigener, rechtlich
geprüfter Anrechnungsregel für Angestellte/Teilzeitkräfte, ein erweiterbares Bundesland-Regelwerk sowie
Auswertungs-Zeiträume „Schulhalbjahr“/„Schuljahr“. Details siehe `AI_CONTEXT.md`, Abschnitt 16.
