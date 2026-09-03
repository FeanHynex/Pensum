# Pensum – Changelog

Alle Einträge beziehen sich auf den Stand des GitHub-Projekts. Die Datei soll bei relevanten zukünftigen Änderungen durch die bearbeitende KI ergänzt werden.

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
