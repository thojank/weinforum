# Entwicklungspaket 4: Monatsauswahl und Monatsplakat

Briefing für einen Coding-Assistenten. Stand 18.11.2026. Alles, was du brauchst, steht hier oder in den genannten Dateien.

## Worum es geht

Die Weinkartei ist eine kleine Web-App für einen Weinladen. Gebaut sind Aufnehmen (Paket 1), Lesen (Paket 2) und die Prüfkarte (Paket 3). Es gibt also geprüfte Karteikarten, bei denen jede Angabe bestätigt ist. Bisher entsteht daraus nichts, was Torsten im Laden in der Hand hat.

Der Laden veranstaltet jeden ersten Donnerstag im Monat einen After-Work-Treff mit elf Weinen im Glas. Das Plakat zum Treff verspricht: „Welche Weine? Stehen jeden Monat auf unserem Monatsplakat im Laden.“ Dieses Monatsplakat gibt es noch nicht.

**Paket 4 baut die erste Ausgabe:** die Weine eines Monats auswählen und daraus ein druckfertiges Monatsplakat erzeugen.

Paket 3 ist bisher nur gegen eine nachgebildete Baserow erprobt. Falls beim Bauen Fehler der Prüfkarte gegen die echte Tabelle auffallen, melde sie, statt sie nebenbei umzubauen.

## Zuerst lesen

- `AGENTS.md`, `docs/ARCHITEKTUR.md`, `docs/DATENMODELL.md`, `docs/EINRICHTEN.md`
- `lib/weinkartei/types.ts`, `store.ts`, `baserow.ts`
- `app/weine/page.tsx`, `app/weine/[kennung]/`, `app/globals.css`
- `docs/briefings/material/` – die beiden Logo-Dateien

## Ziel

Torsten bereitet den Treff in einer Viertelstunde vor: Monat anlegen, elf geprüfte Weine antippen, Glaspreise ansehen, Plakat drucken. Kein Wert auf dem Plakat wird von Hand abgetippt.

## Grundsätze

- **Nur Geprüftes erscheint.** Auswählbar sind nur Karten mit Stand `geprueft`. Auf dem Plakat stehen nur Angaben mit Stand `bestaetigt`. Fehlt eine Angabe, bleibt die Stelle leer; nichts wird ergänzt oder umformuliert.
- **Eine Quelle.** Das Plakat liest Name, Erzeuger und Kurztext aus der Karte. Ändert Torsten die Karte, ändert sich das Plakat beim nächsten Öffnen.
- **Der Preis des Monats ist festgehalten.** Der Glaspreis wird beim Auswählen aus der Karte übernommen und in der Monatsauswahl gespeichert. Ein späterer Preiswechsel an der Karte ändert alte Monate nicht.
- **Abweichen ist erlaubt.** Die App zeigt, wenn die Mischung nicht passt oder etwas fehlt. Sie verbietet es nicht, außer wo unten ausdrücklich „gesperrt“ steht.

## Umfang

### 1. Neue Tabelle „Monatsauswahl“ in Baserow

Eine Zeile je Wein und Monat. Alle Spalten Text, wie in der Tabelle „Weine“.

| Spalte | Inhalt |
| --- | --- |
| Monat | `JJJJ-MM`, z. B. `2027-01` |
| Position | ganze Zahl ab 1; Reihenfolge auf dem Plakat |
| Kennung | Kennung der Karte, z. B. `wk-3f9a2c1b` |
| Glaspreis | Betrag in € mit Punkt, z. B. `4.50`; darf leer sein |

Dazu braucht es Angaben, die für den ganzen Monat gelten: Datum des Treffs, Überschrift, Unterzeile, Glasgröße. Ob du dafür eine zweite Tabelle „Monate“ anlegst oder es anders löst, entscheidest du; begründe es kurz. Bedingung: Torsten soll in Baserow auf einen Blick sehen, welche Weine in welchem Monat stehen.

- Keine Verknüpfungsfelder von Baserow; die Verbindung zur Karte ist die Kennung als Text. Die Regeln liegen in der App.
- Die Tabellennummer kommt aus einer neuen Umgebungsvariable (Vorschlag `BASEROW_TABLE_MONATSAUSWAHL`). Fehlt sie, laufen Aufnehmen, Lesen und Prüfkarte unverändert weiter, und die Seiten der Monatsauswahl sagen, was einzurichten ist.
- Du hast keinen Zugang zur echten Baserow. Liefere deshalb eine CSV-Vorlage zum Importieren (wie `docs/weine-vorlage.csv`) und ergänze `docs/EINRICHTEN.md` um die Schritte. Das Anlegen übernimmt Thorsten.
- Zugriff nur über die Datenschicht. Ob du `WeinStore` erweiterst oder eine zweite Schnittstelle daneben stellst, entscheidest du; die App spricht nie direkt mit Baserow.

### 2. Seite „Monate“

