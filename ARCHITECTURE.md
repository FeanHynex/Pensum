# Pensum – Technische Architektur

Stand: 03.09.2026 (mit Ergänzung: Soll-/Ist-/Abwesenheitsmodell)

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

Konfiguriert React, PWA und GitHub-Pages-Basis `/Pensum/`.

### `.github/workflows/deploy.yml`

Automatisiertes Build- und GitHub-Pages-Deployment.

## 4. React-Komponentenstruktur – aktueller Stand

```text
App
├── IconBtn
├── EntryForm
├── TagView
├── AuswertungView
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
- aktuell gewählter Tab
- aktuell gewähltes Datum

Außerdem verbindet `App` React-State und `localStorage`.

### `TagView`

Verantwortlich für die Erfassung eines einzelnen Tages.

Sie erhält unter anderem:

- `date`
- `entries`
- `config`
- `templates`
- `holidays`
- `dayStatus`

und verwendet `setDayEntries()` zum Speichern der Tagesdaten sowie `setDayStatus(dateKey, value)` zum Setzen bzw.
(bei `value = null`) Löschen des Tages-Status. `value` ist entweder `null` (= Status `WORK`) oder
`{ status: "SICK" | "VACATION", from?: "HH:MM", to?: "HH:MM" }` (siehe Abschnitt 6, `dayStatus`).

Bei ganztägiger Abwesenheit (weder `from` noch `to` gesetzt) wird das komplette Schulstundenraster ausgeblendet. Bei
teilweiser Abwesenheit (`from` oder `to` gesetzt) bleibt das Raster sichtbar; Schulstunden ohne eigenen Eintrag, die
im markierten Zeitraum liegen, werden als reiner Status-Hinweis dargestellt statt als bearbeitbarer/leerer Slot –
dafür ist keine Tätigkeitsauswahl mehr nötig. Bereits vorhandene Einträge in dieser Zeitspanne bleiben unverändert
editierbar.

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
Soll-Arbeitszeit und die anrechenbare Abwesenheitszeit des Zeitraums (siehe Abschnitt 12a).

### `TemplateEditor`

Bearbeitet eine Stundenplan-Vorlage mit Zeitraum und Einträgen je Wochentag/Stunde.

### `EinstellungenView`

Verwaltet:

- Schulstunden
- Arbeitszeitmodell (`config.employment`: Beschäftigungsumfang, Vollzeit-Wochenreferenz, individuelle Wochen-Sollzeit)
- Stundenplan-Vorlagen
- Ferien
- Tätigkeiten
- Datenexport/-import (inkl. `dayStatus`)
- Zurücksetzen

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

Es existieren fünf logische Speicherbereiche:

### `config`

```text
config
├── periods[]
│   ├── nr
│   ├── start
│   └── end
├── activities[]
└── employment
    ├── percentage                        (Beschäftigungsumfang in %)
    ├── fullTimeWeeklyReferenceMinutes     (Vollzeit-Wochenreferenz in Minuten)
    └── individualWeeklyTargetMinutes      (optionale individuelle Wochen-Sollzeit, überschreibt percentage)
```

`config.employment` wird beim Laden aus `localStorage` additiv mit Standardwerten zusammengeführt (siehe `App`), damit
ältere gespeicherte Configs ohne dieses Feld weiterhin funktionieren.

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

```js
{
  id,
  periodNr: null,
  slot: "pause-1",
  start: "08:45",
  end: "08:50",
  activity: "Eigene Pause",
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
```

Die Detailzeilen werden zusätzlich für den CSV-Export gesammelt.

## 12a. Soll-Arbeitszeit und Anrechnung (Arbeitszeitmodell)

Zusätzlich zur Ist-Arbeitszeit berechnet `AuswertungView` für denselben Zeitraum:

```text
für jeden Tag im Zeitraum:
    dayTarget = dailyTargetMinutes(templates, employment, tag)
    target += dayTarget
    statusEntry = dayStatus[tag]  (oder null)
    falls statusEntry vorhanden:
        creditedAbsence += dayTarget × dayAbsenceFraction(config, statusEntry)

effective = actual + creditedAbsence
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

## 13. Import/Export

### JSON

Der JSON-Export speichert den kompletten aktuellen App-Zustand, inklusive `dayStatus`.

Der Import setzt die vorhandenen Bereiche nur dann, wenn der entsprechende Schlüssel in der Datei vorhanden ist.

### CSV

Der CSV-Export kommt aus `AuswertungView` und exportiert nur den aktuell gewählten Zeitraum.

## 14. Styling

Tailwind CSS wird über `src/index.css` eingebunden.

Globale Basis:

- `html`, `body`, `#root` volle Höhe
- Hintergrund `#f5f5f4`
- mobile Tap-Hervorhebung deaktiviert

Das konkrete Design befindet sich überwiegend direkt in JSX über Tailwind-Klassen.

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
