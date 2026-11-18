# Datenmodell

Arbeitsstand für Stufe 1, nach Paket 3 (Prüfkarte). Die Tabelle wird in Baserow von Hand angelegt; die Spaltennamen müssen genau so heißen, weil `lib/weinkartei/baserow.ts` sie liest. Die Typen im Code stehen in `lib/weinkartei/types.ts`; Doku und Typen werden zusammen gepflegt.

## Tabelle „Weine“ (eine Zeile je Flasche: Wein, Jahrgang, Flaschengröße)

| Spalte | Typ in Baserow | Zuerst aus | Pflicht zum Abschließen |
| --- | --- | --- | --- |
| Kennung | Text, Form `wk-` und 8 Zeichen (z. B. `wk-3f9a2c1b`) | App (eigene, stabile Kennung) | – |
| Name | Text | Etikett vorne | ja |
| Erzeuger | Text | Etikett hinten | ja |
| Art | Text mit festen Werten: Schaumwein, Weiß, Rosé, Rot, Süßwein, alkoholfrei, Sonstiges | Etikett oder Inhaber | ja |
| Rebsorten | Text, mit Komma getrennt | Etikett | ja; bei Verschnitt „Cuvée“ |
| Jahrgang | Text: vier Ziffern oder „ohne“ | Etikett | ja; ohne Jahrgang „ohne“ |
| Land | Text | Etikett | ja |
| Region | Text | Etikett | nein |
| Qualitätsstufe | Text | Etikett | nein |
| Alkohol | Text: Zahl in % vol mit Punkt, z. B. `12.5` | Etikett hinten | ja |
| Flaschengröße | Text: ganze Zahl in ml, z. B. `750` | Etikett | ja |
| Geschmacksangabe | Text | Etikett | nein |
| Süße, Säure, Körper | je Text: Zahl 1–5 | KI-Vorschlag, dann Inhaber | nein (kommt mit dem Paket „Beschreibung“) |
| Farbe, Aroma, Geschmack | je langer Text | KI-Vorschlag („typisch für“) | nein |
| Passt zu | Langer Text | KI-Vorschlag | nein |
| Trinktemperatur | Text | KI-Vorschlag | nein |
| Kurztext kurz | Langer Text, höchstens 200 Zeichen | Inhaber (Prüfkarte), später auch KI-Vorschlag | nein |
| Kurztext lang | Langer Text | KI-Vorschlag | nein |
| Verkostungsnotiz | Langer Text | Inhaber | nein |
| Allergene | Text | Etikett | nein |
| E-Label | Text: Adresse | QR-Code | nein |
| EAN | Text: 8, 12 oder 13 Ziffern | Strichcode oder Etikett | nein |
| Artikelcode | Text | Bestandssystem | nein |
| Preis Flasche, Preis Glas | je Text: Betrag in € mit Punkt und zwei Nachkommastellen, z. B. `8.90` | Inhaber (Prüfkarte), später Kasse | nein (erst für das Plakat, Paket 4) |
| Foto vorne, Foto hinten | je Datei | Aufnahme | – |
| Herkunft | Langer Text (JSON, siehe unten) | App | – |
| Stand | Text mit festen Werten: aufgenommen, geprueft, ausgelistet | App | – |

**Pflicht zum Abschließen** heißt: Die Spalte hat einen Wert, und ihr Eintrag in `Herkunft` hat den Stand `bestaetigt`. Erst dann lässt sich eine Karte mit „Karte ist geprüft“ auf `geprueft` setzen. Ein Herkunftseintrag zu einer leeren Spalte zählt nicht, und `Name` mit „(noch nicht gelesen)“ gilt als leer. Die Liste steht an genau einer Stelle im Code (`PFLICHT_FELDER` in `lib/weinkartei/pruefkarte.ts`): Name, Erzeuger, Art, Rebsorten, Jahrgang, Land, Alkohol, Flaschengröße. Preise, `Kurztext kurz` sowie Süße, Säure und Körper sind ausdrücklich **nicht** Pflicht.

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

Ein anderer Text in `Art`, etwa „Weißwein“ von Hand eingetragen, bleibt in Baserow stehen; die App kennt dafür dann keine `Weinart`. Auf der Prüfkarte lässt sich ein solcher Wert nicht bestätigen, nur durch eine der sieben Arten ersetzen.

