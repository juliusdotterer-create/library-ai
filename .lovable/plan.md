# Verbesserungsideen – Vergleich mit ähnlichen Produkten

Deine App vereint heute: Library (Ordner/Dateien, Upload, Papierkorb), PDF-Viewer mit Annotation und Apple-Pencil-Support, freie Notizen, Kalender + Stundenplan (inkl. KI-Import), Lehrpläne mit Timer, Linktree, Profil/Whitelist/Transfer.

Verglichen mit Google Drive/Dropbox (Ablage), GoodNotes/Notability (Annotation), Notion/Obsidian (Wissen), Anki/RemNote (Wiederholung) fehlen vor allem drei Dinge: **Wiederfinden**, **Wiederholen**, **Fortschritt sehen**.

## Vorschläge, nach Nutzen sortiert

### 1. Volltextsuche in PDFs statt nur Dateinamen
Heute sucht die Library nur über Namen. Beim Upload den Text jeder PDF extrahieren und durchsuchbar ablegen, Treffer mit Seitenzahl und Sprungmarke im Viewer. Das ist der größte Alltagsgewinn bei vielen hundert Dokumenten (Drive/Dropbox-Standard).

### 2. Lernkarten & Wiederholung (Anki/RemNote-Prinzip)
Aus markierten Stellen im PDF oder aus Notizen direkt Karten erzeugen; ein einfacher Wiederholungs-Algorithmus (SM-2/FSRS-light) legt fällige Karten in den Tagesplan. Verbindet Library, Notizen und Lehrplan zu einem Kreislauf statt drei getrennten Bereichen.

### 3. Fortschritt & Statistik
Dashboard auf der Startseite: gelernte Minuten pro Woche (Timer-Daten liegen schon vor), erledigte vs. offene Lehrplan-Aufgaben, Streak, Dokumente pro Ordner. Motivation und Planungsgrundlage.

### 4. Favoriten, Zuletzt geöffnet, Tags
Schnellzugriff oben in der Library: die letzten 10 Dokumente, angeheftete Ordner, freie Schlagworte quer über Ordnergrenzen (z. B. „Klausur", „Lösung", „ESt").

### 5. Markierungen und Notizen zentral sammeln
Eine Ansicht „Alle Highlights", gruppiert nach Dokument, exportierbar als PDF – so wird aus Annotationen eine Lernzusammenfassung.

### 6. KI-Assistent auf Dokumenten
Die Gemini-Anbindung existiert schon für den Stundenplan-Import. Erweiterbar auf: Zusammenfassung eines PDFs, Fragen zum Dokument, automatischer Lehrplan-Vorschlag aus einem Ordner („verteile diese 12 PDFs auf 3 Wochen").

### 7. Offline / PWA
Manifest ist vorhanden; mit Service Worker und lokalem Cache der zuletzt geöffneten Dokumente wird die App unterwegs (Bahn, Bibliothek) nutzbar.

### 8. Kleinere Politur
- Stundenplan-Tagesspalte: Raum hinter der Uhrzeit anzeigen (offener Punkt aus dem letzten Umbau).
- Kalender und Lehrplan verzahnen: geplante Lerneinheiten als Termine im Kalender sichtbar.
- Papierkorb mit automatischer Löschfrist (z. B. 30 Tage).
- Tastenkürzel für Suche (Cmd+K) und Notizen.

## Technische Hinweise
- Volltextsuche: Extraktion mit pdfjs beim Upload, Ablage in neuer Tabelle `document_text` (user-scoped, RLS + GRANTs), Suche über Postgres `tsvector`/`websearch_to_tsquery` in einer Server Function.
- Lernkarten: Tabellen `flashcards` und `flashcard_reviews`, Fälligkeitsberechnung serverseitig; UI als eigene Rubrik neben Lehrpläne.
- Statistik: Aggregation per Server Function über bestehende Timer-/Task-Tabellen, Darstellung mit Recharts.
- Alles läuft über bestehende Muster: `createServerFn` + `requireWhitelisted`, Hooks in `useLibrary.ts`.

## Vorschlag für den Start
Reihenfolge 1 → 3 → 4 (größter Nutzen, kein neues Bedienkonzept), danach 2 und 6 als eigener Lern-Modus.
