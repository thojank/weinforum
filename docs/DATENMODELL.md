# Datenmodell

Arbeitsstand für Stufe 1, nach Paket 2 (Etiketten lesen). Die Tabelle wird in Baserow von Hand angelegt; die Spaltennamen müssen genau so heißen, weil `lib/weinkartei/baserow.ts` sie liest. Die Typen im Code stehen in `lib/weinkartei/types.ts`; Doku und Typen werden zusammen gepflegt.

## Tabelle „Weine“ (eine Zeile je Flasche: Wein, Jahrgang, Flaschengröße)

| Spalte | Typ in Baserow | Zuerst aus | Pflicht zum Bestätigen |
| --- | --- | --- | --- |
| Kennung | Text, Form `wk-` und 8 Zeichen (z. B. `wk-3f9a2c1b`) | App (eigene, stabile Kennung) | ja |
| Name | Text | Etikett vorne | ja |
| Erzeuger | Text | Etikett hinten | ja |
| Art | Text mit festen Werten: Schaumwein, Weiß, Rosé, Rot, Süßwein, alkoholfrei, Sonstiges | Etikett oder Inhaber | ja |
| Rebsorten | Text, mit Komma getrennt | Etikett | ja, sonst „Cuvée“ |
| Jahrgang | Text: vier Ziffern oder „ohne“ | Etikett | ja, sonst „ohne“ |
| Land | Text | Etikett | ja |
| Region | Text | Etikett | nein |
| Qualitätsstufe | Text | Etikett | nein |
| Alkohol | Text: Zahl in % vol mit Punkt, z. B. `12.5` | Etikett hinten | ja |
| Flaschengröße | Text: ganze Zahl in ml, z. B. `750` | Etikett | ja |
| Geschmacksangabe | Text | Etikett | nein |
| Süße, Säure, Körper | je Text: Zahl 1–5 | KI-Vorschlag, dann Inhaber | ja |
| Farbe, Aroma, Geschmack | je langer Text | KI-Vorschlag („typisch für“) | nein |
| Passt zu | Langer Text | KI-Vorschlag | nein |
| Trinktemperatur | Text | KI-Vorschlag | nein |
| Kurztext kurz, Kurztext lang | je langer Text | KI-Vorschlag | nein |
| Verkostungsnotiz | Langer Text | Inhaber | nein |
| Allergene | Text | Etikett | nein |
| E-Label | Text: Adresse | QR-Code | nein |
| EAN | Text: 8, 12 oder 13 Ziffern | Strichcode oder Etikett | nein |
| Artikelcode | Text | Bestandssystem | später |
| Preis Flasche, Preis Glas | je Text: Betrag in € mit Punkt | Inhaber, später Kasse | Flasche ja |
| Foto vorne, Foto hinten | je Datei | Aufnahme | ja |
| Herkunft | Langer Text (JSON, siehe unten) | App | – |
| Stand | Text mit festen Werten: aufgenommen, geprueft, ausgelistet | App | – |

Zu den Typen:

- Alle Spalten sind Text oder langer Text. Nur `Foto vorne` und `Foto hinten` sind Dateifelder.
- Auch Zahlen stehen als Text in Baserow. Die App wandelt sie selbst um und schreibt sie als Text zurück.
- `Art` und `Stand` sind keine Auswahlfelder, sondern Text. Welche Werte erlaubt sind, prüft die App.
- Die Spalten nicht auf Auswahl oder Zahl umstellen: Die App schreibt Text hinein.
- `Herkunft` muss ein langes Textfeld sein. Beim Import aus `docs/weine-vorlage.csv` kommt sie als einfacher Text an und muss umgestellt werden (siehe `docs/EINRICHTEN.md`).

## Die dreizehn Lesespalten

Das Lesen füllt genau diese Spalten (im Code `LESE_FELDER`):