## Die sechzehn Felder der Prüfkarte

Die Prüfkarte zeigt und schreibt die dreizehn Lesespalten und dazu drei Spalten, die nur der Inhaber füllt (im Code `INHABER_FELDER`): `Preis Flasche`, `Preis Glas`, `Kurztext kurz`. Zusammen sind das die sechzehn Felder der Prüfkarte, in der Reihenfolge der Seite (im Code `PRUEF_FELDER`). `Kurztext lang` und alle übrigen Spalten bleiben unberührt.

## Spalte „Herkunft“

Die Spalte enthält ein JSON-Objekt als Text. Sie sagt für jede Angabe, woher sie stammt und wie weit sie ist.

```json
{
  "felder": {
    "Name": { "herkunft": "etikett-vorne", "stand": "bestaetigt" },
    "Erzeuger": { "herkunft": "etikett-hinten", "stand": "gelesen" },
    "Preis Flasche": { "herkunft": "inhaber", "stand": "bestaetigt" }
  },
  "unsicher": [{ "feld": "Jahrgang", "grund": "teilweise verdeckt" }],
  "lauf": { "modell": "google/gemini-3.1-flash-lite", "zeit": "2026-11-17T17:00:00Z" }
}
```

- `felder`: je Spalte ein Eintrag mit `herkunft` und `stand`. Schlüssel sind die Spaltennamen. Auch Spalten späterer Pakete dürfen hier stehen.
  - `herkunft` ist einer von: `etikett-vorne`, `etikett-hinten`, `e-label`, `haendler`, `ki`, `inhaber`, `import`. Das Lesen schreibt nur `etikett-vorne` und `etikett-hinten`. Die Prüfkarte behält beim Bestätigen die bisherige Herkunft und schreibt sonst nur `inhaber`.
  - `stand` ist einer von: `gelesen`, `vorgeschlagen`, `bestaetigt`. Das Lesen schreibt nur `gelesen`, die Prüfkarte nur `bestaetigt`. Nur Bestätigtes darf in Ausgaben erscheinen.
  - Setzt oder bestätigt die Prüfkarte eines der drei Inhaberfelder, ist sein Eintrag immer `inhaber` / `bestaetigt`.
- `unsicher`: Liste von Lesespalten, bei denen das Modell unsicher war oder deren Wert die App verworfen hat, je mit einem kurzen Grund. `feld` ist immer eine der dreizehn Lesespalten; Inhaberfelder stehen hier nie.
- `lauf`: Modell und Zeitpunkt des letzten Lesens (ISO 8601, UTC). Ein Lesen ohne jedes Ergebnis schreibt `lauf` trotzdem, mit leeren `felder`; so sieht man, dass gelesen wurde. Schritte der Prüfkarte lassen `lauf` unverändert.

Leere Spalte bedeutet dasselbe wie `{ "felder": {}, "unsicher": [] }`.

Text, der sich nicht als dieses Objekt lesen lässt, gilt als ungültig. Dazu reicht ein einzelner falscher Eintrag, etwa ein unbekannter Wert in `herkunft` oder ein `feld` außerhalb der Lesespalten. Dann:

- bricht das Lesen dieser Karte mit einem Fehler ab und schreibt nichts, damit kein bestätigtes Feld überschrieben wird;
- scheitert jeder Schritt der Prüfkarte mit „In der Spalte „Herkunft“ steht Text, der sich nicht lesen lässt. Bitte die Spalte in Baserow prüfen.“ und schreibt nichts; die Prüfkarte zeigt dann nur die Fotos und diese Meldung;
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
- Der Grund wird auf höchstens 300 Zeichen gekürzt (im Code `GRUND_MAX_ZEICHEN`), an der letzten Wortgrenze und mit „…“; Leerraum und Satzzeichen vor „…“ fallen weg. Nur ein einzelnes Wort, das länger ist als die Grenze, wird mitten im Wort geschnitten. Fehlt der Grund, steht „ohne Angabe des Grundes“ da.
- Bis Paket 2 wurde der Grund hart auf 120 Zeichen abgeschnitten. Solche alten Gründe bleiben in Baserow stehen, bis die Karte neu gelesen wird (bei nicht geschützten Feldern) oder das Feld auf der Prüfkarte bestätigt, geändert oder geleert wird.
- Je Feld zählt nur die erste Meldung. Hat die App den Wert verworfen, steht nur ihr eigener Grund da.
- Eine Meldung zu einem Feld ohne Wert bleibt stehen.
- Die Liste ist nach der Reihenfolge der Lesespalten geordnet.

