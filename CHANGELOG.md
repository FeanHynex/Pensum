# Pensum – Changelog

Alle Einträge beziehen sich auf den Stand des GitHub-Projekts. Die Datei soll bei relevanten zukünftigen Änderungen durch die bearbeitende KI ergänzt werden.

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
