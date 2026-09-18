# Drive-Abgleich: Neue Unterordner automatisch anlegen

## Ziel

Beim Abgleich eines Drive-Ordners („Diesen Ordner abgleichen" / „Ordner aus Drive aktualisieren" / „Alles abgleichen") werden Unterordner, die in Google Drive neu dazugekommen sind, automatisch in der App angelegt — inklusive ihres gesamten Inhalts (Dateien und weitere verschachtelte Unterordner). Bisher werden nur neue Dateien direkt in bereits verknüpften Ordnern übernommen.

## Änderungen

### 1. `src/lib/drive.functions.ts` — `syncDriveItems`

In der bestehenden Ordner-Schleife („Neue Dateien in verknüpften Drive-Ordnern einsammeln"):

- Bei `listAllChildren` eines verknüpften Ordners zusätzlich die **Unterordner** betrachten (bisher: `children.filter(c => !c.isFolder)`).
- Für jeden Unterordner prüfen, ob lokal schon ein nicht gelöschter Ordner mit diesem `external_id` existiert (`source: "gdrive"`).
- Falls nicht: lokalen Ordner anlegen (`parent_id` = lokaler Elternordner, `name` = Drive-Name, `source: "gdrive"`, `external_id` = Drive-ID) und **rekursiv** dessen Drive-Inhalt importieren — gleiche Logik wie beim manuellen Import (`importDriveItems`): Dateien mit `GOOGLE_EXPORTS`-Mapping, `storage_path: ""`, `drive_state: "new"`, weitere Unterordner rekursiv. Doppel-Import (Unique-Index, Code 23505) bleibt unkritisch.
- Hilfsfunktion `importFolderRecursive(driveFolderId, driveName, localParent)` im Sync-Handler ergänzen (analog zum `importFolder` im Import-Handler, ohne separaten Zähler-Duplikat-Code wo vermeidbar).

### 2. Rückgabe & Toast

- Rückgabe von `syncDriveItems` um `addedFolders: number` (neu angelegte Ordner, inkl. verschachtelter) erweitern.
- `src/routes/_authenticated/library.tsx` — `driveSync.onSuccess`: Toast-Meldung um „X Ordner neu" ergänzen (nur anzeigen, wenn > 0).

## Bewusst unverändert

- Einzelabgleich eines Dokuments/Ordners ohne Drive-Verknüpfung: bleibt ohne Wirkung („alles aktuell") — gewollt.
- Kein automatisches Löschen: in Drive gelöschte Inhalte werden weiterhin nur markiert („nicht mehr gefunden").
- „Alles abgleichen" erfasst automatisch mit, da es denselben Ordner-Codepfad nutzt.

## Verifikation

- `bunx tsgo --noEmit`
- HTTP-Check `/library` (200)
- Playwright: Library öffnen, Sync-Knopf sichtbar, kein Konsolenfehler (funktionaler Test mit echtem Drive-Inhalt erfolgt durch den Nutzer).