In „Alle Weine“ wird der Grund für die Anzeige zusätzlich auf 70 Zeichen gekürzt, nach derselben Regel (`kurzerGrund`). Auf der Prüfkarte steht er ganz.

## Regeln beim Schreiben (Lesen)

1. **Der Stand bleibt, wie er ist.** Geprüft wird eine Karte erst durch den Inhaber auf der Prüfkarte. Das Lesen schreibt nie in `Stand`.
2. **Fotos bleiben unberührt.** Das Lesen schreibt nie in `Foto vorne` oder `Foto hinten`.
3. **Alle übrigen Spalten bleiben unberührt:** Süße, Säure, Körper, Farbe, Aroma, Geschmack, Passt zu, Trinktemperatur, Kurztext kurz, Kurztext lang, Verkostungsnotiz, E-Label, Artikelcode, Preis Flasche, Preis Glas. Ihre Einträge in `Herkunft` → `felder` bleiben ebenfalls stehen.
4. **Geschützte Felder bleiben, wie sie sind.** Ein Feld ist geschützt,
   - wenn sein Eintrag in `Herkunft` den Stand `bestaetigt` hat, oder
   - wenn die Spalte einen Wert hat, den nicht das Lesen geschrieben hat. Das heißt: kein Eintrag in `Herkunft`, oder ein Eintrag, der nicht `gelesen` mit `etikett-vorne`/`etikett-hinten` ist. So bleibt etwa ein Wert stehen, den der Inhaber von Hand in Baserow eingetragen hat.

   Bei einem geschützten Feld bleiben Wert, Herkunftseintrag und alte Meldungen unter `unsicher` erhalten. Alles, was auf der Prüfkarte bestätigt oder geändert wurde, ist also geschützt.
5. **Der letzte Lauf gilt** für alle anderen Lesespalten. Ein neuer Wert ersetzt den alten. Liefert ein neuer Lauf für ein früher gelesenes Feld nichts mehr, wird die Spalte geleert und ihr Herkunftseintrag entfernt. Auch ein auf der Prüfkarte geleertes Feld darf ein späteres Lesen wieder füllen; es erscheint dann als „gelesen“ und unbestätigt.
6. **Der Name bleibt „(noch nicht gelesen)“**, wenn das Modell keinen Namen liefert. Dieser Platzhalter zählt als leer, ist also nie geschützt.
7. **`unsicher`** besteht nach dem Lauf aus den neuen Meldungen für nicht geschützte Felder und den alten Meldungen für geschützte Felder. **`lauf`** wird immer neu gesetzt.
8. **Ein Schreibvorgang, ganz am Ende.** Geschrieben werden alle nicht geschützten Lesespalten, auch unveränderte, und `Herkunft`. So passen Spalten und `Herkunft` immer zusammen, auch wenn zwei Läufe gleichzeitig schreiben. Scheitert vorher etwas, bleibt die Karte unverändert.
   Welche Felder geschützt sind, entscheidet die Karte, wie sie direkt vor dem Schreiben in Baserow steht, nicht wie sie vor dem Lesen stand. Was der Inhaber eingibt oder bestätigt, während das Modell liest, bleibt also stehen; nur in den Millisekunden zwischen diesem letzten Holen und dem Schreiben kann es noch verloren gehen (siehe „Gleichzeitigkeit“, Fall 3).
9. **Keine Sperre.** Wird dieselbe Karte zweimal gleichzeitig gelesen, gilt der spätere Lauf.

Grenze: Wer einen gelesenen Wert direkt in Baserow berichtigt, ohne `Herkunft` anzupassen, verliert ihn beim nächsten Lesen, weil der Eintrag noch „gelesen“ sagt. Berichtigungen deshalb auf der Prüfkarte machen.

