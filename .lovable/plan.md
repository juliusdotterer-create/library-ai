# Google Drive anbinden + manueller Abgleich per Knopf

Die Drive-Anbindung ist bisher nur geplant, noch nicht gebaut. Dieser Plan umfasst die Grundanbindung (lesend) plus den gewünschten manuellen Abgleich: Änderungen werden markiert, nichts wird automatisch gelöscht.

## Was du später siehst

- **Einstellungen → Google Drive**: „Mit Google Drive verbinden". Nach der Google-Zustimmung steht dort dein verbundenes Konto plus „Trennen".
- **Library**: neben „Hochladen" der Eintrag „Aus Google Drive hinzufügen". Ein Auswahlfenster lässt dich durch Drive-Ordner navigieren und Dateien oder ganze Ordner auswählen.
- Ausgewählte Einträge erscheinen im gewohnten Ordnerbaum mit kleinem Drive-Symbol. Umbenennen, Verschieben, Favoriten und Lehrplan-Verknüpfung funktionieren wie bisher.
- **Vorschau**: Klick öffnet dieselbe Vorschau wie bisher (PDF, Word, Excel, Bilder). Google-Docs/Sheets/Slides werden beim Öffnen automatisch als PDF/XLSX geliefert.
- **„Aktualisieren"-Knopf** in der Library (nur sichtbar, wenn Drive verbunden ist): gleicht alle verknüpften Drive-Einträge mit Google Drive ab und zeigt das Ergebnis:
  - **Neue Dateien** in verknüpften Ordnern (auch von Dritten hinzugefügt) erscheinen automatisch im Baum — mit „Neu"-Kennzeichen.
  - **Geänderte Dateien** (in Drive überarbeitet) bekommen eine „Aktualisiert"-Markierung, bis sie einmal geöffnet wurden. Volltext-Index wird für sie neu aufgebaut.
  - **In Drive gelöschte/verschobene Dateien** bleiben in der App erhalten, bekommen aber eine „In Drive nicht mehr gefunden"-Markierung. Beim Öffnen erscheint ein klarer Hinweis; löschen musst du sie selbst.
- **Löschen in der App** entfernt nur die Verknüpfung, nie die Datei in Drive — mit Hinweistext.
- **Volltextsuche/OCR** läuft auch über Drive-PDFs.

## Technische Umsetzung

1. **App User Connector `google_drive`** einrichten (`connector_app_user--connect_client`), Scopes: `userinfo.email`, `userinfo.profile`, `drive.readonly`. Du legst dafür einen Google-OAuth-Client in der Google Cloud Console an (Redirect-URI: Lovable-Gateway-Callback) — ich begleite das per Formular.
2. **Verbindungsspeicher**: Tabelle `app_user_connections` (user_id, connector_id, verschlüsselter Connection-Key) — nur Service-Role, RLS an, Ver-/Entschlüsselung mit `APP_USER_CONNECTION_KEY_SECRET`.
3. **Schema `documents`**: neue Spalten `source text default 'local'`, `external_id text` (Drive-fileId), `external_mime text`, `external_modified timestamptz` (letzter Drive-Änderungsstand), `drive_state text default 'ok'` (`ok` | `changed` | `missing`). Index auf `(user_id, source)`.
4. **Server-Funktionen** (`src/lib/drive.functions.ts`, mit Whitelist-Schutz):
   - `getDriveStatus` / `startDriveConnect` / `exchangeDriveCode` / `disconnectDrive`
   - `listDriveChildren(folderId)`
   - `importDriveItems(items, targetFolderId)` — rekursiv, in Batches; merkt sich `external_id` und `external_modified`
   - `syncDriveItems()` — der Abgleich hinter dem Aktualisieren-Knopf: listet für jede verknüpfte Datei den Drive-Stand (`files.get`, Felder `id, name, modifiedTime, trashed, parents`), vergleicht `modifiedTime`, setzt `drive_state`, legt neue Dateien in verknüpften Ordnern an. Begrenzt pro Lauf (Batch-Größe), Fehler einzelner Dateien brechen den Lauf nicht ab.
   - `getDriveFileContent(documentId)` — Besitzer prüfen, via Gateway laden (`files/{id}?alt=media` bzw. `export` für Google-Formate), Bytes als Response zurück. Setzt `drive_state` beim Öffnen auf `ok` zurück.
5. **Frontend**:
   - `DrivePanel.tsx` in den Einstellungen (verbinden/trennen/Status)
   - `DrivePicker.tsx` — Drive-Baum mit Mehrfachauswahl im Import-Dialog
   - `DocumentPreview.tsx`: bei `source = 'gdrive'` Blob über die Server-Funktion holen und als Object-URL an die bestehenden Viewer geben
   - `index-runner.ts` / Upload-Indexierung: gleiche Blob-Quelle, damit Drive-PDFs indexiert werden
   - Aktualisieren-Knopf mit Ergebnis-Zusammenfassung („3 neu, 1 aktualisiert, 1 nicht gefunden"); Badges für „Neu" / „Aktualisiert" / „Nicht gefunden" in der Liste; Löschdialog mit Hinweis „bleibt in Google Drive"

## Nicht enthalten

- Kein Schreiben nach Drive (nur Lesen), keine Migration bestehender Dateien nach Drive.
- Kein automatischer/zeitgesteuerter Abgleich — er erfolgt nur auf Knopfdruck.
- Kein automatisches Entfernen von in Drive gelöschten Dateien.
