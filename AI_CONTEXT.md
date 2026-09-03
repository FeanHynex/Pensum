# Pensum – Projektkontext für KI

Stand: 03.09.2026

## 1. Projekt

**Pensum** ist eine Web-App zur Erfassung und Auswertung der Arbeitszeit von Lehrkräften.

Das aktuelle Projekt ist als kleine, mobile-first React-Anwendung aufgebaut und kann als Progressive Web App (PWA) über GitHub Pages veröffentlicht werden.

## 2. Technischer Stack

- React 18
- React DOM 18
- Vite 6
- JavaScript / JSX
- Tailwind CSS 3
- `lucide-react` für Icons
- `vite-plugin-pwa` für PWA-Funktionalität
- PostCSS / Autoprefixer

Die Abhängigkeiten und Versionen stehen verbindlich in `package.json` bzw. `package-lock.json`.

## 3. Projektstruktur

```text
Pensum/
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub-Pages-Deployment
├── public/
│   └── pwa-icon.svg         # PWA-/Favicon-Icon
├── src/
│   ├── App.jsx              # aktuell zentrale Anwendung
│   ├── index.css            # Tailwind + globale Basisstile
│   ├── main.jsx             # React-Einstiegspunkt
│   └── storage.js           # localStorage-Helfer
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── AI_INSTRUCTIONS.md
├── AI_CONTEXT.md
├── ARCHITECTURE.md
└── CHANGELOG.md
```

## 4. Benutzeroberfläche

Die App besitzt aktuell drei Hauptbereiche:

1. **Tag** – Erfassung und Bearbeitung von Arbeitszeiten für einen einzelnen Tag.
2. **Auswertung** – Auswertung nach Tag, Woche, Monat oder frei gewähltem Zeitraum.
3. **Einstellungen** – Stundenraster, Stundenplan-Vorlagen, Ferien, Tätigkeiten und Datensicherung.

Die Oberfläche ist auf eine schmale, mobile Darstellung ausgelegt (`max-w-md`) und verwendet überwiegend Tailwind-Klassen.

## 5. Tageserfassung

Die Tagesansicht berücksichtigt:

- Wochentage und Wochenenden
- Schulferien
- konfigurierbare Schulstunden
- Stundenplan-Vorlagen
- einzelne erfasste Stunden
- Pausen zwischen Schulstunden
- zusätzliche frei buchbare Einträge
- Bemerkungen
- Kennzeichnung ausgefallener Stunden

An Wochenenden und Ferientagen wird kein Schulstundenraster angezeigt. Es können dort weiterhin freie Einträge erfasst werden.

### Stundenplan-Vorlagen

Eine Vorlage besitzt einen Gültigkeitszeitraum (`from`, `to`) und eine Zuordnung nach Wochentag und Stunden-Nummer.

Vorlagen stellen zunächst nur geplante Stunden dar. Eine geplante Stunde kann:

- bestätigt werden → daraus wird ein tatsächlicher Arbeitszeiteintrag `Unterricht`;
- bearbeitet werden;
- als `Ausgefallen` markiert werden.

## 6. Arbeitszeitlogik

Arbeitszeiten werden aus Start- und Endzeit berechnet.

Wichtige Helfer in `src/App.jsx`:

- `toMin(hhmm)` → Uhrzeit zu Minuten seit Mitternacht
- `fromMin(min)` → Minuten zu `HH:MM`
- `addMin(hhmm, delta)` → Uhrzeit verschieben
- `durationOf(entry)` → Dauer eines Eintrags in Minuten
- `fmtDur(min)` → benutzerfreundliche Darstellung
- `isWorkEntry(entry)` → entscheidet, ob ein Eintrag zur Arbeitszeit zählt

Aktuell gelten diese Tätigkeiten als **keine Arbeitszeit**:

- `Eigene Pause`
- `Ausgefallen`

Die Dauer eines normalen Eintrags ist `max(0, Ende - Start)`.

## 7. Standard-Stundenraster

Der aktuelle Standard besteht aus acht Stunden:

| Nr. | Start | Ende |
|---:|:---:|:---:|
| 1 | 08:00 | 08:45 |
| 2 | 08:50 | 09:35 |
| 3 | 09:55 | 10:40 |
| 4 | 10:45 | 11:30 |
| 5 | 11:35 | 12:20 |
| 6 | 12:25 | 13:10 |
| 7 | 13:15 | 14:00 |
| 8 | 14:05 | 14:50 |

Diese Werte sind Standardwerte und können in den Einstellungen verändert werden.

## 8. Standard-Tätigkeiten

Die aktuelle Standardliste enthält unter anderem:

- Unterricht
- Vertretungsunterricht
- Unterrichtsvorbereitung
- Unterrichtsnachbereitung
- Korrektur
- Elterngespräch
- Gespräch mit Schüler:in
- Gespräch mit Kolleg:in
- Konferenz
- Dienstbesprechung
- Pausenaufsicht
- Klassenleitung
- Organisation / Verwaltung
- Fortbildung
- Schulveranstaltung
- Klassenfahrt
- Projektarbeit
- Eigene Pause
- Sonstiges