Die frühere Einschränkung „Lesen lässt sich nur bei Karten ohne Namen anstoßen“ gilt nicht mehr: Die Prüfkarte bietet „Noch einmal lesen“ für jede Karte an, die nicht ausgelistet ist. Die Schutzregeln oben gelten dafür unverändert. In „Alle Weine“ steht der Knopf weiter nur im Stapel „Noch zu lesen“.

## Regeln beim Schreiben (Prüfkarte)

Jeder Schritt der Prüfkarte geht sofort als eigene Anfrage an die Schreibroute `POST /api/weine/[kennung]/bearbeiten`. Die Route holt die Karte direkt davor frisch aus Baserow, wendet den Schritt mit den reinen Funktionen aus `lib/weinkartei/pruefkarte.ts` an und schreibt das Ergebnis in **einem** Schreibvorgang (`WeinStore.speichern`). Was der Browser schickt, gilt nicht als geprüft; verbindlich ist das Ergebnis auf dem Server.

Geschrieben werden nur die sechzehn Felder der Prüfkarte, `Herkunft` und, wenn er sich ändert, `Stand`. Fotos, `Kennung`, `Kurztext lang` und alle übrigen Spalten gelangen nie in den Schreibvorgang. `Herkunft` wird immer als Ganzes geschrieben; `lauf` und Einträge fremder Spalten in `felder` bleiben stehen.

### Die Schritte

Im Code heißt ein Schritt `Aktion`.

| Schritt (`aktion`) | Auf der Seite | Regel |
| --- | --- | --- |
| `bestaetigen` | „Stimmt so“ je Feld, „Alles stimmt so“ | Je Feld wird der **gesehene Wert** mitgeschickt (siehe unten). Er muss dem frischen Wert in Baserow gleichen und die Eingabeprüfung bestehen. Dann wird die Spalte mit der bereinigten Form des Werts geschrieben (D3) und der Eintrag auf `bestaetigt` gesetzt; die Herkunft bleibt, wie sie war. Ohne bisherigen Eintrag wird sie `inhaber`, bei den drei Inhaberfeldern immer. Felder, die in Baserow und auf der Seite leer sind, werden übergangen. 1 bis 16 Felder je Schritt. |
| `aendern` | Wert ändern, „Übernehmen“ | Der Wert muss die Eingabeprüfung bestehen, sonst wird nichts geschrieben (400 mit `feld`). Leer nach dem Bereinigen → wie `leeren`. Gleicht der bereinigte Wert der bereinigten Form des gespeicherten Werts, gilt das als „Stimmt so“: Die Herkunft bleibt. Sonst: Spalte = bereinigter Wert, Eintrag `inhaber` / `bestaetigt`. Eine Änderung gilt immer, auch wenn sich der Wert inzwischen geändert hat. |
| `leeren` | Feld leeren, leere Eingabe übernehmen, „Bleibt leer“ | Spalte leer (`Name` bekommt wieder „(noch nicht gelesen)“, die Karte wandert in „Noch zu lesen“), Eintrag in `felder` entfernt. Gilt auch für ein schon leeres Feld: So verschwindet bei „Bleibt leer“ nur der Hinweis unter `unsicher`. |
| `abschliessen` | „Karte ist geprüft“ | Sind alle Pflichtfelder erfüllt → `Stand` = `geprueft`. Sonst wird abgelehnt (409) mit „Es fehlen noch: … .“ und/oder „Noch nicht bestätigt: … .“; `fehlend` nennt beide Arten zusammen in Feldreihenfolge. Auf einer schon geprüften Karte mit erfüllten Pflichtfeldern ändert sich nichts (D7). |
| `auslisten` | „Auslisten“ | `Stand` = `ausgelistet`. Möglich bei jeder Karte. Werte und Herkunft bleiben; gelöscht wird nichts. |
| `zurueckholen` | „Zurückholen“ (Prüfkarte und „Alle Weine“) | Nur bei Stand `ausgelistet`: `Stand` = `aufgenommen`. Sonst ohne Wirkung, kein Fehler. Werte und Bestätigungen bleiben; eine vorher geprüfte Karte braucht danach nur noch „Karte ist geprüft“. |

Für `bestaetigen`, `aendern` und `leeren` gilt außerdem:

