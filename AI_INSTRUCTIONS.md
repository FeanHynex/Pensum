# Pensum – Arbeitsanweisungen für KI

Diese Datei ist die verbindliche Arbeitsanweisung für KI-Systeme, die am Projekt **Pensum** arbeiten.

## 1. Vor jeder Änderung

1. Lies diese Datei vollständig.
2. Lies `AI_CONTEXT.md`.
3. Lies `ARCHITECTURE.md`.
4. Prüfe danach den tatsächlich vorhandenen Quellcode. Die Dokumentation kann veraltet sein; der Code ist im Zweifel maßgeblich.
5. Identifiziere nur die Dateien, die für die konkrete Aufgabe relevant sind.

## 2. Grundsätze

- Pensum ist eine clientseitige Web-App zur Arbeitszeiterfassung für Lehrkräfte.
- Bestehende Funktionen, Daten und Bedienabläufe dürfen durch eine Änderung nicht unbeabsichtigt verloren gehen.
- Bevorzuge kleine, nachvollziehbare Änderungen gegenüber einer unnötigen Komplettumstrukturierung.
- Führe keine groß angelegte Refaktorierung durch, wenn sie für die angeforderte Funktion nicht erforderlich ist.
- Füge keine neue Bibliothek oder technische Abhängigkeit hinzu, wenn die Aufgabe ohne sie sinnvoll lösbar ist.
- Bestehende lokale Daten müssen nach Möglichkeit kompatibel bleiben.
- Ändere Design, Texte oder Verhalten nicht nebenbei, wenn dies nicht Teil der Aufgabe ist.
- Sicherheits-, Datenschutz- und Offline-Eigenschaften des bestehenden Konzepts müssen berücksichtigt werden.
- Die Anwendung hat keinen eigenen Backend-Server und keine Benutzerkonten. Ferientermine können allerdings von einem externen öffentlichen Dienst geladen werden.

## 3. Umgang mit dem bestehenden Code

- Die zentrale React-Datei ist aktuell `src/App.jsx`. Sie enthält mehrere Ansichten, Hilfsfunktionen und UI-Komponenten.
- `src/storage.js` kapselt den Zugriff auf `localStorage`.
- Datenstrukturen in `localStorage` dürfen nicht ohne guten Grund umbenannt oder verändert werden.
- Zeitberechnungen erfolgen intern in Minuten; bestehende Helfer wie `toMin`, `fromMin` und `durationOf` sollen bei passenden Aufgaben wiederverwendet werden.
- `Eigene Pause` und `Ausgefallen` sind ausdrücklich keine Arbeitszeit.
- Stundenplan-Vorlagen sind Planung und werden erst durch einen tatsächlichen Eintrag zur erfassten Arbeitszeit.

## 4. Tests nach Änderungen

Nach einer Änderung:

1. Führe mindestens `npm run build` aus.
2. Wenn die Änderung Benutzerverhalten betrifft, prüfe zusätzlich die betroffene Funktion im Browser bzw. in einer lokalen Vorschau.
3. Prüfe besonders, dass GitHub-Pages-Pfade (`/Pensum/`) weiterhin funktionieren.
4. Prüfe bei Änderungen an Speicherung/Import/Export die Kompatibilität der bestehenden Datenstruktur.

## 5. Dokumentation aktuell halten

Nach jeder relevanten Änderung:

- `AI_CONTEXT.md` aktualisieren, wenn sich Funktionen, Verhalten oder wichtige Projektannahmen ändern.
- `ARCHITECTURE.md` aktualisieren, wenn sich Aufbau, Datenfluss, Datenmodell oder technische Abhängigkeiten ändern.
- `CHANGELOG.md` bei funktionalen, technischen oder strukturell relevanten Änderungen ergänzen.

Keine Dokumentationsänderung nur deshalb erzwingen, weil eine rein lokale oder offensichtliche Codekorrektur vorgenommen wurde.

## 6. Abschluss einer Aufgabe

Am Ende jeder Bearbeitung:

- Liste alle geänderten Dateien auf.
- Erkläre pro Datei kurz die Änderung.
- Nenne durchgeführte Tests und deren Ergebnis.
- Weise auf offene Punkte oder Risiken hin.
- Wenn die Dokumentation geändert wurde, nenne dies ausdrücklich.

## 7. Wenn eine Anforderung unklar ist

Nicht einfach Annahmen treffen, wenn mehrere Lösungen das Benutzerverhalten deutlich unterschiedlich verändern würden. Zuerst die vorhandene Implementierung analysieren und die kleinste sinnvolle Lösung wählen.

## 8. Wichtige Priorität

**Der aktuelle Code ist die technische Wahrheit.** Diese Dokumentation soll Orientierung geben, darf aber niemals als Ersatz für die Prüfung des tatsächlich vorhandenen Codes behandelt werden.