- Liste der angelegten Monate, neuester oben, je mit Anzahl der Weine und Datum des Treffs.
- „Neuen Monat anlegen“: schlägt den nächsten Monat ohne Auswahl vor und als Datum den ersten Donnerstag dieses Monats. Beides lässt sich ändern.
- Von der Startseite erreichbar.

### 3. Seite „Monatsauswahl“ für einen Monat

- Oben die Auswahl in Plakat-Reihenfolge, gruppiert nach Art: Schaumwein, Weiß, Rosé, Rot, danach alles Übrige.
- Darunter die geprüften Karten zum Antippen, ebenfalls nach Art gruppiert. Schon gewählte Weine sind als gewählt erkennbar.
- Reihenfolge innerhalb einer Gruppe änderbar. Am Handy ohne Ziehen bedienbar (hoch, runter).
- Je gewähltem Wein der Glaspreis, vorbelegt aus `Preis Glas` der Karte, hier änderbar. Die Änderung gilt nur für diesen Monat.
- **Mischungshinweis:** Vorgabe laut Plakat zum Treff ist ein Schaumwein, vier Weiß, ein Rosé, fünf Rot, zusammen elf. Die Seite zeigt den Stand je Gruppe („Weiß 3 von 4“). Abweichungen sind erlaubt.
- **Was fehlt:** Je Wein ein Hinweis, wenn Glaspreis oder Kurztext fehlt oder der Kurztext nicht bestätigt ist, mit Verweis auf die Prüfkarte.
- **Karte nicht mehr geprüft:** Fällt eine gewählte Karte auf `aufgenommen` zurück oder wird ausgelistet, bleibt sie in der Auswahl stehen, wird deutlich markiert und erscheint nicht auf dem Plakat.
- Angaben zum Monat bearbeiten: Datum des Treffs, Überschrift, Unterzeile, Glasgröße (freier Text, z. B. „0,1 l“; darf leer sein).

### 4. Monatsplakat

- Eigene Seite je Monat, gebaut für den Druck: A4 hoch, eine Seite. Erzeugt wird über den Druckdialog des Browsers („Als PDF sichern“ oder direkt drucken). Kein PDF-Paket, kein Dienst.
- Auf dem Bildschirm zeigt die Seite das Plakat so, wie es gedruckt wird, mit einer Schaltfläche „Drucken“, die im Druck nicht erscheint.
- Inhalt:
  - Logo
  - Überschrift und Unterzeile des Monats. Vorbelegung: „Weine des Monats“ und der Monat ausgeschrieben („Januar 2027“). Torsten kann beides ändern.
  - Datum des Treffs, falls eingetragen
  - Die Weine, gruppiert nach Art mit Gruppenüberschrift. Je Wein: Name, Jahrgang, Erzeuger, Land und Region, Rebsorten, Kurztext, Glaspreis.
  - Glasgröße einmal, falls eingetragen, in der Nähe der Preise.
  - Fuß: „Weinforum Groß-Lafferde, Bierstraße 84“
- Preise in deutscher Schreibweise mit Komma und Eurozeichen („4,50 €“).
- **Elf Weine müssen auf eine Seite passen**, auch mit langen Namen und vollen Kurztexten von 200 Zeichen. Mit weniger Weinen soll das Blatt nicht leer wirken. Wie du das löst (Schriftgrad in Stufen, zwei Spalten, Kürzen mit Auslassungszeichen), entscheidest du; abgeschnittene Wörter oder eine zweite Seite sind Fehler.
- Lesbar aus zwei Metern: Das Plakat hängt im Laden.
- **Gesperrt:** Ohne mindestens einen gültigen Wein gibt es kein Plakat; die Seite sagt, was fehlt.
- Keine Fotos auf dem Plakat. Die Etikettfotos sind Nahaufnahmen zum Lesen und taugen dafür nicht.

### 5. Erscheinungsbild des Plakats

Das Plakat ist die erste Ausgabe im Auftritt des Ladens. Verbindlich sind:

| Sache | Wert |
| --- | --- |
| Beerenrot | `#9B2D4A` |
| Blattgrün auf hellem Grund | `#7FB04F` |
| Blattgrün auf dunklem Grund | `#B9DC8F` |
| Gold (Akzent, sparsam) | `#E7B24C` |
| Creme (heller Grund) | etwa `#F6F3EC` |
| Überschriften | Bricolage Grotesque, fett |
| Fließtext, kleine Angaben | Inter |
| Logo | Outfit: „Weinforum“ 700, „GROSS-LAFFERDE“ 500, weit gesperrt |