- Der Eintrag des Feldes unter `unsicher` entfällt. Bei Feldern, die nicht bestätigt werden konnten, bleibt er.
- Ist die Karte ausgelistet, wird abgelehnt (409): „Die Karte ist ausgelistet. Hole sie zuerst zurück.“ Auch `abschliessen` wird bei einer ausgelisteten Karte so abgelehnt.

Auch ein Schritt ohne Wirkung (etwa `zurueckholen` auf einer nicht ausgelisteten Karte) schreibt einmal, dann nur die unveränderte `Herkunft`.

### Herkunft beim Bestätigen und Ändern

- **„Stimmt so“ auf einem gelesenen Feld** lässt die Herkunft beim Etikett (`etikett-vorne` bzw. `etikett-hinten`) und setzt den Stand auf `bestaetigt`.
- **Wert ohne Herkunftseintrag** (von Hand in Baserow eingetragen): „Stimmt so“ setzt `inhaber` / `bestaetigt`.
- **Geänderter Wert:** `inhaber` / `bestaetigt`.
- **Unveränderter Wert im Bearbeiten übernommen:** wie „Stimmt so“, die Herkunft bleibt. Verglichen wird die bereinigte Form: „12,50“ bei gespeichertem `12.5` ist unverändert.
- **Inhaberfelder** (`Preis Flasche`, `Preis Glas`, `Kurztext kurz`): immer `inhaber` / `bestaetigt`, auch beim Bestätigen.
- **Geleertes Feld:** kein Eintrag mehr.

### Gesehener Wert

„Stimmt so“ und „Alles stimmt so“ bestätigen nur den Wert, den die Seite gezeigt hat. Die Seite schickt dafür je Feld genau den Text, den sie zuletzt vom Server bekommen hat (`werte` in `KartenAnsicht`), nie einen aus der Anzeige zurückgebauten Text wie „12,5 % vol“. Der Server vergleicht ihn Zeichen für Zeichen mit dem frischen Wert in Baserow. Weicht er ab oder ist nur einer von beiden leer, wird das Feld nicht bestätigt; es steht in `nichtBestaetigt` mit „{Feld} hat sich inzwischen geändert. Bitte noch einmal ansehen.“ Die übrigen Felder des Schritts werden bestätigt. So gilt nichts als bestätigt, was der Inhaber nicht gesehen hat.

Ein gespeicherter Wert, der die Eingabeprüfung nicht besteht (etwa „Weißwein“ in `Art` oder Alkohol „13 Prozent“, von Hand eingetragen), lässt sich nicht bestätigen. Er steht in `nichtBestaetigt` mit der Meldung des Feldes, hier „Bitte eine der sieben Arten wählen.“ bzw. „Bitte eine Zahl von 0 bis 25, zum Beispiel 12,5.“

**D3 – geschrieben wird die bereinigte Form.** „Stimmt so“ schreibt die Spalte mit dem gesehenen Wert mit, und zwar in der Form, die die Eingabeprüfung daraus macht. Für alles, was das Lesen geschrieben hat, ist das Zeichen für Zeichen derselbe Text. Anders ist es nur bei Werten, die von Hand in Baserow stehen, etwa Alkohol „12,5“ → `12.5`. Solche Werte haben keinen Herkunftseintrag; die Herkunft wird also ohnehin `inhaber`.

### Eingaben

Eingaben auf der Prüfkarte werden mit denselben Regeln geprüft wie gelesene Werte (Tabelle oben, gleiche Funktionen aus `pruefen.ts`). Leerraum wird vorher bereinigt; was danach leer ist, leert das Feld. Komma und Punkt sind beide erlaubt, gespeichert wird mit Punkt. Ein ungültiger Wert wird nie gespeichert. Die Meldungen am Feld sagen, was erwartet wird (im Code `MELDUNGEN`):

