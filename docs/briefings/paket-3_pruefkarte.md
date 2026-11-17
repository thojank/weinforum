# Entwicklungspaket 3: Prüfkarte

Briefing für einen Coding-Assistenten. Stand 17.11.2026. Alles, was du brauchst, steht hier oder in den genannten Dateien.

## Worum es geht

Die Weinkartei ist eine kleine Web-App für einen Weinladen. Torsten, der den Laden übernehmen will, fotografiert am Handy Vorder- und Rückenetikett einer Flasche. Daraus soll eine geprüfte Karteikarte werden, aus der später Monatsplakat, Weinliste und Preisschild entstehen.

Gebaut und im Betrieb sind Aufnehmen (Paket 1) und Lesen (Paket 2): Ein Sprachmodell füllt dreizehn Felder vom Etikett und hält je Feld die Herkunft fest. Am 17.11.2026 gegen echte Dienste erprobt; eine Mineralwasserflasche wurde richtig als „kein Wein“ gemeldet, nichts erfunden.

Was fehlt: Torsten kann eine Karte bisher nur ansehen. Er kann nichts berichtigen und nichts bestätigen. Ohne Bestätigung darf keine Angabe in eine Ausgabe.

**Paket 3 baut die Prüfkarte:** eine Karte öffnen, das Gelesene neben den Fotos sehen, berichtigen, bestätigen, abschließen.

## Zuerst lesen

- `AGENTS.md` – Regeln für dieses Repository
- `docs/DATENMODELL.md` – Spalten, Spalte `Herkunft`, Schutzregeln beim Lesen
- `docs/ARCHITEKTUR.md` – Bausteine, Grundsätze, „Noch offen“
- `lib/weinkartei/types.ts`, `store.ts`, `baserow.ts`, `pruefen.ts`
- `app/weine/page.tsx`, `app/aufnehmen/aufnahme.tsx`, `app/globals.css`

## Ziel

Torsten prüft eine frisch gelesene Karte am Handy in unter einer Minute: Fotos ansehen, zwei oder drei Felder berichtigen, den Rest mit einem Tipp bestätigen, fertig. Danach hat jede Angabe der Karte den Stand „bestätigt“ und eine nachvollziehbare Herkunft.

## Grundsätze

- **Der Mensch bestätigt, nicht die Maschine.** Keine Angabe wird ohne Torstens Tipp zu „bestätigt“.
- **Die Herkunft bleibt erhalten.** Bestätigt Torsten einen gelesenen Wert unverändert, bleibt die Herkunft das Etikett. Ändert er ihn, wird die Herkunft „inhaber“.
- **Wenig Tippen.** Die Seite ist für das Handy in einer Hand gebaut. Der häufigste Fall – alles stimmt – braucht einen einzigen Tipp.
- **Nichts erfinden.** Die Prüfkarte schlägt keine Werte vor, die nicht gelesen wurden. Vorschläge kommen erst mit einem späteren Paket.

## Umfang

### 1. Seite „Prüfkarte“

- Neue Seite, Vorschlag `/weine/[kennung]`. Jede Karte in „Alle Weine“ und unter „Gerade aufgenommen“ führt dorthin.
- Oben beide Fotos, so groß, dass man das Etikett lesen kann; ein Tipp öffnet das Foto in voller Größe. Beim Bearbeiten eines Feldes soll das Foto erreichbar bleiben, ohne die Eingabe zu verlieren.
- Darunter die Felder in dieser Reihenfolge und Gruppierung:
  - **Vom Etikett:** Name, Erzeuger, Art, Rebsorten, Jahrgang, Land, Region, Qualitätsstufe, Alkohol, Flaschengröße, Geschmacksangabe, Allergene, EAN
  - **Von Torsten:** Preis Flasche, Preis Glas, Kurztext kurz
- Je Feld sichtbar: der Wert, woher er stammt (Etikett vorne, Etikett hinten, Inhaber) und ob er bestätigt ist. Die Farben dafür gibt es schon in `app/globals.css` (`--herkunft-etikett`, `--herkunft-ki`, `--herkunft-bestaetigt`). Farbe nie als einziges Merkmal; immer auch ein Wort oder Zeichen.
- Steht ein Feld unter `unsicher`, erscheint der Grund direkt am Feld, vollständig und nicht abgeschnitten.
- `Art` ist eine Auswahl aus den sieben Werten in `ART_TEXTE`. `Jahrgang` bietet „ohne“ als Tipp an. Für Zahlenfelder die passende Handy-Tastatur.

### 2. Bearbeiten und Bestätigen

