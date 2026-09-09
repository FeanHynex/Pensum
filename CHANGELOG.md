# Pensum – Changelog

Alle Einträge beziehen sich auf den Stand des GitHub-Projekts. Die Datei soll bei relevanten zukünftigen Änderungen durch die bearbeitende KI ergänzt werden.

## 2026-09-09

### Funktionalität

- Kurze Pausen zwischen zwei Schulstunden (Standard: bis zu 10 Minuten) zählen jetzt automatisch zur
  Ist-Arbeitszeit, wenn die vorangehende Schulstunde als Arbeitszeit gebucht ist und für die Pause selbst kein
  eigener Eintrag angelegt wurde. Hintergrund: Diese kurzen Pausen sind für Lehrkräfte real meist keine
  Erholungspause, sondern Wegezeit (Klassenraum wechseln o. Ä.). Legt die Lehrkraft für eine solche Pause bewusst
  einen eigenen Eintrag an (z. B. „Eigene Pause“ oder „Pausenaufsicht“), hat dieser weiterhin Vorrang. Längere
  Pausen (z. B. die „große Pause“) sind von dieser Automatik nicht betroffen und funktionieren wie bisher.
- Neuer, optionaler Block „Vorlaufzeit vor der 1. Stunde“ in der Tagesansicht (Standard 15 Minuten, in den
  Einstellungen unter „Pausen & Vorlaufzeit" anpassbar, 0 deaktiviert ihn). Er bildet ab, dass eine Lehrkraft
  bereits vor Beginn der 1. Stunde in der Schule sein muss, und zählt nach denselben Regeln automatisch zur
  Arbeitszeit, wenn die 1. Stunde als Arbeitszeit gebucht ist.
- Die betroffenen Pausen-Slots bleiben in der Tagesansicht weiterhin sichtbar (weiterhin editierbar, z. B. um sie
  doch als echte Pause zu erfassen), zeigen bei automatischer Anrechnung aber zusätzlich den Hinweis „zählt
  automatisch zur Stunde“ inkl. angerechneter Dauer.
- Die automatisch angerechneten Minuten fließen in Ist-Arbeitszeit, Tätigkeits- und Kategorieauswertung ein
  (zugerechnet zur Tätigkeit der jeweiligen Schulstunde), erzeugen aber bewusst keinen eigenen Eintrag und tauchen
  daher nicht als eigene Zeile im CSV-Export auf.

### Technisch

- `package.json`: `"version"` von `0.0.1` auf `0.0.2` erhöht.
- `src/App.jsx`:
  - neue Konstante `SHORT_PAUSE_THRESHOLD_MIN` (10 Minuten) sowie Helfer `isShortGap()`;
  - `config.leadTimeMinutes` (Standard 15) neu in `DEFAULT_CONFIG`, automatisch kompatibel mit älteren
    gespeicherten Configs durch bestehende `{ ...DEFAULT_CONFIG, ...loaded }`-Merge-Logik;
  - neue gemeinsame Komponente `PauseSlotRow` für die Darstellung aller Pausen-Slots (Pausen zwischen
    Schulstunden sowie den neuen Vorlauf-Block vor der 1. Stunde), inkl. „zählt automatisch zur Stunde“-Hinweis;
  - `TagView`: neuer Vorlauf-Block vor der 1. Stunde (Slot `pause-vor-1`), Berechnung von `autoCounts` je
    Pausen-Slot;
  - `AuswertungView`: zusätzlicher Durchlauf über `config.periods` pro Tag, um kurze Pausen und Vorlaufzeit ohne
    eigenen Eintrag automatisch zu `actual`/`byActivity`/`byCategory` zu addieren;
  - `EinstellungenView`: neue Sektion „Pausen & Vorlaufzeit“ mit Eingabefeld für `config.leadTimeMinutes`.

### Dokumentation

- `AI_CONTEXT.md`: neuer Abschnitt zur automatischen Anrechnung kurzer Pausen und der Vorlaufzeit (Abschnitt 6),
  `config`-Datenmodell (Abschnitt 9) und Auswertungs-Abschnitt (11) ergänzt, „Bekannte Besonderheiten“ erweitert.
- `ARCHITECTURE.md`: `config`-Schema, Eintragsarten (neuer Abschnitt „Vorlaufzeit vor der 1. Stunde“),
  Zeitberechnung (neuer Abschnitt „Automatische Anrechnung kurzer Pausen“), Auswertungs-Datenfluss, CSV-Export und
  Komponentenübersicht (`PauseSlotRow`) aktualisiert.

## 2026-09-08 (2)

### Funktionalität

- Neue Testphase-Kennzeichnung: Die Einstellungen zeigen jetzt unter „Info" die aktuelle App-Version an (z. B.
  „Pensum 0.0.1"), sowie einen kurzen Hinweis, dass es sich um eine Testversion handelt. Gedacht für die
  Weitergabe an ausgewählte Lehrkräfte zum Testen.
- Der JSON-Export enthält zusätzlich das Feld `appVersion` (Version zum Exportzeitpunkt) als Grundlage für eine
  spätere Migration (Gerätewechsel, mögliche „Vollversion"). Der Import bleibt vollständig kompatibel zu älteren
  Sicherungen ohne dieses Feld.

### Technisch

- `package.json`: `"version"` von `1.0.0` auf `0.0.1` gesetzt (Start der Testphase-Zählung).
- `vite.config.js`: neues `define` stellt `__APP_VERSION__` aus `process.env.npm_package_version` bereit (keine
  neue Abhängigkeit).
- `src/App.jsx`: neue Konstante `APP_VERSION` (mit Fallback `"0.0.0"`), Anzeige in `EinstellungenView`, sowie
  `appVersion` im JSON-Export.

### Dokumentation

- `AI_INSTRUCTIONS.md`: dauerhafte Regel ergänzt, bei relevanten Änderungen die Version hochzuzählen und
  Export/Import kompatibel zu halten.
- `AI_CONTEXT.md` und `ARCHITECTURE.md`: neuen Abschnitt zur Testphase, zur Versionsanzeige und zum erweiterten
  Export-Format (`appVersion`) ergänzt.

## 2026-09-08

### Funktionalität

- Die Auswertung zeigt jetzt zusätzlich zur bestehenden Tätigkeits-Balkenliste ein Ringdiagramm („Aufteilung nach
  Kategorie“) sowie einen Tagesverlauf („Verlauf: Ist vs. Soll“) für den gewählten Zeitraum. Tätigkeiten sind dafür
  fest sieben Kategorien zugeordnet (Unterricht, Vor-/Nachbereitung, Kommunikation/Gremien, Aufsicht,
  Verwaltung/Organisation, Fortbildung, Sonstiges); nicht zugeordnete bzw. benutzerdefinierte Tätigkeiten fallen
  unter „Sonstiges“. Der Verlauf zeigt Ist (Balken) und Soll (gestrichelte Linie) je Kalendertag im Zeitraum und
  wird bei Modus „Tag“ ausgeblendet.
- Soll-Arbeitszeit, anrechenbare Abwesenheit und Bilanz werden jetzt erst ab dem Datum des allerersten jemals
  erfassten Eintrags berechnet (`firstEntryDate()`), auch wenn der gewählte Auswertungszeitraum weiter zurückreicht.
  Damit erzeugt ein späterer Einstieg in die App keine rückwirkend unerreichbare Soll-Bilanz. Ein Hinweistext in der
  Auswertung macht darauf aufmerksam, wenn dies den angezeigten Zeitraum tatsächlich betrifft.

### Technisch

- Neue Komponenten `CategoryDonut` und `TrendChart` in `src/App.jsx`, beide als reines SVG/CSS ohne zusätzliche
  Chart-Bibliothek umgesetzt (keine neue Abhängigkeit in `package.json`).
- Neue Helfer in `src/App.jsx`: `categoryOf()`, `firstEntryDate()`, sowie die Konstanten `CATEGORY_META` und
  `ACTIVITY_TO_CATEGORY`.
- Keine Änderung an `localStorage`-Datenstrukturen; JSON-Export/-Import und CSV-Export bleiben unverändert.

### Dokumentation

- `AI_CONTEXT.md` und `ARCHITECTURE.md` um die neuen Diagramme, die Kategorie-Zuordnung und die „erster Eintrag“-
  Startgrenze der Soll-/Bilanzberechnung ergänzt.

## 2026-09-04 (2)

### Fix

- `color-scheme` (Meta-Tag in `index.html` + CSS-Regel je nach `dark`-Klasse) ergänzt. Ohne dieses Signal haben
  manche Browser die Seite trotz ausgewähltem „Hell"-Modus per eigener automatischer „Force Dark"-Funktion
  abgedunkelt, wobei native Formularelemente (`<input type="time">` etc.) weiß und dadurch nahezu unlesbar
  blieben. Zusätzlich sorgt `color-scheme` dafür, dass native Steuerelemente und Scrollbars automatisch zum
  jeweils aktiven Modus passen.

## 2026-09-04

### Funktionalität

- Darkmode hinzugefügt. In den Einstellungen unter „Design“ ist der Anzeigemodus „Hell“, „Dunkel“ oder „System“
  wählbar. Bei „System“ folgt die App automatisch der Geräte-Einstellung (`prefers-color-scheme`) und reagiert
  auch zur Laufzeit auf deren Änderung.
- Die Wahl wird lokal gespeichert (`localStorage`-Key `theme`) und bleibt über App-Neustarts erhalten.

### Technisch

- Tailwind auf klassenbasierten Darkmode umgestellt (`darkMode: "class"`). Die `dark`-Klasse wird per `useEffect`
  in `App` auf `document.documentElement` gesetzt/entfernt.
- Farbklassen in `src/App.jsx` wurden durchgängig um passende `dark:`-Varianten ergänzt (Hintergründe, Text- und
  Rahmenfarben). Die dunklen Kopf-/Fußleisten (`bg-emerald-950`) sowie reine Akzent-/Auswahl-Elemente bleiben
  unverändert, da sie in beiden Modi ausreichend Kontrast bieten.

### Dokumentation

- `AI_CONTEXT.md` und `ARCHITECTURE.md` um den Darkmode/Theme-Mechanismus ergänzt.

## 2026-09-03 (3)

### Fehlerbehebungen

- `fmtDur()` rundet jetzt vor der Formatierung auf ganze Minuten. Zuvor konnten insbesondere Soll-/Anrechnungswerte
  (z. B. bei ungerader Verteilung auf 5 Werktage oder anteiliger Krankheits-/Urlaubsanrechnung) mit
  Nachkommastellen bei den Minuten angezeigt werden.

### Funktionalität

- Krankheits-/Urlaubstage können jetzt zusätzlich zu „Ganzer Tag“ auch „Ab Uhrzeit“ (bis Tagesende) oder
  „Bis Uhrzeit“ (ab Tagesbeginn) markiert werden (`dayStatus[...].from` bzw. `.to`).
- Bei „Ganzer Tag“ bleibt das bisherige Verhalten (kein Schulstundenraster). Bei „Ab“/„Bis Uhrzeit“ bleibt das
  Raster sichtbar; nur die davon betroffenen, noch nicht erfassten Schulstunden werden als reiner Status-Hinweis
  ohne Tätigkeitsauswahl angezeigt – für sie ist keine weitere Tätigkeitsbeschreibung mehr nötig. Bereits
  vorhandene Einträge in diesem Zeitraum bleiben unverändert erhalten und editierbar.
- Die anrechenbare Abwesenheitszeit in der Auswertung wird bei „Ab“/„Bis Uhrzeit“ jetzt anteilig (statt ganztägig)
  über `dayAbsenceFraction()` berechnet, relativ zum Schulstunden-Zeitfenster (erste bis letzte konfigurierte
  Schulstunde).

### Daten

- `dayStatus`-Einträge können jetzt zusätzlich `from` bzw. `to` (`"HH:MM"`) enthalten. Bestehende Einträge ohne
  diese Felder gelten weiterhin als ganztägig – vollständig abwärtskompatibel.

### Dokumentation

- `AI_CONTEXT.md` und `ARCHITECTURE.md` um das erweiterte `dayStatus`-Datenmodell (`from`/`to`), die neue
  Perioden-Abdeckungslogik in der Tagesansicht und die anteilige Anrechnungsberechnung ergänzt.

## 2026-09-03 (2)

### Funktionalität

- Neuer Tages-Status in der Tagesansicht: `Arbeit` / `Krank` / `Urlaub`. An Tagen mit Status „Krank“ oder „Urlaub“
  wird kein Schulstundenraster mehr angezeigt (wie an Ferientagen); freie Einträge bleiben weiterhin möglich.
- Neues Arbeitszeitmodell in den Einstellungen: Beschäftigungsumfang (%), Vollzeit-Wochenreferenz (Standard 46:38 h)
  sowie optionale individuelle Wochen-Sollzeit als Override.
- Die Auswertung zeigt jetzt zusätzlich zur tatsächlich gearbeiteten Zeit (Ist) auch Soll-Arbeitszeit, anrechenbare
  Abwesenheitszeit (Krankheit/Urlaub) und die daraus resultierende Bilanz (`Ist + Anrechnung − Soll`) an. Das
  Tages-Soll wird proportional zur Anzahl geplanter Schulstunden je Wochentag aus der aktiven Stundenplan-Vorlage
  verteilt; ohne passende Vorlage gleichmäßig auf 5 Werktage.

### Daten

- Neuer `localStorage`-Schlüssel `dayStatus` (Tages-Status je Datum). Additiv, betrifft bestehende Daten nicht.
- `config` besitzt ein neues, additives Feld `employment` (Arbeitszeitmodell). Ältere gespeicherte Configs werden
  beim Laden automatisch mit Standardwerten ergänzt und bleiben dadurch kompatibel.
- JSON-Export/-Import sowie „Alle Daten zurücksetzen“ berücksichtigen `dayStatus` mit.

### Nicht enthalten (bewusst zurückgestellt)

- Weitere Abwesenheitsarten (`HOLIDAY`, `SCHOOL_BREAK`, `OTHER_ABSENCE`), Ferien-/Feiertags-Anrechnung auf das Soll,
  Jahresarbeitszeit-Betrachtung, mehrere auswählbare Bundesland-Arbeitszeitmodelle sowie die getrennte
  Durchschnittsanzeige (nur Ist vs. inkl. Abwesenheiten).

### Dokumentation

- `AI_CONTEXT.md` und `ARCHITECTURE.md` um das neue Datenmodell (`dayStatus`, `config.employment`) und die neue
  Soll-/Anrechnungslogik ergänzt.

## 2026-09-03

### Dokumentation

- `AI_INSTRUCTIONS.md` hinzugefügt: verbindliche Arbeitsregeln für KI-Systeme.
- `AI_CONTEXT.md` hinzugefügt: aktueller Projekt- und Funktionskontext.
- `ARCHITECTURE.md` hinzugefügt: technische Architektur, Datenfluss und Datenmodell.
- `CHANGELOG.md` hinzugefügt: zentrale Änderungshistorie für zukünftige KI-Sitzungen.

### Funktionalität

- Keine funktionalen Änderungen an der Anwendung.