| Feld | Gültig, wenn | Meldung |
| --- | --- | --- |
| Jahrgang | wie beim Lesen | „Bitte vier Ziffern von 1900 bis {laufendes Jahr} oder „ohne“.“ |
| Art | wie beim Lesen | „Bitte eine der sieben Arten wählen.“ |
| Alkohol | wie beim Lesen | „Bitte eine Zahl von 0 bis 25, zum Beispiel 12,5.“ |
| Flaschengröße | wie beim Lesen | „Bitte ganze Milliliter von 50 bis 18000, zum Beispiel 750.“ |
| EAN | wie beim Lesen | „Bitte 8, 12 oder 13 Ziffern.“ bzw. „Die Prüfziffer stimmt nicht. Bitte mit den Ziffern unter dem Strichcode vergleichen.“ |
| Preis Flasche, Preis Glas | „€“ und Leerraum werden entfernt, Komma wird Punkt; größer 0 bis 9999.99, höchstens zwei Nachkommastellen. Gespeichert mit zwei Nachkommastellen: „8,9“ → `8.90`. | „Bitte einen Betrag in Euro, zum Beispiel 8,90.“ |
| Kurztext kurz | höchstens 200 Zeichen (Zeichen, nicht Bytes) | „Höchstens 200 Zeichen. Es sind {Zahl}.“ |
| alle übrigen Textfelder | höchstens 200 Zeichen | „Höchstens 200 Zeichen.“ |

Das laufende Jahr setzt die Schreibroute (UTC).

### Stand bleibt wahr

Ist eine Karte `geprueft` und ist nach einem Schritt nicht mehr jedes Pflichtfeld erfüllt (etwa weil ein Pflichtfeld geleert wurde), wird im selben Schreibvorgang `Stand` = `aufgenommen` geschrieben. Die Antwort trägt dann `zurueckgefallen` mit dem ersten offenen Pflichtfeld in Feldreihenfolge; die Seite sagt „Die Karte gilt wieder als zu prüfen, weil {Feld} leer ist.“ bzw., wenn das Feld nicht leer, sondern nur nicht mehr bestätigt ist, „… weil {Feld} nicht bestätigt ist.“ (D6).

Das gilt nach jedem Schritt, auch nach `abschliessen`: Wird auf einer geprüften Karte abgeschlossen, deren Pflichtfelder nicht mehr alle erfüllt sind (etwa nach einem Eingriff in Baserow), antwortet die Route mit 409 und `fehlend` und schreibt trotzdem `Stand` = `aufgenommen` (D7). Die Antwort 409 trägt keinen Stand.

## Gleichzeitigkeit

Baserow kennt kein bedingtes Schreiben. `Herkunft` ist eine einzige Spalte mit JSON; jeder Schreiber (Lesen und Prüfkarte) liest sie, ändert sie und schreibt sie ganz zurück. Schreiben zwei gleichzeitig, gewinnt der spätere und überschreibt die `Herkunft` des früheren. Daraus folgen drei Fälle.

**Fall 1 – Zwei Schritte der Prüfkarte kurz nacheinander: geschlossen.** Zwei schnelle „Stimmt so“ würden als zwei gleichzeitige Anfragen jeweils die alte `Herkunft` lesen; die zweite überschriebe die Bestätigung der ersten. Deshalb schickt die Prüfkarte je Karte immer nur eine Anfrage zur Zeit. Alle Schritte laufen über eine Schlange im Browser (`lib/weinkartei/schlange.ts`), in der Reihenfolge der Tipps; jeder wird auf dem Server auf den frischen Stand angewendet.

**Fall 2 – Lesen, das die Prüfkarte selbst angestoßen hat: geschlossen.** Solange ein über „Noch einmal lesen“ auf der Prüfkarte angestoßenes Lesen läuft, hält die Schlange an. Neue Schritte warten und zeigen „wartet auf das Lesen …“. Nach dem Lesen holt die Seite den frischen Stand (`GET /api/weine/[kennung]`), übernimmt ihn und schickt erst dann die wartenden Schritte ab. So trifft kein Schritt in das Fenster am Ende des Lesens. Hat das Lesen den Wert eines Feldes geändert, das der Inhaber währenddessen bestätigt hat, wird diese Bestätigung nach der Regel „gesehener Wert“ nicht übernommen, und die Seite sagt es. Eine Änderung gilt immer.

**Fall 3 – Lesen von anderer Stelle: bleibt offen.** Betrifft ein Lesen, das ein anderes Gerät angestoßen hat oder das nach dem Aufnehmen noch läuft, während die Prüfkarte derselben Karte schon bedient wird.