`Name`, `Erzeuger`, `Art`, `Rebsorten`, `Jahrgang`, `Land`, `Region`, `Qualitätsstufe`, `Alkohol`, `Flaschengröße`, `Geschmacksangabe`, `Allergene`, `EAN`.

Alle anderen Spalten fasst das Lesen nie an. Fehlt eine der dreizehn Spalten oder `Herkunft` in Baserow, bricht das Lesen mit einem Fehler ab, der die Spalte nennt.

`Art` im Code (`Weinart`) und der Text in Baserow gehören so zusammen (im Code `ART_TEXTE`):

| Text in Baserow | `Weinart` im Code |
| --- | --- |
| Schaumwein | `schaumwein` |
| Weiß | `weiss` |
| Rosé | `rose` |
| Rot | `rot` |
| Süßwein | `suesswein` |
| alkoholfrei | `alkoholfrei` |
| Sonstiges | `sonstiges` |

Ein anderer Text in `Art`, etwa „Weißwein“ von Hand eingetragen, bleibt in Baserow stehen; die App kennt dafür dann keine `Weinart`.

## Spalte „Herkunft“

Die Spalte enthält ein JSON-Objekt als Text. Sie sagt für jede Angabe, woher sie stammt und wie weit sie ist.

```json
{
  "felder": {
    "Name": { "herkunft": "etikett-vorne", "stand": "gelesen" },
    "Erzeuger": { "herkunft": "etikett-hinten", "stand": "gelesen" }
  },
  "unsicher": [{ "feld": "Jahrgang", "grund": "teilweise verdeckt" }],
  "lauf": { "modell": "google/gemini-3.1-flash-lite", "zeit": "2026-11-17T17:00:00Z" }
}
```

- `felder`: je Spalte ein Eintrag mit `herkunft` und `stand`. Schlüssel sind die Spaltennamen. Auch Spalten späterer Pakete dürfen hier stehen.
  - `herkunft` ist einer von: `etikett-vorne`, `etikett-hinten`, `e-label`, `haendler`, `ki`, `inhaber`, `import`. Das Lesen schreibt nur `etikett-vorne` und `etikett-hinten`.
  - `stand` ist einer von: `gelesen`, `vorgeschlagen`, `bestaetigt`. Das Lesen schreibt nur `gelesen`. Nur Bestätigtes darf in Ausgaben erscheinen.
- `unsicher`: Liste von Lesespalten, bei denen das Modell unsicher war oder deren Wert die App verworfen hat, je mit einem kurzen Grund. `feld` ist immer eine der dreizehn Lesespalten.
- `lauf`: Modell und Zeitpunkt des letzten Lesens (ISO 8601, UTC). Ein Lesen ohne jedes Ergebnis schreibt `lauf` trotzdem, mit leeren `felder`; so sieht man, dass gelesen wurde.

Leere Spalte bedeutet dasselbe wie `{ "felder": {}, "unsicher": [] }`.

Text, der sich nicht als dieses Objekt lesen lässt, gilt als ungültig. Dazu reicht ein einzelner falscher Eintrag, etwa ein unbekannter Wert in `herkunft` oder ein `feld` außerhalb der Lesespalten. Dann:

- bricht das Lesen dieser Karte mit einem Fehler ab und schreibt nichts, damit kein bestätigtes Feld überschrieben wird;
- zeigt „Alle Weine“ die Karte weiter an, nur ohne Hinweis auf Unsicheres.

Wer `Herkunft` von Hand in Baserow ändert, sollte deshalb genau diese Form einhalten.

## Prüfung der gelesenen Werte

Die App prüft jeden Wert des Modells, bevor sie ihn schreibt (`lib/weinkartei/pruefen.ts`). Passt ein Wert nicht, wird er verworfen: Die Spalte bleibt leer, und das Feld steht unter `unsicher` mit dem Grund. Lieber leer als falsch.

Vorher entfernt die App Leerraum an den Rändern und fasst mehrere Leerzeichen zu einem zusammen. Ein leerer Wert lässt das Feld einfach leer, ohne Eintrag unter `unsicher`.

