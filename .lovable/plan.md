# Google Drive mit bestehenden Ordnern abgleichen

## Ausgangslage (geprüft)

In der Library ist derzeit **kein einziges** Element aus Google Drive gespeichert — weder Ordner noch Dokumente. Der bisherige Abgleich arbeitet nur mit Ordnern, die zuvor über „Aus Google Drive hinzufügen" angelegt wurden. Deine 2.976 Ordner und 8.502 Dokumente sind alle lokal, kennen also keine Drive-Verknüpfung — deshalb findet der Abgleich nichts und fügt auch nichts hinzu.

## Was neu funktioniert

Ein neuer Ablauf **„Mit Google Drive spiegeln"**:

1. Du wählst einmal einen Drive-Ordner und den passenden Ordner in der Library (z. B. Drive „Gehobener Dienst" ↔ Library „Gehobener Dienst").
2. Die App geht den Drive-Baum durch und vergleicht **anhand der Namen**:
   - Ordner mit gleichem Namen wird als derselbe erkannt und ab jetzt dauerhaft verknüpft.
   - Fehlender Ordner wird in der Library angelegt.
   - Dokument mit gleichem Namen bleibt unangetastet.
   - Fehlendes Dokument wird als Drive-Dokument ergänzt (ohne Kopie, direkt aus Drive geladen).
3. Nichts wird gelöscht, nichts umbenannt, nichts überschrieben.
4. Danach genügt der Pfeil-Knopf: Der normale Abgleich erfasst jetzt auch die so verknüpften, ursprünglich lokalen Ordner.

Während des Durchlaufs siehst du einen Fortschritt („Ordner 34 von 180 …") und am Ende eine Bilanz: verknüpft / neue Ordner / neue Dokumente / übersprungen. Große Bäume werden in Etappen abgearbeitet, damit nichts abbricht — der Lauf ist jederzeit abbrechbar und beim nächsten Start wieder fortsetzbar (bereits Verknüpftes wird erkannt).

## Technische Umsetzung

**Verknüpfung ohne Datenmigration**
- Verknüpfte lokale Ordner erhalten nur `external_id` (Drive-ID); `source` bleibt `local`, damit eigene Uploads darin unberührt bleiben.
- Alle Drive-Abfragen in `src/lib/drive.functions.ts` (`syncDriveItems`, Ordner-Scope) wechseln von `source = 'gdrive'` auf `external_id is not null` für Ordner. Dokument-Logik bleibt unverändert (`source = 'gdrive'`).
- Der bestehende Unique-Index `folders_drive_unique` greift nur bei `source = 'gdrive'`; deshalb zusätzlich Schutz im Code: vor dem Setzen von `external_id` prüfen, ob die Drive-ID lokal schon vergeben ist.

**Neue Server Function `mirrorDriveFolder`** (`src/lib/drive.functions.ts`, Muster wie bisher: `createServerFn` + `requireWhitelisted`)
- Eingabe: `{ queue: { driveFolderId, localFolderId }[] }` (Start: ein Paar).
- Arbeitet mit Zeitbudget (~20 s) durch die Warteschlange; pro Drive-Ordner:
  - `listAllChildren` holen,
  - Unterordner: lokalen Ordner mit normalisiertem Namen (Kleinschreibung, Umlaute, Leerzeichen) unter demselben Elternordner suchen → vorhanden: `external_id` setzen (falls leer) und in die Warteschlange legen; fehlt: Ordner anlegen (`source 'gdrive'`, `external_id`) und einreihen,
  - Dateien: nach normalisiertem Namen im Zielordner vergleichen (inkl. Google-Export-Endungen `.pdf`/`.xlsx`/`.pptx`); fehlt: Dokument mit `storage_path ""`, `source 'gdrive'`, `external_id`, `external_mime`, `external_modified`, `drive_state 'new'` anlegen.
- Rückgabe: `{ queue, linkedFolders, addedFolders, addedDocs, skippedDocs, done }`; der Client ruft solange nach, bis `done`.

**UI**
- `src/components/DrivePanel.tsx` (Einstellungen → Google Drive): Abschnitt „Ordner spiegeln" mit Drive-Ordner-Auswahl (bestehender `DrivePicker`, Ordnerauswahl) + Library-Ordner-Auswahl (bestehender Ordner-Picker aus `src/components/lehrplan/DocumentPicker.tsx`-Muster), Start-Knopf, Fortschrittsbalken, Abbrechen, Ergebnis-Zusammenfassung.
- `src/routes/_authenticated/library.tsx`: nach Abschluss Ordner-/Dokumentlisten neu laden (`invalidateQueries`).

**Robustheit**
- Namensvergleich nur innerhalb desselben Ordners, keine globale Zuordnung.
- Doppelte Drive-IDs (Fehler 23505) werden toleriert und als „bereits verknüpft" gezählt.
- Fehler bei einem einzelnen Drive-Ordner beenden den Lauf nicht; er wird gezählt und am Ende gemeldet.

## Nicht Teil dieses Schritts
Automatischer Abgleich im Hintergrund, Löschen lokaler Dateien, Rückschreiben nach Google Drive, Zusammenführen unterschiedlich benannter Ordner.