- **„Stimmt so“ je Feld:** setzt den Stand des Feldes auf `bestaetigt`. Die Herkunft bleibt, wie sie ist.
- **Wert ändern:** Der neue Wert bekommt Herkunft `inhaber` und Stand `bestaetigt`.
- **Feld leeren:** Der Wert und sein Eintrag in `Herkunft` → `felder` verschwinden.
- **„Alles stimmt so“:** bestätigt alle gefüllten, noch nicht bestätigten Felder in einem Schritt.
- Mit jeder Bestätigung oder Änderung eines Feldes verschwindet dessen Eintrag unter `unsicher`.
- Eingaben werden mit denselben Regeln geprüft wie gelesene Werte (`lib/weinkartei/pruefen.ts`): gültiger Jahrgang, Alkohol 0–25, Flaschengröße in ml, EAN mit Prüfziffer. Komma und Punkt sind beide erlaubt; gespeichert wird mit Punkt. Ein ungültiger Wert wird nicht gespeichert; die Meldung steht am Feld und sagt, was erwartet wird.
- Preise: Betrag in Euro, gespeichert als Text mit Punkt und zwei Nachkommastellen (`8.90`). Herkunft `inhaber`.
- `Kurztext kurz`: freier Text, höchstens 200 Zeichen, Herkunft `inhaber`. Die Spalte `Kurztext lang` bleibt unberührt.

### 3. Karte abschließen

- Schaltfläche **„Karte ist geprüft“**: setzt `Stand` auf `geprueft`.
- Möglich nur, wenn diese Felder gefüllt und bestätigt sind: Name, Erzeuger, Art, Rebsorten, Jahrgang, Land, Alkohol, Flaschengröße. Fehlt etwas, nennt die Seite die fehlenden Felder beim Namen und springt zum ersten.
- Preis und Kurztext sind dafür **nicht** Pflicht. Sie werden erst gebraucht, wenn ein Wein auf das Plakat soll (Paket 4).
- Die Angaben zu Süße, Säure und Körper, die `docs/DATENMODELL.md` als Pflicht führt, gehören zum Paket „Beschreibung“ und sind hier ebenfalls keine Pflicht. Die Doku bitte entsprechend berichtigen.
- Eine geprüfte Karte bleibt bearbeitbar. Wird dabei ein Pflichtfeld geleert, fällt der Stand auf `aufgenommen` zurück, und die Seite sagt das.
- Schaltfläche **„Auslisten“** für Fehlaufnahmen und Flaschen, die nicht in die Kartei gehören: setzt `Stand` auf `ausgelistet`, nach einer Rückfrage. Ausgelistete Karten erscheinen in „Alle Weine“ nur noch in einem eingeklappten Abschnitt und lassen sich zurückholen. Gelöscht wird nichts.

### 4. Noch einmal lesen

- Die Prüfkarte bietet „Noch einmal lesen“ für jede Karte an, nicht nur für Karten ohne Namen.
- Die Schutzregeln aus Paket 2 gelten unverändert: Bestätigte Felder und von Hand eingetragene Werte bleiben stehen. Damit ist die in `docs/DATENMODELL.md` genannte Grenze („Lesen lässt sich nur bei Karten ohne Namen anstoßen“) aufgehoben.

### 5. Datenschicht

- `WeinStore` bekommt, was die Prüfkarte braucht. Heute schreibt `aktualisieren` nur die dreizehn Lesespalten und rührt `Stand` nie an. Wie du die Schnittstelle erweiterst – eine zweite Methode oder eine allgemeinere –, entscheidest du; die Regel bleibt: Die App spricht nie direkt mit Baserow.
- Der Typ `Wein` bekommt Preis Flasche, Preis Glas und Kurztext kurz. `docs/DATENMODELL.md` und `types.ts` werden zusammen gepflegt.
- Spalten und `Herkunft` werden in einem Schreibvorgang geschrieben, damit sie zusammenpassen.
- Gleichzeitigkeit: Läuft gerade ein Lesen, während Torsten bestätigt, darf seine Eingabe nicht verloren gehen. Paket 2 liest die Karte dafür direkt vor dem Schreiben noch einmal; die Prüfkarte soll sich genauso verhalten. Wenn du eine Lücke siehst, die sich so nicht schließen lässt, melde sie.
- Die Schreibroute prüft alles noch einmal auf dem Server. Was der Browser schickt, gilt nicht als geprüft.

### 6. Liste „Alle Weine“

- Die drei Stapel heißen künftig: **Noch zu lesen**, **Zu prüfen**, **Geprüft**. „Zu prüfen“ sind alle gelesenen Karten mit Stand `aufgenommen`; Karten mit Unsicherem stehen darin oben und tragen den Hinweis.
- Jede Karte ist ein Verweis auf ihre Prüfkarte.
- Fehler aus Paket 2: Der Hinweistext unter „Mit Unsicherem“ wird mitten im Wort abgeschnitten. In der Liste darf er gekürzt sein, dann aber sauber mit Auslassungszeichen; auf der Prüfkarte steht er ganz.

