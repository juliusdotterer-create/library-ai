## Stundenplan-Rubrik im Kalender

Der Kalender bekommt zwei Ansichten: "Monat" (wie bisher) und "Stundenplan" – ein Wochenraster für feste, wiederkehrende Termine wie Vorlesungen welchen man über einen zusätzlichen Button erreicht.

## Was entsteht

- Umschalter oben im Kalender: **Monat | Stundenplan**. Die Auswahl bleibt beim Wechsel der Rubrik erhalten (in der URL hinterlegt, z. B. `/kalender?view=stundenplan`).
- Wochenraster Mo–Fr (Sa/So nur sichtbar, wenn dort Einträge existieren), Zeitachse standardmäßig 07:00–20:00, dynamisch erweitert auf die tatsächlichen Zeiten.
- Ein Eintrag zeigt Titel, Uhrzeit, Raum und Dozent, eingefärbt in einer wählbaren Farbe (Standard: Akzentfarbe des Designs).
- Anlegen per Klick auf eine freie Zelle (Wochentag + Startzeit vorbelegt) oder über einen Plus-Button; Bearbeiten per Klick auf den Eintrag.
- Dialogfelder: Titel, Wochentag, Start-/Endzeit, Raum, Dozent, Farbe.
- Löschen über den bestehenden Bestätigungs-Dialog (Name eintippen), damit es zum Rest der App passt.
- Mobil: statt Raster eine kompakte Tagesliste mit Wochentag-Umschalter, damit nichts abgeschnitten wird.
- Leerer Zustand mit Hinweistext und direktem "Eintrag hinzufügen".

## Daten

Die Tabelle `timetable_entries` existiert bereits (Titel, Wochentag, Start-/Endzeit, Raum, Dozent, Farbe) mit Zugriffsschutz pro Nutzer – es sind keine Datenbank-Änderungen nötig.

## Technische Umsetzung

- Neuer Hook `useTimetable()` in `src/hooks/useLibrary.ts` (user-scoped, sortiert nach `weekday`, `start_time`), plus Query-Key `timetable`.
- Neue Komponente `src/components/TimetableGrid.tsx`: Raster, Zellklick, Eintrags-Rendering, Mobile-Variante über `use-mobile`.
- Neue Komponente `src/components/TimetableDialog.tsx`: Create/Update-Formular mit Mutations (`insert`/`update`/`delete`, jeweils mit `user_id`-Filter), Invalidierung des `timetable`-Keys.
- `src/routes/_authenticated/kalender.tsx`: Tab-Umschalter, `view`-Search-Param via `validateSearch`, bestehende Monatsansicht unverändert in den ersten Tab.
- Löschen nutzt `ConfirmDelete`; Farben kommen aus den vorhandenen Design-Tokens, keine hartkodierten Farben.

## Nicht enthalten

Import/Export von Stundenplänen (z. B. CSV/ICS) und automatisches Übertragen von Stundenplan-Einträgen in die Monatsansicht – bei Bedarf als nächster Schritt.