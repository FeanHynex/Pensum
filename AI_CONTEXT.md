# Pensum – Projektkontext für KI

Stand: 03.09.2026 (mit Ergänzung: Soll-/Ist-/Abwesenheitsmodell)

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
- Tages-Status (Arbeit / Krank / Urlaub)
- konfigurierbare Schulstunden
- Stundenplan-Vorlagen
- einzelne erfasste Stunden
- Pausen zwischen Schulstunden
- zusätzliche frei buchbare Einträge
- Bemerkungen
- Kennzeichnung ausgefallener Stunden

An Wochenenden, Ferientagen und an ganztägig als Krank/Urlaub markierten Tagen wird kein Schulstundenraster angezeigt.
Bei einer nur teilweise abwesenden Zeitspanne ("ab Uhrzeit" / "bis Uhrzeit") bleibt das Raster sichtbar; nur die
abgedeckten Schulstunden werden als Status-Hinweis statt als bearbeitbarer Slot dargestellt (siehe unten). Es können
in allen Fällen weiterhin freie Einträge erfasst werden.

### Tages-Status: Krankheit und Urlaub

Jeder Tag kann in der Tagesansicht auf `WORK` (Standard, kein gespeicherter Eintrag), `SICK` oder `VACATION` gesetzt
werden. Zusätzlich lässt sich der Zeitraum innerhalb des Tages eingrenzen:

- **Ganzer Tag** (Standard, kein `from`/`to`) – das komplette Schulstundenraster wird ausgeblendet.
- **Ab Uhrzeit** (`from`) – der Tag gilt ab dieser Uhrzeit bis Tagesende (genauer: bis zum Ende der letzten
  konfigurierten Schulstunde) als Krank/Urlaub. Schulstunden vor dieser Uhrzeit bleiben normal bearbeitbar.
- **Bis Uhrzeit** (`to`) – der Tag gilt von Tagesbeginn (Beginn der ersten konfigurierten Schulstunde) bis zu dieser
  Uhrzeit als Krank/Urlaub. Schulstunden danach bleiben normal bearbeitbar.

Schulstunden, die vollständig oder teilweise im markierten Zeitraum liegen und noch keinen eigenen Eintrag haben,
werden im Raster nur noch als schlichter Status-Hinweis ("Krank"/"Urlaub") angezeigt – ohne Möglichkeit, dafür eine
Tätigkeit auszuwählen. Existiert für eine solche Stunde bereits ein Eintrag (z. B. weil zuerst gearbeitet und danach
der Status gesetzt wurde), bleibt dieser unangetastet und weiterhin normal bearbeitbar; Daten gehen dadurch nie
verloren.

Der Status ist unabhängig von den erfassten Zeiteinträgen:

- Er beeinflusst **nicht** die tatsächlich geleistete Arbeitszeit (Ist) – vorhandene Einträge an einem Krank-/
  Urlaubstag zählen weiterhin normal zur Ist-Arbeitszeit, falls doch etwas erfasst wurde.
- Er bestimmt aber, welcher Anteil des Tages-Solls dieses Tages in der Auswertung als **anrechenbare Abwesenheit**
  gezählt wird (siehe Abschnitt 6a und 11). Bei "Ganzer Tag" ist das der volle Tages-Soll-Wert, bei "Ab"/"Bis
  Uhrzeit" ein anteiliger Wert relativ zum Schulstunden-Zeitfenster.

Dies setzt bewusst nur den ersten Teil des größeren Soll/Ist/Abwesenheits-Konzepts um. Nicht umgesetzt sind bislang:
weitere Statuswerte (`HOLIDAY`, `SCHOOL_BREAK`, `OTHER_ABSENCE`), eine Jahresarbeitszeit-/Kalenderjahr-Betrachtung,
mehrere Bundesland-spezifische Arbeitszeitmodelle und die getrennte Durchschnittsanzeige (nur tatsächliche Arbeitszeit
vs. inkl. Abwesenheiten). Diese können in einem späteren Schritt ergänzt werden.

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
- `fmtDur(min)` → benutzerfreundliche Darstellung; rundet intern auf ganze Minuten, damit z. B. anteilige
  Soll-/Anrechnungswerte nie mit Nachkommastellen angezeigt werden
- `isWorkEntry(entry)` → entscheidet, ob ein Eintrag zur Arbeitszeit zählt

Aktuell gelten diese Tätigkeiten als **keine Arbeitszeit**:

- `Eigene Pause`
- `Ausgefallen`

Die Dauer eines normalen Eintrags ist `max(0, Ende - Start)`.

## 6a. Soll-Arbeitszeit (Arbeitszeitmodell)

Zusätzlich zur Ist-Arbeitszeit aus den Einträgen berechnet die App eine **Soll-Arbeitszeit**. Grundlage sind:

- `config.employment.percentage` – Beschäftigungsumfang in Prozent (Standard 100).
- `config.employment.fullTimeWeeklyReferenceMinutes` – Vollzeit-Wochenreferenz in Minuten (Standard 46:38 h,
  orientiert am niedersächsischen Referenzmodell, frei konfigurierbar).
