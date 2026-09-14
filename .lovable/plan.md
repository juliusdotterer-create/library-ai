# Schnellere Reaktion beim Tippen und Klicken

Ziel: Knöpfe sollen sich sofort "gedrückt" anfühlen – ohne Verzögerung, ohne graues Aufblitzen auf dem Handy.

## Was sich ändert

1. **Sofortiges Feedback beim Drücken**
   Jeder Knopf bekommt eine minimale, sehr schnelle Reaktion (leichtes Einsinken und Farbwechsel), die beim Berühren startet – nicht erst beim Loslassen.

2. **Kein Klick-Verzug auf dem Smartphone**
   Die typische Verzögerung von rund 300 ms sowie das grau-blaue Aufblitzen beim Antippen auf iPhone/Android werden entfernt.

3. **Animationen kürzer**
   Übergänge in Listen, Karten und Dialogen werden von ca. 250 ms auf ca. 120–150 ms verkürzt, damit alles direkter wirkt. Wer im System "Bewegung reduzieren" aktiviert hat, bekommt weiterhin keine Animationen.

4. **Listen und Karten reagieren schneller**
   Das Einblenden von Elementen erfolgt ohne gestaffelte Wartezeit, damit die Seite direkt nutzbar ist.

5. **Kein Warten auf den Server bei Aktionen**
   Bei Aktionen wie Umbenennen, Favorit setzen, Löschen/Wiederherstellen wird die Ansicht sofort aktualisiert und bei einem Fehler zurückgesetzt – statt erst nach der Antwort vom Server zu aktualisieren.

## Technische Details

- `src/styles.css`: globale Regeln für `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, `user-select: none` auf interaktiven Elementen; kürzere Standard-Transition-Dauern.
- `src/components/ui/button.tsx`: `transition-colors` → schnelle `transition-[color,background-color,transform] duration-100` plus `active:scale-[0.97]`.
- `src/components/MotionItem.tsx`: Dauer auf 0.14 s, `whileTap` bleibt, Staffel-Delays entfallen bzw. werden gekappt.
- Weitere Tap-Ziele (Navigation unten, Listeneinträge in Library/Links/Lehrpläne, Toolbar-Knöpfe) erhalten dieselbe `active:`-Rückmeldung.
- React-Query-Mutationen in Library, Links, Lehrpläne und Papierkorb erhalten `onMutate`-Optimistic-Updates mit Rollback in `onError`.
