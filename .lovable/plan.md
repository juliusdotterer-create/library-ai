# Linktree: echte Website-Logos statt Platzhalter-Pfeil

## Was aktuell passiert

Im Preview geladen werden für beide Links Icons von DuckDuckGo:
`https://icons.duckduckgo.com/ip3/homeandco.starrezhousing.com.ico` und
`.../campus.hs-ludwigsburg.de.ico` (jeweils 48x48 geladen).

Zwei Ursachen:

1. Die erste Quelle (Clearbit-Logos) liefert für diese Hosts nichts, der Fallback greift.
2. DuckDuckGo liefert bei unbekannten Hosts **kein 404**, sondern ein generisches
   Platzhalter-Icon (der graue Pfeil). Da das Bild technisch erfolgreich lädt, feuert
   `onError` nie – die Kette bleibt beim Platzhalter stehen.

Zusätzlich sind es Subdomains (`campus.`, `homeandco.`); viele Logo-Dienste kennen nur
die Hauptdomain (`hs-ludwigsburg.de`, `starrezhousing.com`).

## Lösung

1. **Platzhalter erkennen:** Nach dem Laden prüfen, ob das Bild dem bekannten
   DuckDuckGo-Platzhalter entspricht (Maße/leeres bzw. uniformes Bild) und dann
   automatisch zur nächsten Quelle springen, statt es anzuzeigen.
2. **Quellen-Reihenfolge überarbeiten:** Clearbit (eingestellt) raus. Neue Kette pro Link:
   Google s2 (Host) → Google s2 (Hauptdomain) → DuckDuckGo (Hauptdomain) →
   direktes `/favicon.ico` der Seite.
3. **Subdomain-Fallback:** Hauptdomain aus dem Host ableiten (inkl. mehrteiliger
   Endungen wie `.co.uk`) und als zweite Chance nutzen – so bekommt
   `campus.hs-ludwigsburg.de` das Hochschul-Logo.
4. **Letzter Fallback:** Anfangsbuchstabe im Farbdesign (bereits vorhanden), nie ein
   generisches Globus-/Pfeil-Icon.

## Optional: Logo.dev

Für echte Marken-Logos in hoher Qualität (statt nur Favicons) kann der Logo.dev-Connector
angebunden werden; er liefert Logos per Domain und hat einen sauberen `fallback`-Parameter.
Sage Bescheid, dann binde ich ihn als erste Quelle ein.

## Technisch

- Nur `src/components/LinkLogo.tsx` wird angepasst (Quellenliste, `onLoad`-Prüfung auf
  Platzhalter via `naturalWidth`/Canvas-Uniformitätscheck, Hauptdomain-Ableitung).
- `src/routes/_authenticated/links.tsx` bleibt unverändert.