- Die Logos liegen als Rohmaterial in `docs/briefings/material/`: Beerenrot für hellen Grund, Weiß für dunklen Grund. Sie laden Outfit per `@import` von Google Fonts. Das ist hier nicht erlaubt: **Schriften kommen von Fontsource und werden mit der App ausgeliefert, kein Abruf bei Dritten.** Binde das Logo so ein, dass der Schriftzug mit der Outfit aus Fontsource gesetzt wird, und entferne den `@import`.
- Neue Abhängigkeit dieses Pakets: Outfit von Fontsource. Sonst keine.
- Die Farben der App selbst (`--weinrot: #8e3148` und so weiter) bleiben unverändert. Lege die Werte oben als eigene Marken-Tokens an, die das Plakat nutzt.
- Im Druck sollen Farbflächen auch wirklich gedruckt werden (`print-color-adjust`). Rechne damit, dass ein Ladendrucker keine randlosen Flächen kann: Das Plakat muss auch mit weißem Rand gut aussehen.

**Bevor du das Plakat baust:** Zeige zwei oder drei Entwürfe mit erfundenen Beispielweinen (keine echten Daten) und lass Thorsten wählen. Mindestens einer mit hellem Grund, der wenig Tinte braucht.

## Nicht Teil dieses Pakets

- Weinliste für die Tische, Preisschilder, Steckbrief, Beitrag für soziale Medien
- Beschreibung oder Kurztext durch das Sprachmodell (Paket 5)
- Dublettenprüfung (Paket 6)
- Rückmeldungen nach dem Treff
- Preise aus einer Kasse
- Fotos oder Hintergrundbilder auf dem Plakat
- Umstellung der App-Farben auf die Markenfarben

## Rahmen

- Next.js 16 (App Router, TypeScript), Betrieb auf Vercel. `proxy.ts` schützt alle Routen.
- Kein Formular-, Zustands-, UI- oder PDF-Paket.
- Schlüssel nur aus Umgebungsvariablen. Keine echten Weindaten oder Fotos ins Repository; Beispiele sind erfunden und als erfunden erkennbar.
- Texte auf Deutsch, Du-Form, kurz.
- Schreibrouten prüfen alles auf dem Server noch einmal.

## Fertig, wenn

1. `npm run typecheck` und `npm run build` laufen fehlerfrei.
2. Ein Monat lässt sich anlegen, elf geprüfte Weine lassen sich wählen und ordnen, und in Baserow stehen elf Zeilen mit Monat, Position, Kennung und Glaspreis.
3. Eine Karte mit Stand `aufgenommen` lässt sich nicht wählen, auch nicht über einen direkten Aufruf der Schreibroute.
4. Das Plakat mit elf Weinen, langen Namen und vollen Kurztexten passt im Druckdialog auf genau eine A4-Seite, ohne abgeschnittene Wörter. Geprüft in Safari und Chrome.
5. Das Plakat mit drei Weinen sieht nicht leer aus.
6. Ein Feld, das auf der Karte nicht bestätigt ist, erscheint nicht auf dem Plakat.
7. Ein geänderter Glaspreis an der Karte ändert einen schon angelegten Monat nicht.
8. Beim Drucken wird keine Schrift und kein Bild von einem fremden Server geladen.
9. Ohne `BASEROW_TABLE_MONATSAUSWAHL` laufen Aufnehmen, Lesen und Prüfkarte weiter.
10. `docs/DATENMODELL.md`, `docs/ARCHITEKTUR.md`, `docs/EINRICHTEN.md` und `README.md` beschreiben den neuen Stand.

Punkt 6 ist der wichtigste Test. Steht etwas Unbestätigtes auf einem Plakat im Laden, ist der Kern der Weinkartei verfehlt.

## Arbeitsweise

- Kleine Commits mit deutscher Beschreibung, was und warum.
- Erst lokal erproben, dann übertragen: Ein Zusammenführen nach `main` geht sofort in den Betrieb.
- Passt etwas an diesem Briefing nicht zur Wirklichkeit, nicht stillschweigend umbauen, sondern melden und einen Vorschlag machen.
- Am Ende kurz berichten: was gebaut ist, was erprobt wurde und wie, was offen bleibt.

## Noch nicht mit Torsten abgestimmt

Diese Punkte sind Annahmen. Baue sie so, dass sie sich leicht ändern lassen:

- was genau je Wein auf dem Plakat steht und wie es heißt („Weine des Monats“);
- die Mischung ein Schaumwein, vier Weiß, ein Rosé, fünf Rot; sie stammt vom Plakat zum Treff, als feste Regel bestätigt ist sie nicht;
- dass das Plakat Glaspreise zeigt, und welche Glasgröße gilt;
- das Format A4 hoch;
- der Treff am ersten Donnerstag auch nach der Übernahme zum 1.1.2027.

Ob für das Anbieten im Glas ein Preisverzeichnis mit bestimmten Angaben nötig ist, ist noch nicht geklärt. Deshalb gibt es das Feld Glasgröße; mehr ist hier nicht zu bauen.

## Ausblick, nur zur Einordnung

Paket 5: Beschreibung als gekennzeichneter Vorschlag, füllt den Kurztext vor. Paket 6: Dublettenprüfung über Strichcode. Danach Weinliste für die Tische, Preisschilder, Suche.