- **Fenster A:** Zwischen dem zweiten Holen des Lesens und seinem Schreiben liegt eine Anfrage an Baserow. Speichert die Prüfkarte genau dann, überschreibt das Lesen `Herkunft` und die Spalte des Feldes mit seinem Stand. Folge: Die Bestätigung oder Änderung ist weg; das Feld zeigt wieder „gelesen“.
- **Fenster B:** Zwischen dem Holen der Schreibroute und ihrem Schreiben liegt ebenfalls eine Anfrage. Schreibt das Lesen genau dann, überschreibt die Prüfkarte dessen `Herkunft` mit dem Stand von vor dem Lesen. Folge: Die Spalten tragen die neu gelesenen Werte, `Herkunft` aber die alten Einträge, die alten Einträge unter `unsicher` und den alten `lauf`. War ein Feld vorher leer, hat sein neuer Wert keinen Eintrag; die Seite zeigt ihn als „ohne Herkunft“, und die Schutzregeln behandeln ihn wie von Hand eingetragen. War es schon gelesen, steht der neue Wert mit dem alten Eintrag („gelesen“) da. Was das neue Lesen als unsicher gemeldet hat, fehlt unter `unsicher`.

In beiden Fenstern gilt:

- Nichts gilt als bestätigt, was der Inhaber nicht gesehen hat: `bestaetigen` schreibt den gesehenen Wert zusammen mit dem Eintrag.
- Der Verlust ist auf der Prüfkarte sichtbar (Feld nicht bestätigt bzw. „ohne Herkunft“), sobald die Seite einen neueren Stand hat: mit der Antwort des nächsten Schritts oder beim nächsten Öffnen. Der Schritt im Fenster selbst antwortet mit 200.
- „Karte ist geprüft“ prüft die Pflichtfelder auf dem Server gegen den frischen Stand. Fällt eine Bestätigung danach noch weg, korrigiert der nächste Schritt den Stand („Stand bleibt wahr“).
- Die häufigste Ursache vermeidet die Oberfläche: Unter „Gerade aufgenommen“ erscheint der Verweis „Karte prüfen“ erst, wenn das Lesen beendet ist.

**Restlücke beim Verlassen der Seite (D4).** Verlässt der Inhaber die Prüfkarte, während Schritte in der Schlange warten, gehen sie sofort mit `keepalive` hinaus, damit sie nicht verloren gehen; das gilt beim Schließen oder Wechseln der Seite (`pagehide`) und beim Wechsel innerhalb der App. Direkt aufeinanderfolgende `bestaetigen` werden dabei zu einer Anfrage zusammengelegt (je Feld der zuletzt gesehene Wert). Andere Schritte gehen einzeln, aber gleichzeitig hinaus und können einander auf dem Server überschreiben wie in Fall 1. Folge: Eine Bestätigung kann fehlen, oder ein geänderter Wert steht mit dem alten Herkunftseintrag da (etwa „gelesen“ vom Etikett) und ist dann nicht geschützt. Sichtbar ist das beim nächsten Öffnen der Karte.

**Ebenfalls nicht abgestimmt** sind Schritte auf derselben Karte aus zwei Fenstern oder von zwei Geräten, und „Zurückholen“ in „Alle Weine“ gleichzeitig mit einer offenen Prüfkarte derselben Karte: Jede Seite hat ihre eigene Schlange. Es gelten dieselben Folgen wie in Fall 3.

**Folge für Ausgaben.** Der Stand `geprueft` kann für kurze Zeit nicht stimmen (bis zum nächsten Schritt). Ausgaben (Paket 4) dürfen sich deshalb nicht auf `Stand` allein verlassen, sondern müssen je Feld prüfen, ob sein Eintrag in `Herkunft` `bestaetigt` ist.

Ganz schließen ließe sich die Lücke nur mit einer Sperre außerhalb von Baserow oder mit einer eigenen Spalte je Herkunftseintrag. Beides ist nicht gebaut.

## Im Code (`lib/weinkartei/types.ts`)

