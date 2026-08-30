# Google Drive als zusätzlicher Speicherort

Ja, das ist möglich. Jeder Nutzer verbindet sein eigenes Google-Konto; Dateien bleiben in Drive liegen und werden in der App nur geöffnet, angezeigt und durchsucht — nichts wird in den App-Speicher kopiert (außer kurzzeitig zum Anzeigen/Indexieren im Arbeitsspeicher).

## Was der Nutzer sieht

- **Einstellungen → Google Drive**: Button „Mit Google Drive verbinden". Nach der Google-Zustimmung steht dort der verbundene Account plus „Trennen".
- **Library**: neben „Hochladen" ein Eintrag „Aus Google Drive hinzufügen". Es öffnet sich ein Auswahlfenster, in dem man durch Drive-Ordner navigiert und Dateien oder ganze Ordner auswählt.
- Ausgewählte Einträge erscheinen im gewohnten Ordnerbaum, mit kleinem Drive-Symbol als Kennzeichnung. Umbenennen, Verschieben, Favoriten, Lehrplan-Verknüpfung funktionieren wie bisher.
- **Vorschau**: Klick öffnet dieselbe Vorschau wie bisher (PDF, Word, Excel, Bilder, Notizen, Annotationen). Google-eigene Formate (Docs/Sheets/Slides) werden beim Öffnen automatisch als PDF/XLSX geliefert.
- **Löschen in der App** entfernt nur die Verknüpfung, nicht die Datei in Drive — mit deutlichem Hinweistext.
- **Volltextsuche/OCR** läuft auch über Drive-PDFs: der Indexlauf lädt jede Datei kurz nach, extrahiert Text bzw. macht OCR und speichert nur den Text.

## Technische Umsetzung

1. **App User Connector `google_drive`** einrichten (`connector_app_user--connect_client`), Scopes: `userinfo.email`, `userinfo.profile`, `drive.readonly`. Der Nutzer muss dafür einen Google-OAuth-Web-Client in der Google Cloud Console anlegen; Redirect-URI ist der Lovable-Gateway-Callback. Diesen Schritt begleite ich per Formular.
2. **Verbindungsspeicher**: Tabelle `app_user_connections` (user_id, connector_id, verschlüsselter Connection-Key, unique) — nur Service-Role, RLS an. Ver-/Entschlüsselung mit `APP_USER_CONNECTION_KEY_SECRET`.
3. **Schema-Erweiterung `documents`**: neue Spalten `source text not null default 'local'`, `external_id text` (Drive-fileId), `external_mime text`; `storage_path` bleibt für Drive-Einträge leer. Index auf `(user_id, source)`.
4. **Server-Funktionen** (`src/lib/drive.functions.ts`, mit `requireWhitelisted`):
   - `getDriveStatus` / `startDriveConnect` / `exchangeDriveCode` / `disconnectDrive`
   - `listDriveChildren(folderId)` — Drive `files?q='id' in parents`
   - `importDriveItems(items, targetFolderId)` — legt Ordner/Dokument-Zeilen rekursiv an (Ordnerimport paginiert, in Batches)
   - `getDriveFileContent(documentId)` — verifiziert Besitzer, lädt via Gateway `files/{id}?alt=media` bzw. `export` für Google-Formate und gibt die Bytes zurück (Streaming-Response).
5. **Frontend**:
   - `DrivePanel.tsx` in den Einstellungen (verbinden/trennen/Status)
   - `DrivePicker.tsx` — Drive-Baum mit Mehrfachauswahl, im vorhandenen Import-Dialog integriert
   - `DocumentPreview.tsx`: statt Signed URL bei `source = 'gdrive'` einen Blob über die Server-Funktion holen und als Object-URL an die bestehenden Viewer geben — Viewer selbst bleiben unverändert
   - `index-runner.ts` / OCR: gleiche Blob-Quelle nutzen, damit Drive-PDFs indexiert werden
   - kleines Drive-Badge in Library-Liste und Suchtreffern; Löschdialog mit Hinweis „bleibt in Google Drive"

## Nicht enthalten

- Kein Schreiben/Hochladen nach Drive und kein Umbenennen in Drive (nur Lesen).
- Bestehende Dateien werden nicht nach Drive migriert; der bisherige Speicher bleibt unverändert.
- Kein automatischer Abgleich, wenn Dateien in Drive gelöscht/verschoben werden — solche Einträge zeigen beim Öffnen eine klare Fehlermeldung.
