# Online-Suche in „Library durchsuchen"

## Was du bekommst
- Im Suchfenster erscheint unter den Treffern ein Eintrag **„Im Internet suchen"** (nur wenn etwas eingegeben ist).
- Erst ein Tipp darauf startet die Online-Suche. Normale Suchen bleiben schnell und kosten nichts.
- Das Ergebnis ist eine **kurze KI-Antwort auf Deutsch** mit nummerierten **Quellen-Links**. Ein Tipp auf einen Link öffnet die Webseite in einem neuen Tab.
- Die Antwort stützt sich nur auf die gefundenen Webseiten. Gibt es keine passenden Seiten, steht das dort.
- Ein kleiner Hinweis zeigt, dass die Antwort aus dem Internet kommt und nicht aus deinen Dokumenten.

## Voraussetzung
- Für die Websuche brauchen wir den Dienst **Firecrawl**. Beim Umsetzen erscheint eine Karte, über die du ihn verbindest.

## Technische Details
- Firecrawl-Connector über `standard_connectors--connect` verbinden. Je nach `uses_connector_gateway` wird entweder das Gateway oder die direkte API genutzt.
- Neue Datei `src/lib/web-search.functions.ts`: `askWeb` (createServerFn POST, gleiche Whitelist-Auth-Middleware wie `askLibrary`). Sie ruft Firecrawl `/v2/search` auf (limit 5, lang de, scrapeOptions markdown) und kürzt die Inhalte. Danach erzeugt sie mit dem bestehenden AI-Gateway-Modell die Antwort im Muster „nur aus Quellen, [n] zitieren" und liefert `{ answer, sources: [{title,url}] }` zurück. Fehler 429/402 sowie Firecrawl-Fehler werden als verständliche Meldungen angezeigt.
- In `LibrarySearch.tsx` kommt ein Button „Im Internet suchen" dazu, außerdem ein Antwortbereich mit externen Links (`target=_blank rel=noopener`) und Lade-/Fehlerzustand. Die Antwort wird zurückgesetzt, sobald sich die Eingabe ändert.
- Prüfung per Playwright: angemeldet eine Frage eingeben, auf den Button tippen und Antwort samt Links kontrollieren.
