# Dauerhafter Zoom für den Stundenplan

## Umsetzung
- Die eingebettete Stundenplan-PDF erhält gut erreichbare Plus-/Minus-Schaltflächen, eine Prozentanzeige und „Breite anpassen“.
- Zoomen funktioniert zusätzlich mit Mausrad beziehungsweise Trackpad-Pinch direkt über der PDF und bleibt am Mauszeiger ausgerichtet.
- Der zuletzt gewählte Zoom wird pro Stundenplan und Gerät gespeichert und beim nächsten Öffnen wiederhergestellt; geändert wird er erst durch die nächste Zoom-Aktion.
- Die bisherige Höhenregelung, Vollbildansicht, Upload- und Löschfunktionen bleiben unverändert.

## Technische Details
- `PdfCanvasViewer` wird um einen kontrollierbaren Zoomfaktor und horizontales Verschieben bei vergrößerten Seiten ergänzt.
- `TimetableDoc` verwaltet den Zoom, speichert ihn in `localStorage` anhand der Dokument-ID und reicht ihn an die PDF-Anzeige weiter.
- Zoomgrenzen: 50–400 Prozent; alle PDF-Seiten werden passend zur gewählten Stufe neu gerendert.