Zusätzliche Tätigkeiten können in den Einstellungen angelegt werden.

## 9. Datenspeicherung

Es gibt aktuell keinen eigenen Backend-Server, keine Datenbank und keine Benutzerkonten.

Die Anwendungsdaten werden ausschließlich im Browser über `localStorage` gespeichert.

Aktuelle Speicher-Keys:

- `config`
- `templates`
- `holidays`
- `entries`

`src/storage.js` stellt dafür `loadJSON()` und `saveJSON()` bereit.

### Datenmodell – aktuelle Form

`config`:

```js
{
  periods: [
    { nr, start, end }
  ],
  activities: ["Unterricht", ...]
}
```

`templates`:

```js
[
  {
    id,
    name,
    from,
    to,
    days: {
      0: { 1: "Fach/Klasse", 2: "..." },
      1: { ... },
      // 0 = Montag, ... 4 = Freitag
    }
  }
]
```

`holidays`:

```js
{
  bundesland: "NW",
  holidays: [
    { id, name, start, end }
  ]
}
```

`entries`:

```js
{
  "YYYY-MM-DD": [
    {
      id,
      periodNr: number | null,
      slot: string | null,
      start: "HH:MM",
      end: "HH:MM",
      activity: string,
      note: string
    }
  ]
}
```

Bei Einträgen für reguläre Schulstunden wird `periodNr` verwendet. Bei Pausen zwischen Stunden wird zusätzlich ein `slot` wie `pause-1` verwendet. Freie Einträge haben `periodNr: null` und `slot: null`.

## 10. Ferien

Das Bundesland ist konfigurierbar. Der aktuelle Initialwert ist `NW`.

Ferien können:

- automatisch für das Vorjahr, das aktuelle Jahr und das Folgejahr geladen werden;
- aus einer ICS-Datei importiert werden;
- manuell angelegt, geändert und gelöscht werden.

Der Online-Import verwendet aktuell den externen Dienst:

`https://schulferien-api.de/api/v1/{jahr}/{bundesland}/`

Da dieser Dienst außerhalb der App liegt, muss bei Änderungen die Verfügbarkeit und das erwartete JSON-Format berücksichtigt werden.

## 11. Auswertung

Die Auswertung unterstützt:

- Tag
- Woche
- Monat
- frei wählbarer Zeitraum

Sie berechnet:

- gesamte Arbeitszeit im Zeitraum
- Arbeitszeit nach Tätigkeit
- Detailzeilen für den CSV-Export

`Eigene Pause` und `Ausgefallen` werden bei der Gesamtarbeitszeit und der Tätigkeitsauswertung ausgeschlossen.

Der CSV-Export enthält unter anderem:

- Datum
- Start
- Ende
- Tätigkeit
- Bemerkung
- Dauer in Minuten
- Kennzeichnung, ob es Arbeitszeit ist

## 12. Datensicherung

In den Einstellungen gibt es:

- JSON-Export aller aktuellen App-Daten
- JSON-Import einer Sicherung
- vollständiges Zurücksetzen der lokalen Daten

Der JSON-Export enthält aktuell:

```js
{
  config,
  templates,
  holidaySettings,
  entries
}
```

## 13. PWA und GitHub Pages

`vite.config.js` verwendet:

```js
base: "/Pensum/"
```

Die PWA verwendet ebenfalls den Scope und Startpfad `/Pensum/`.

Das Deployment ist in `.github/workflows/deploy.yml` definiert und läuft bei Pushes auf `main` sowie manuell über `workflow_dispatch`.

Der Workflow:

1. checkt den Code aus;
2. verwendet Node.js 24;
3. führt `npm ci` aus;
4. führt `npm run build` aus;
5. lädt `dist` als GitHub-Pages-Artefakt hoch;
6. veröffentlicht dieses über GitHub Pages.

## 14. Aktuelle Architektur-Einschätzung

`src/App.jsx` ist momentan bewusst relativ kompakt gehalten, enthält aber bereits rund 945 Zeilen und mehrere logisch getrennte Bereiche. Eine spätere Aufteilung in Komponenten, Views und Utility-Dateien kann sinnvoll werden.

Eine solche Aufteilung sollte jedoch nicht nur aus Gründen der Optik erfolgen. Bei einer normalen Funktionsänderung soll zunächst die kleinste sichere Änderung bevorzugt werden.

## 15. Bekannte wichtige Besonderheiten

- Es gibt keine serverseitige Persistenz.
- Das Löschen der Browserdaten kann die lokal gespeicherten Arbeitszeitdaten entfernen; deshalb existiert die JSON-Sicherung.
- Ferien aus dem externen Dienst sollten vor produktiver Nutzung geprüft werden.
- `Ausgefallen` wird in der Oberfläche verwendet und von der Arbeitszeitberechnung ausgeschlossen, obwohl es nicht Teil der initialen `DEFAULT_ACTIVITIES`-Liste ist.
- Die App ist aktuell auf deutsche Sprache und deutsche Datumsformatierung ausgelegt.
