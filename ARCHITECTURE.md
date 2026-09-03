# Pensum – Technische Architektur

Stand: 03.09.2026

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

- `config`
- `templates`
- `holidaySettings`
- `entries`
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

und verwendet `setDayEntries()` zum Speichern der Tagesdaten.

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

Ermittelt anhand von `entries` einen Zeitraum und aggregiert Arbeitszeiten.

### `TemplateEditor`

Bearbeitet eine Stundenplan-Vorlage mit Zeitraum und Einträgen je Wochentag/Stunde.

### `EinstellungenView`

Verwaltet:

- Schulstunden
- Stundenplan-Vorlagen
- Ferien
- Tätigkeiten
- Datenexport/-import
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

Es existieren vier logische Speicherbereiche:

### `config`

```text
config
├── periods[]
│   ├── nr
│   ├── start
│   └── end
└── activities[]
```

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
 ├── Wochenende? ── Ja ──> kein Schulstundenraster
 │
 ├── Ferien? ───── Ja ──> kein Schulstundenraster
 │
 └── sonst ─────────────> Schulstundenraster
                              │
                              ├── vorhandener Eintrag
                              ├── geplante Vorlage
                              └── leer
```

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

## 13. Import/Export

### JSON

Der JSON-Export speichert den kompletten aktuellen App-Zustand.

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
