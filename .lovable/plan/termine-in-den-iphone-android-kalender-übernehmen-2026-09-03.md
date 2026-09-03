# Termine in den iPhone-/Android-Kalender übernehmen

Ja, das ist möglich. Der Standardweg ist eine `.ics`-Datei (iCalendar): iOS und Android
öffnen sie automatisch mit der Kalender-App und fragen, in welchen Kalender der Termin
gespeichert werden soll. Dafür ist keine Google-/Apple-Anmeldung nötig.

## Was gebaut wird

1. **Einzelner Termin exportieren**
   Neben jedem Termin in der Tagesliste erscheint ein kleines Export-Symbol.
   Tippen erzeugt eine `.ics`-Datei mit Titel, Notiz, Start-/Endzeit (bzw. ganztägig)
   und öffnet den Systemdialog "Zum Kalender hinzufügen".

2. **Alle Termine des angezeigten Monats exportieren**
   Ein Button "In Kalender exportieren" in der Kopfzeile der Kalenderseite lädt alle
   Termine des aktuell sichtbaren Monats als eine `.ics`-Datei.

3. **Verhalten auf dem Handy**
   Auf iOS/Android wird die Datei per Web-Share bzw. Download geöffnet, sodass direkt
   die Kalender-App den Import anbietet. Am Desktop wird die Datei einfach heruntergeladen.

## Grenzen

- Es ist eine einmalige Kopie, keine laufende Synchronisation: Änderungen in der App
  landen nicht automatisch im Handykalender (der Termin muss erneut exportiert werden).
- Eine echte Live-Synchronisation wäre ein Abo-Link (Kalender-Feed) und ein größerer
  eigener Schritt – auf Wunsch später umsetzbar.

## Technische Umsetzung

- Neue Datei `src/lib/ics.ts`: baut RFC-5545-konforme `.ics`-Inhalte
  (`VCALENDAR`/`VEVENT`, UTC-Zeitstempel bzw. `VALUE=DATE` für ganztägige Termine,
  Zeilenumbruch-Escaping, stabile `UID` aus der Event-ID) und stellt
  `downloadIcs(filename, content)` bereit (Blob + `navigator.share` mit Datei, sonst
  Download-Link).
- `src/routes/_authenticated/kalender.tsx`: Export-Icon pro Termin in der Tagesliste
  und Monats-Export-Button in der Kopfleiste; nutzt die bereits geladenen
  `useEvents`-Daten, keine neuen Serveraufrufe und keine Datenbankänderung.
- Bestehende Funktionen (Anlegen, Löschen, Stundenplan-Tab) bleiben unverändert.
