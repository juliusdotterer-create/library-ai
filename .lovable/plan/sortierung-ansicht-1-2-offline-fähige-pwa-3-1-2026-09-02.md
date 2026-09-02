# Sortierung & Ansicht (1.2) + Offline-fähige PWA (3.1)

## 1. Sortierung & Ansichtsumschalter in der Library

In der Library-Kopfzeile kommt eine kompakte Leiste dazu:

- **Sortierung**: Name (A–Z / Z–A), Datum (neueste / älteste), Typ (Ordner zuerst bleibt immer erhalten).
- **Ansicht**: Kachelansicht (wie bisher) oder kompakte Listenansicht mit Name, Datum und den gleichen Aktionen (Umbenennen, Löschen, Favorit).
- Beide Einstellungen werden lokal pro Gerät gemerkt und beim nächsten Besuch wiederhergestellt.
- Die Sortierung gilt getrennt für Ordner und Dateien, sodass Ordner weiterhin oben stehen.
- Favoriten-Bereich und Suche bleiben unverändert.

## 2. Offline-Nutzung (PWA)

- Service Worker, der die App-Hülle (HTML, JS, CSS, Icons) zwischenspeichert, damit die App auch ohne Netz startet.
- Netzwerk-zuerst-Strategie für Daten, Cache-zuerst für statische Dateien; alter Cache wird bei einer neuen Version automatisch aufgeräumt.
- Zuletzt geöffnete Dokumente aus dem Speicher werden im Cache gehalten und lassen sich offline erneut öffnen.
- Kleiner Offline-Hinweis in der Kopfleiste, sobald keine Verbindung besteht.
- Hinweis-Toast „Neue Version verfügbar – neu laden", wenn ein Update bereitsteht.
- Das vorhandene `manifest.webmanifest` wird geprüft und ergänzt (Name, Farben, Icons), damit die App auf iOS/Android als App installierbar ist.

Wichtig: Schreibvorgänge (Upload, Termin anlegen, Notizen) funktionieren offline weiterhin nicht – dafür wäre eine Sync-Warteschlange nötig, die kein Teil dieses Schritts ist.

## Technische Details

- `src/routes/_authenticated/library.tsx`: Sortier-/Ansichts-State inkl. `localStorage`-Persistenz, Sortierfunktion vor dem Rendern, neue Listendarstellung als Unterkomponente.
- Neue Datei `public/sw.js` plus Registrierung in `src/routes/__root.tsx` (nur im Browser, nach Hydration). Alternativ ein Vite-PWA-Plugin, falls die Precache-Liste aus dem Build gebraucht wird.
- Offline-Status über `navigator.onLine` und `online`/`offline`-Events in einem kleinen Hook, angezeigt in `AppShell.tsx`.
- Keine Datenbankänderung nötig.