| Feld | Gültig, wenn | Sonst steht unter „unsicher“ |
| --- | --- | --- |
| jedes Feld | die Seite ist `vorne` oder `hinten` | „verworfen: Seite fehlt“ |
| jedes Feld | `hinten` nur, wenn ein Rückenfoto aufgenommen ist | „verworfen: kein Rückenetikett aufgenommen“ |
| Jahrgang | vier Ziffern von 1900 bis zum laufenden Jahr, oder genau „ohne“ | „verworfen: kein gültiger Jahrgang“ |
| Art | genau einer der sieben Texte aus der Tabelle oben | „verworfen: keine der sieben Arten“ |
| Alkohol | Zahl von 0 bis 25. „%“, „vol“ und Leerraum werden entfernt, Komma wird Punkt. Geschrieben wird ohne überflüssige Nullen (`12.5`, `12`). | „verworfen: kein gültiger Alkoholwert“ |
| Flaschengröße | ganze Zahl in ml von 50 bis 18000. „ml“ und Leerraum werden entfernt. Liter oder Zentiliter werden nicht umgerechnet, sondern verworfen. | „verworfen: keine gültige Flaschengröße“ |
| EAN | nach Entfernen von Leerraum nur Ziffern, 8, 12 oder 13 Stellen, und die Prüfziffer stimmt (GS1) | „verworfen: Prüfziffer stimmt nicht“ bzw. „verworfen: keine gültige Strichcode-Nummer“ |
| alle übrigen Textfelder | höchstens 200 Zeichen | „verworfen: zu lang“ |

Zu den Meldungen des Modells unter `unsicher`:

- Meldungen zu unbekannten Feldern fallen weg.
- Der Grund wird auf 120 Zeichen gekürzt; fehlt er, steht „ohne Angabe des Grundes“ da.
- Je Feld zählt nur die erste Meldung. Hat die App den Wert verworfen, steht nur ihr eigener Grund da.
- Eine Meldung zu einem Feld ohne Wert bleibt stehen.
- Die Liste ist nach der Reihenfolge der Lesespalten geordnet.

## Regeln beim Schreiben (Lesen)

1. **Der Stand bleibt `aufgenommen`.** Geprüft wird eine Karte erst durch den Inhaber (Paket 3). Das Lesen schreibt nie in `Stand`.
2. **Fotos bleiben unberührt.** Das Lesen schreibt nie in `Foto vorne` oder `Foto hinten`.
3. **Spalten späterer Pakete bleiben unberührt:** Süße, Säure, Körper, Farbe, Aroma, Geschmack, Passt zu, Trinktemperatur, Kurztext kurz, Kurztext lang, Verkostungsnotiz, E-Label, Artikelcode, Preis Flasche, Preis Glas. Ihre Einträge in `Herkunft` → `felder` bleiben ebenfalls stehen.
4. **Geschützte Felder bleiben, wie sie sind.** Ein Feld ist geschützt,
   - wenn sein Eintrag in `Herkunft` den Stand `bestaetigt` hat, oder
   - wenn die Spalte einen Wert hat, den nicht das Lesen geschrieben hat. Das heißt: kein Eintrag in `Herkunft`, oder ein Eintrag, der nicht `gelesen` mit `etikett-vorne`/`etikett-hinten` ist. So bleibt etwa ein Wert stehen, den der Inhaber von Hand in Baserow eingetragen hat.

   Bei einem geschützten Feld bleiben Wert, Herkunftseintrag und alte Meldungen unter `unsicher` erhalten.