### 7. Schrift für Fließtext

- Die Textschrift ist jetzt festgelegt: **Inter**. Bezug wie bei Bricolage Grotesque als Paket von Fontsource (`@fontsource-variable/inter`), kein Abruf bei Dritten. `--schrift-text` wird umgestellt, Systemschrift bleibt Ersatz.
- Das ist die einzige neue Abhängigkeit dieses Pakets.
- Farben bleiben, wie sie sind. Logo und die Schrift Outfit gehören zu den Ausgaben und kommen mit Paket 4.

## Nicht Teil dieses Pakets

- Monatsauswahl und Monatsplakat (Paket 4)
- Beschreibung durch das Sprachmodell: Farbe, Aroma, Geschmack, Speisen, Süße, Säure, Körper, Vorschlag für den Kurztext (Paket 5)
- Dublettenprüfung (Paket 6)
- Strichcode oder QR-Code mit der Kamera auslesen
- Fotos ersetzen oder neu aufnehmen
- Karten löschen
- Suche, Filter, Sortieren
- Anmeldung je Person

## Rahmen

- Next.js 16 (App Router, TypeScript), Betrieb auf Vercel. `proxy.ts` schützt alle Routen; neue Routen brauchen dort keine Ausnahme.
- Kein Formular-, Zustands- oder UI-Paket. Die vorhandenen Klassen in `app/globals.css` weiterverwenden und ergänzen.
- Schlüssel nur aus Umgebungsvariablen, nie ausgeben oder einchecken. Keine echten Weindaten oder Fotos ins Repository.
- Texte auf Deutsch, Du-Form, kurz. Meldungen sagen, was zu tun ist.
- Bedienbar mit Tastatur und Bildschirmleser: echte Beschriftungen an den Feldern, Fehlermeldungen am Feld und nicht nur farbig.

## Fertig, wenn

1. `npm run typecheck` und `npm run build` laufen fehlerfrei.
2. Am Handy: eine gelesene Karte öffnen, ein Feld berichtigen, „Alles stimmt so“, „Karte ist geprüft“ – und in Baserow steht `Stand` = `geprueft`, das berichtigte Feld mit Herkunft `inhaber`, die übrigen mit ihrer Etikett-Herkunft, alle mit Stand `bestaetigt`.
3. Eine Karte mit leerem Pflichtfeld lässt sich nicht abschließen; die Seite nennt das Feld.
4. Ein ungültiger Wert (Jahrgang „20Z1“, Alkohol „120“) wird nicht gespeichert, auch nicht bei einem direkten Aufruf der Schreibroute.
5. Nach „Noch einmal lesen“ auf einer teilweise bestätigten Karte sind alle bestätigten Felder unverändert.
6. Die Mineralwasserflasche lässt sich auslisten, verschwindet aus den Stapeln und lässt sich zurückholen.
7. Die Spalte `Herkunft` ist nach jedem Schritt gültiges JSON in der Form aus `docs/DATENMODELL.md`.
8. `docs/DATENMODELL.md`, `docs/ARCHITEKTUR.md` und `README.md` beschreiben den neuen Stand.

Punkt 5 ist der wichtigste Test. Geht dort eine bestätigte Angabe verloren, ist das Paket nicht fertig.

## Arbeitsweise

- Kleine Commits mit deutscher Beschreibung, was und warum.
- Erst lokal erproben, dann übertragen: Ein Zusammenführen nach `main` geht sofort in den Betrieb.
- Passt etwas an diesem Briefing nicht zur Wirklichkeit, nicht stillschweigend umbauen, sondern melden und einen Vorschlag machen.
- Am Ende kurz berichten: was gebaut ist, was erprobt wurde und wie, was offen bleibt.

## Noch nicht mit Torsten abgestimmt

Diese Punkte sind Annahmen. Baue sie so, dass sie sich leicht ändern lassen:

- welche Felder Pflicht sind, um eine Karte abzuschließen;
- dass das Plakat Preis und Kurztext braucht, und ob der Preis je Flasche, je Glas oder beides gemeint ist;
- die Schreibweise des Landes (bisher wie gedruckt, etwa „France“).

## Ausblick, nur zur Einordnung

Paket 4: Monatsauswahl und Monatsplakat aus geprüften Karten. Paket 5: Beschreibung als gekennzeichneter Vorschlag, füllt den Kurztext vor. Paket 6: Dublettenprüfung über Strichcode. Danach Weinliste, Preisschilder, Suche.
