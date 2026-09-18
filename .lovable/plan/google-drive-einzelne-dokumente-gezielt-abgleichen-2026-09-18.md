# Google Drive: einzelne Dokumente gezielt abgleichen

Heute gleicht der Pfeil-Knopf immer alle verknüpften Drive-Inhalte ab. Künftig soll man auch nur ein einzelnes Dokument oder einen einzelnen Ordner aktualisieren können.

## Was du danach tun kannst

1. **Einzelnes Dokument aktualisieren** — Im Dreipunkt-Menü eines Drive-Dokuments gibt es den neuen Punkt „Aus Drive aktualisieren". Es wird nur diese Datei geprüft: neu in Drive geändert, unverändert oder in Drive nicht mehr vorhanden.
2. **Einzelnen Ordner aktualisieren** — Im Menü eines Drive-Ordners: „Ordner aus Drive aktualisieren". Prüft diesen Ordner samt Unterordnern und holt neue Dateien nur dort.
3. **Nur den aktuellen Ordner abgleichen** — Der Pfeil-Knopf oben bekommt ein kleines Menü mit zwei Möglichkeiten: „Diesen Ordner abgleichen" und „Alles abgleichen". So bleibt der komplette Abgleich erhalten, ist aber nicht mehr der einzige Weg.
4. **Rückmeldung** — Nach jedem Abgleich zeigt eine kurze Meldung, was passiert ist (z. B. „1 aktualisiert" oder „unverändert"). Gelöschte Drive-Dateien werden wie bisher nur markiert, nie automatisch entfernt.

## Technische Umsetzung

- `syncDriveItems` in `src/lib/drive.functions.ts` erhält einen optionalen `inputValidator` mit `{ documentIds?: string[]; folderIds?: string[]; recursive?: boolean }`. Ohne Angabe bleibt das heutige Verhalten (alles) unverändert.
- Die Dokument- und Ordnerabfragen werden bei gesetztem Umfang per `.in("id", …)` eingeschränkt; bei `folderIds` werden die Unterordner über die bestehende `parent_id`-Hierarchie rekursiv aufgelöst, damit neue Dateien in Unterordnern mitkommen.
- Rückgabe wie bisher `{ added, changed, missing, failed }`, damit die Toast-Meldung unverändert funktioniert.
- `ItemCard.tsx`: für Einträge mit `source === "gdrive"` ein Menüpunkt, der einen neuen Callback (`onDriveSync`) auslöst.
- `library.tsx`: Mutation nimmt jetzt Parameter (`mutationFn: (vars) => syncDriveItems({ data: vars })`), der Kopf-Knopf wird zu einem `DropdownMenu` mit „Diesen Ordner" (aktuelle `folderId`) und „Alles". Nach Erfolg werden die Library- und Drive-Status-Queries invalidiert.
- Abschluss: `bunx tsgo --noEmit` und ein Abruf von `/library`.