- `config.employment.individualWeeklyTargetMinutes` – optionale individuelle Wochen-Sollzeit; wenn gesetzt,
  überschreibt sie die prozentuale Berechnung vollständig.

Wichtige Helfer in `src/App.jsx`:

- `effectiveWeeklyTargetMinutes(employment)` → effektives Wochensoll in Minuten.
- `weekdayPeriodCounts(templates, date)` → Anzahl geplanter Stunden je Wochentag (Mo–Fr) aus der für das Datum
  aktiven Stundenplan-Vorlage, oder `null` ohne aktive Vorlage.
- `dailyTargetMinutes(templates, employment, date)` → Tages-Soll. Das Wochensoll wird proportional zur Anzahl
  geplanter Stunden an diesem Wochentag verteilt (mehr Unterricht an einem Tag → höheres Tages-Soll). Ohne aktive
  Vorlage oder ohne geplante Stunden darin wird gleichmäßig auf 5 Werktage verteilt. Am Wochenende ist das Soll 0.
- `dayAbsenceFraction(config, statusEntry)` → Anteil (0–1) eines Tages, der durch einen Abwesenheitseintrag
  (`{ status, from?, to? }`) abgedeckt ist. Ohne `statusEntry` (Status `WORK`): 0. Ohne `from`/`to` (ganztägig): 1.
  Mit `from`/`to`: Anteil relativ zum Schulstunden-Zeitfenster (erste bis letzte konfigurierte Schulstunde,
  `config.periods`).

Das Tages-Soll ist **unabhängig vom Ferienstatus** – Ferien reduzieren das Soll aktuell nicht automatisch (siehe
Abschnitt 5, offene Punkte).

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
- `dayStatus`

`src/storage.js` stellt dafür `loadJSON()` und `saveJSON()` bereit.

### Datenmodell – aktuelle Form

`config`:

```js
{
  periods: [
    { nr, start, end }
  ],
  activities: ["Unterricht", ...],
  employment: {
    percentage: 100,
    fullTimeWeeklyReferenceMinutes: 2798, // 46:38 h
    individualWeeklyTargetMinutes: null,
  }
}
```

`config.employment` wird beim Laden additiv mit `DEFAULT_EMPLOYMENT` zusammengeführt, damit ältere gespeicherte
Configs ohne dieses Feld kompatibel bleiben.

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

`dayStatus`:

```js
{
  "YYYY-MM-DD": { status: "SICK" | "VACATION", from?: "HH:MM", to?: "HH:MM" }
}
```

Nur Tage mit Status `SICK` oder `VACATION` besitzen einen Eintrag. Fehlt ein Datum in `dayStatus`, gilt implizit
`status: "WORK"`. Das Setzen von `"WORK"` in der Tagesansicht löscht daher den Eintrag statt ihn zu speichern.

`from` und `to` sind optional und schließen sich gegenseitig aus (es wird in der Tagesansicht immer nur eines von
beiden gesetzt):

- weder `from` noch `to` gesetzt → ganztägig abwesend
- `from` gesetzt → abwesend ab dieser Uhrzeit bis Tagesende (Ende der letzten konfigurierten Schulstunde)
- `to` gesetzt → abwesend von Tagesbeginn (Beginn der ersten konfigurierten Schulstunde) bis zu dieser Uhrzeit

Siehe `dayAbsenceFraction()` (Abschnitt 6a) für die daraus abgeleitete anteilige Anrechnung.

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

- tatsächlich geleistete Arbeitszeit (Ist) im Zeitraum
- Soll-Arbeitszeit im Zeitraum (Summe der Tages-Soll-Werte, siehe Abschnitt 6a)
- anrechenbare Abwesenheitszeit (Summe der Tages-Soll-Werte an Tagen mit Status `SICK`/`VACATION`, gewichtet mit
  `dayAbsenceFraction()` – bei ganztägiger Abwesenheit voll, bei "ab"/"bis Uhrzeit" anteilig)
- Bilanz/Differenz: `Ist + anrechenbare Abwesenheit − Soll`
- Arbeitszeit nach Tätigkeit
- Detailzeilen für den CSV-Export

`Eigene Pause` und `Ausgefallen` werden bei der Ist-Arbeitszeit und der Tätigkeitsauswertung ausgeschlossen.

Die vier Kennzahlen (Ist, Soll, Anrechnung, Bilanz) werden für Tag/Woche/Monat/freien Zeitraum gleich berechnet – die
Soll- und Anrechnungswerte iterieren dafür Tag für Tag über den gewählten Zeitraum, unabhängig von den tatsächlich
erfassten Einträgen. Der CSV-Export enthält weiterhin nur die einzelnen Zeiteinträge, keine Tages-Soll-Werte.

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
  entries,
  dayStatus
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
- Das Soll-/Ist-/Anrechnungsmodell (Abschnitt 6a, 11) ist ein erster Ausbauschritt eines größeren Konzepts. Es fehlen
  bislang insbesondere: weitere Abwesenheitsarten über Krankheit/Urlaub hinaus, eine Ferien-/Feiertags-Anrechnung
  auf das Soll, eine Jahresarbeitszeit-Betrachtung und mehrere auswählbare Arbeitszeitmodelle je Bundesland.