5. **Der letzte Lauf gilt** für alle anderen Lesespalten. Ein neuer Wert ersetzt den alten. Liefert ein neuer Lauf für ein früher gelesenes Feld nichts mehr, wird die Spalte geleert und ihr Herkunftseintrag entfernt.
6. **Der Name bleibt „(noch nicht gelesen)“**, wenn das Modell keinen Namen liefert. Dieser Platzhalter zählt als leer, ist also nie geschützt.
7. **`unsicher`** besteht nach dem Lauf aus den neuen Meldungen für nicht geschützte Felder und den alten Meldungen für geschützte Felder. **`lauf`** wird immer neu gesetzt.
8. **Ein Schreibvorgang, ganz am Ende.** Geschrieben werden alle nicht geschützten Lesespalten, auch unveränderte, und `Herkunft`. So passen Spalten und `Herkunft` immer zusammen, auch wenn zwei Läufe gleichzeitig schreiben. Scheitert vorher etwas, bleibt die Karte unverändert.
   Welche Felder geschützt sind, entscheidet die Karte, wie sie direkt vor dem Schreiben in Baserow steht, nicht wie sie vor dem Lesen stand. Was der Inhaber eingibt oder bestätigt, während das Modell liest, bleibt also stehen; nur in den Millisekunden zwischen diesem letzten Holen und dem Schreiben kann es noch verloren gehen.
9. **Keine Sperre.** Wird dieselbe Karte zweimal gleichzeitig gelesen, gilt der spätere Lauf.

Grenze: Wer einen gelesenen Wert direkt in Baserow berichtigt, ohne `Herkunft` anzupassen, verliert ihn beim nächsten Lesen, weil der Eintrag noch „gelesen“ sagt. Lesen lässt sich in der App bisher nur bei Karten ohne Namen anstoßen.

## Im Code (`lib/weinkartei/types.ts`)

- `Wein`: eine Karte. Felder wie die Spalten oben, Zahlen und `Art` schon umgewandelt (`alkohol`, `flaschengroesseMl`, `art` als `Weinart`, `rebsorten` als Liste). Dazu `herkunft` (geparste Spalte `Herkunft`), volle Fotoadressen `fotoVorne`/`fotoHinten` und kleine Vorschauen `fotoVorneVorschau`/`fotoHintenVorschau`.
- `Wein.lesewerte`: der Text der dreizehn Lesespalten genau so, wie er in Baserow steht. Die Schutzregeln brauchen ihn, weil ein Wert wie „Weißwein“ in `Art` beim Umwandeln verloren ginge und das Feld sonst leer aussähe.
- `LESE_FELDER`, `LeseFeld`: die dreizehn Lesespalten.
- `KartenHerkunft`, `FeldHerkunft`, `Unsicher`: Inhalt der Spalte `Herkunft`.
- `Herkunft`, `AngabenStand`, `KartenStand`, `Weinart`, `ART_TEXTE`: die festen Werte von oben.
- `Modellantwort`: Antwort des Sprachmodells nach der Prüfung der Form, Schlüssel schon als Spaltennamen. Die Werte sind da noch ungeprüft.
- `LeseAntwort`: Antwort der Route `POST /api/weine/[kennung]/lesen` bei Erfolg.
- `KENNUNG_MUSTER`: Form der Kennung (`wk-` und 8 Zeichen aus 0–9, a–f).
- `NAME_UNGELESEN`: „(noch nicht gelesen)“, der Name einer frisch aufgenommenen Karte.

Die Beispielzeile aus der Vorlage hat die Kennung `bsp-0001`. Sie passt nicht auf `KENNUNG_MUSTER` und lässt sich deshalb nicht lesen.

## Regeln

- Lesen vor Vermuten: Etikett, dann E-Label, dann Händler, zuletzt KI. Unlesbares bleibt leer.
- Jede Angabe hat Herkunft und Stand. Nur Bestätigtes erscheint in Ausgaben.
- Fachliche Regeln liegen in der App, nicht in Formeln der Datenbank.
- Keine Kundendaten in dieser Tabelle.

Weitere Tabellen (Monatsauswahl, Ausgaben, Rückmeldungen) folgen mit Stufe 2 und 3.
