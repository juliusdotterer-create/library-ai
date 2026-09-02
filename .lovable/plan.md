# Weitere Verbesserungsvorschläge

Bestandsaufnahme: Favoriten, Volltextsuche mit OCR, PDF-Annotationen, Stundenplan, Linktree und Papierkorb sind vorhanden. Multi-Select, Sortierung, Tags und Offline-Nutzung fehlen. Die drei größten Dateien (`library.tsx` 843 Zeilen, `PdfAnnotator.tsx` 779, `lehrplaene.tsx` 685) sind weiterhin monolithisch.

## Stufe 1 – größter Alltagsnutzen

### 1.1 Mehrfachauswahl & Bulk-Aktionen in der Library
Checkboxen auf Ordner-/Dateikacheln, Auswahl-Leiste unten mit: Löschen, Verschieben (Ordnerauswahl-Dialog), Favorit setzen, Download. Shift-Klick für Bereichsauswahl.

### 1.2 Sortierung & Ansicht
Umschalter für Sortierung (Name, Datum, zuletzt geöffnet) und Kachel-/Listenansicht. Auswahl pro Nutzer im lokalen Speicher merken.

### 1.3 Zuletzt geöffnet
Kleine Leiste „Zuletzt geöffnet" auf der Library-Startseite, gespeist aus einem neuen Zeitstempel-Feld beim Öffnen eines Dokuments.

### 1.4 Tags/Schlagworte
Freie Schlagworte an Dokumenten, Filter-Chips in der Library und zusätzlicher Tag-Treffer in der Suche.

## Stufe 2 – Lernen & Kalender

### 2.1 Lehrplan-Fortschritt
Fortschrittsbalken pro Plan, „erledigt"-Quote, Verschieben überfälliger Aufgaben auf heute per Klick.
Wiederholungs-Vorschläge (z. B. 1/7/30 Tage) beim Abhaken einer Aufgabe.

### 2.2 Kalender-Ausbau
Ganztägige Termine, Farbkategorien, Wochenansicht, Lehrplan-Aufgaben als eigene Ebene im Kalender einblenden.

### 2.3 Lernzeit-Statistik
Auswertung der Timer-Läufe: Minuten pro Tag/Fach, einfache Wochengrafik in den Lehrplänen.

## Stufe 3 – Robustheit & Technik

### 3.1 Offline-fähig (PWA)
Service Worker ergänzen (Manifest existiert bereits): App-Shell offline, zuletzt geöffnete Dokumente im Cache, Offline-Hinweis in der Kopfleiste.

### 3.2 Große Listen virtualisieren
Ordner mit vielen Einträgen seitenweise nachladen oder virtualisieren, damit das Rendern bei tausenden Dokumenten flüssig bleibt.

### 3.3 Komponenten aufteilen
`library.tsx`, `lehrplaene.tsx` und `PdfAnnotator.tsx` in Hooks (`useLibraryUpload`, `useLibrarySelection`, `usePdfAnnotations`) und Unterkomponenten (`FolderCard`, `DocumentCard`, `AnnotationToolbar`, `TaskList`) zerlegen.

### 3.4 Optimistische Updates & Fehlergrenzen
Umbenennen/Löschen/Favorisieren sofort in der Oberfläche zeigen und bei Fehler zurückrollen; globale Fehlergrenze pro Route statt Komplettabsturz.

## Technische Details
- Neue Migration: Spalte `last_opened_at` auf `documents`, Tabelle `document_tags` (bzw. Textarray-Spalte) inkl. GRANTs und RLS-Policies je Nutzer.
- Bulk-Aktionen laufen über gebündelte Updates in `useLibrary.ts`, kein Einzelrequest pro Datei.
- Kalender-Erweiterungen brauchen zusätzliche Spalten (`all_day`, `color`) auf `events`.
- PWA über ein Vite-Plugin oder eine schlanke eigene `sw.js`; keine Änderung an der bestehenden Datenhaltung.

## Reihenfolge
Stufe 1 zuerst (sichtbarster Nutzen), dann Stufe 2, Stufe 3 nach Bedarf.

## Offene Frage
Welche Stufe soll ich zuerst umsetzen – oder soll ich mit einem einzelnen Punkt (z. B. Mehrfachauswahl) starten?
