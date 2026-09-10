# Smartphone-Layout zentrieren und seitliches Verrutschen verhindern

## Ziel
Die App soll auf dem iPhone im Hochformat vollständig zentriert im Viewport bleiben und nicht nach links oder rechts verschoben wirken.

## Vorgehen

1. **Mobile Vorschau aktivieren**
   - Preview-Gerät auf „mobile“ stellen, damit die Änderungen direkt am richtigen Formfaktor geprüft werden können.

2. **Überlaufende Elemente identifizieren**
   - Mit dem Browser-Inspektor prüfen, welches Element die Viewport-Breite überschreitet.
   - Fokus auf:
     - `src/components/AppShell.tsx` (Header, Bottom-Nav, Hauptbereich)
     - `src/routes/__root.tsx` (Viewport-Meta, html/body)
     - Seiten mit breiten Tabellen, Code-Blöcken oder Toolbars (z. B. `connect.tsx`, `library.tsx`)

3. **Root-Layout sicher begrenzen**
   - `html`/`body` und der AppShell-Root-Wrapper auf `max-w-[100dvw]` bzw. `overflow-x-hidden`/`overflow-x-clip` prüfen.
   - Falls nötig, `min-w-0` an flex- und grid-Text-Container ergänzen, damit Inhalt schrumpfen kann.

4. **Fixed Header und Bottom-Nav für iPhone anpassen**
   - Sicherstellen, dass `position: fixed` Leisten nicht durch Notch/Home-Indicator verschoben werden.
   - Falls erforderlich, `env(safe-area-inset-left)` / `env(safe-area-inset-right)` und `padding-bottom: env(safe-area-inset-bottom)` ergänzen.

5. **Breite Inhalte absichern**
   - Karten, Code-Blöcke, Tabellen und Tab-Leisten erhalten `max-w-full` und `break-words`/`break-all`, damit sie nicht über den Rand hinausragen.

6. **Validierung**
   - Mobile Preview visuell prüfen.
   - `bunx tsgo --noEmit -p tsconfig.json` laufen lassen.
   - Playwright-Check bei iPhone-Breite, um zu bestätigen, dass kein Element über die Viewport-Breite hinausragt.