- `Wein`: eine Karte. Felder wie die Spalten oben, Zahlen und `Art` schon umgewandelt (`alkohol`, `flaschengroesseMl`, `art` als `Weinart`, `rebsorten` als Liste). Dazu `herkunft` (geparste Spalte `Herkunft`), volle Fotoadressen `fotoVorne`/`fotoHinten` und kleine Vorschauen `fotoVorneVorschau`/`fotoHintenVorschau`. Die Inhaberfelder als `preisFlasche`, `preisGlas`, `kurztextKurz` (Text wie in Baserow).
- `Wein.lesewerte`: der Text der dreizehn Lesespalten genau so, wie er in Baserow steht. Die Schutzregeln brauchen ihn, weil ein Wert wie „Weißwein“ in `Art` beim Umwandeln verloren ginge und das Feld sonst leer aussähe.
- `Wein.pruefwerte`: dasselbe für alle sechzehn Felder der Prüfkarte, nur nicht leere Spalten. `Name` kann darin „(noch nicht gelesen)“ sein. Die Prüfkarte, die Pflichtfelder und die Stapel arbeiten nur mit diesem Text.
- `LESE_FELDER`, `LeseFeld`: die dreizehn Lesespalten.
- `INHABER_FELDER`, `InhaberFeld`: `Preis Flasche`, `Preis Glas`, `Kurztext kurz`.
- `PRUEF_FELDER`, `PruefFeld`: die sechzehn Felder der Prüfkarte in der Reihenfolge der Seite (erst die Lesespalten, dann die Inhaberfelder).
- `KartenHerkunft`, `FeldHerkunft`, `Unsicher`: Inhalt der Spalte `Herkunft`.
- `Herkunft`, `AngabenStand`, `KartenStand`, `Weinart`, `ART_TEXTE`: die festen Werte von oben.
- `Modellantwort`: Antwort des Sprachmodells nach der Prüfung der Form, Schlüssel schon als Spaltennamen. Die Werte sind da noch ungeprüft.
- `LeseAntwort`: Antwort der Route `POST /api/weine/[kennung]/lesen` bei Erfolg.
- `Aktion`: ein Schritt der Prüfkarte, wie ihn der Browser an `POST /api/weine/[kennung]/bearbeiten` schickt: `bestaetigen` (mit `felder`, je `feld` und gesehenem `wert`), `aendern` (`feld`, `wert`), `leeren` (`feld`), `abschliessen`, `auslisten`, `zurueckholen`.
- `KartenAnsicht`: Stand einer Karte, wie die Prüfkarte ihn braucht: `kennung`, `stand`, `werte` (= `pruefwerte`) und `herkunft`. Antwort von `GET /api/weine/[kennung]`.
- `BearbeitenAntwort`: `KartenAnsicht` nach dem Schreiben, dazu `nichtBestaetigt` (Felder, die dieser Schritt nicht bestätigt hat, je mit Satz) und, wenn der Stand gefallen ist, `zurueckgefallen` (`{ feld }`). Antwort der Schreibroute bei Erfolg.
- `KENNUNG_MUSTER`: Form der Kennung (`wk-` und 8 Zeichen aus 0–9, a–f).
- `NAME_UNGELESEN`: „(noch nicht gelesen)“, der Name einer frisch aufgenommenen Karte.

Weiter in `lib/weinkartei/`:

- `pruefen.ts`: `hatWert(feld, wert)` entscheidet als einzige Stelle, ob eine Spalte einen Wert hat (`Name` mit „(noch nicht gelesen)“ gilt als leer). `kurzerGrund(text, max)` kürzt an einer Wortgrenze mit „…“. `GRUND_MAX_ZEICHEN` = 300.
- `pruefkarte.ts` (reine Funktionen): `PFLICHT_FELDER`, `eingabePruefen`, `anwenden`, `offenePflichtfelder`, `stapelVon`, `einordnen`, `MELDUNGEN`.

Die Beispielzeile aus der Vorlage hat die Kennung `bsp-0001`. Sie passt nicht auf `KENNUNG_MUSTER`; sie lässt sich deshalb nicht lesen und hat keine Prüfkarte.

## Regeln

- Lesen vor Vermuten: Etikett, dann E-Label, dann Händler, zuletzt KI. Unlesbares bleibt leer.
- Jede Angabe hat Herkunft und Stand. Nur Bestätigtes erscheint in Ausgaben, und zwar je Feld geprüft.
- Bestätigt wird nur durch den Inhaber, nie durch die Maschine.
- Fachliche Regeln liegen in der App, nicht in Formeln der Datenbank.
- Keine Kundendaten in dieser Tabelle.

Weitere Tabellen (Monatsauswahl, Ausgaben, Rückmeldungen) folgen mit Stufe 2 und 3.
