# Akkurate Apple-Liquid-Glass-Navigation auf dem Smartphone

## Ziel
Die vorhandene untere Vier-Punkte-Navigation erhält einen einzigen klaren Glas-Auswahlkörper, der beim Seitenwechsel sichtbar von Symbol zu Symbol gleitet. Die Navigation, Reihenfolge und Funktionen bleiben unverändert.

## Umsetzung
- Die aktuelle mobile Leiste in eine stabile Vier-Spalten-Anordnung überführen, damit die Glaslinse auf jeder Smartphone-Breite exakt unter dem aktiven Symbol sitzt.
- Eine optische Glaslinse mit transparenter Tiefe, feiner Lichtkante, innerem Schatten und dezenter Brechung ergänzen; Orange bleibt die aktive Akzentfarbe.
- Die Linse mit einer kurzen, kontrollierten Federbewegung verschieben und während der Bewegung leicht strecken, ohne die Leiste oder Inhalte zu versetzen.
- Aktive und inaktive Symbole kontrastreich für Hell- und Dunkelmodus abstimmen; bestehende große Tippflächen und Safe-Area-Abstand beibehalten.
- Bei aktivierter Einstellung „Bewegung reduzieren“ auf eine ruhige, direkte Überblendung wechseln.

## Technische Details
- Vorhandene Seitenpfade bestimmen die Position der Linse; es wird kein zusätzlicher Navigationszustand eingeführt.
- Die bereits installierte Motion-Bibliothek übernimmt Position und Federbewegung.
- Glasfarben, Konturen und Schatten werden als semantische Designwerte zentral definiert, nicht als feste Farben in der Navigation.
- Die Desktop-Navigation bleibt unverändert.

## Prüfung
- Wechsel zwischen allen vier Bereichen auf einem 393 × 825 px großen Smartphone testen.
- Position, Animation, Tippflächen, Safe Area sowie Hell- und Dunkelmodus visuell prüfen.
- Sicherstellen, dass bei schneller Navigation kein Flackern oder seitliches Verrutschen entsteht.
