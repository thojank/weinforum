# Architektur

## Bausteine

| Baustein | Technik | Ort |
| --- | --- | --- |
| App fürs Handy und den Rechner | Next.js (App Router, TypeScript) | Vercel, Region Frankfurt |
| Dienst fürs Lesen der Etiketten | Route `app/api/weine/[kennung]/lesen/route.ts` | Vercel, läuft nur auf dem Server |
| Aufruf des Sprachmodells | `lib/weinkartei/lesen.ts` | im Code, nur auf dem Server |
| Prüfen und Zusammenführen | `lib/weinkartei/pruefen.ts` | im Code, reine Funktionen |
| Datenbank und sichtbare Tabelle | Baserow | Baserow Cloud |
| Dünne Datenschicht | `lib/weinkartei/store.ts` | im Code |

## Grundsätze

1. Die App spricht nur über `WeinStore` mit der Datenbank. Baserow lässt sich später tauschen.
2. Schlüssel und Tokens liegen ausschließlich in Umgebungsvariablen auf dem Server. Nichts davon gelangt in den Browser oder ins Repository.
3. Das Sprachmodell bekommt je Aufruf genau einen Wein. Lesen und Beschreiben sind getrennte Aufträge.
4. Strichcode und QR-Code liest die App selbst, nicht das Sprachmodell. (Bis dahin überträgt das Lesen nur die Ziffern, die unter dem Strichcode gedruckt sind.)
5. Zusammenspiel mit dem späteren Bestandssystem über zwei Schlüssel: EAN und eigener Artikelcode.
6. Keine echten Daten und keine Fotos im Repository.

## Stufen

- Stufe 1 Erfassen: Aufnehmen mit zwei Fotos, Lesen, Beschreiben, Dublettenprüfung, Prüfkarte.
- Stufe 2 Verwenden: Monatsauswahl, Weinliste, Monatsplakat, Preisschilder, Suche.
- Stufe 3 Wissen: Verkostungsnotizen, Rückmeldungen, ähnliche Weine.
- Stufe 4 Anbindung an Kasse und Bestandssystem.

Gebaut sind aus Stufe 1: Aufnehmen (Paket 1) und Lesen (Paket 2).

## Lesen

Ein Sprachmodell liest die Fotos einer Karte und trägt ein, was auf den Etiketten gedruckt steht. Nicht mehr: Es beschreibt den Wein nicht und ergänzt kein Weinwissen. Was nicht lesbar ist, bleibt leer. Welche Spalten gefüllt werden und nach welchen Regeln, steht in `docs/DATENMODELL.md`.

### Ablauf

```
Browser                                   Server (Next.js, Vercel)
───────                                   ─────────────────────────
aufnahme.tsx ──POST /api/weine──────────► store.aufnehmen()           Karte „aufgenommen“
     │
     └─ lesenAnstossen(kennung) ─POST /api/weine/[kennung]/lesen──► route.ts
nochmal-lesen.tsx ─┘                         ├─ leseEinstellungen()      lesen.ts
                                             ├─ store.holen(kennung)     Karte, Fotoadressen, Herkunft
                                             ├─ lesen(fotos, …)          Fotos laden, OpenRouter, Form prüfen
                                             ├─ pruefen(antwort, …)      pruefen.ts
                                             ├─ store.holen(kennung)     noch einmal, frischer Stand
                                             ├─ zusammenfuehren(…)       pruefen.ts
                                             └─ store.aktualisieren(…)   einziger Schreibvorgang
```

1. **Anstoßen im Browser** (`lib/weinkartei/lesen-anstossen.ts`). „Wein aufnehmen“ ruft `lesenAnstossen` gleich nach dem Speichern auf, ohne dass der Inhaber wartet. In „Alle Weine“ tut es der Knopf „Noch einmal lesen“ (`app/weine/nochmal-lesen.tsx`). Die Funktion wirft nie; jeder Fehler kommt als deutscher Satz zurück, für beide Seiten gleich. Sie nutzt `keepalive`, damit die Anfrage weiterläuft, wenn die Seite verlassen wird.
2. **Route** `POST /api/weine/[kennung]/lesen`, ohne Anfragekörper, geschützt durch den Zugangscode (`proxy.ts`). Sie bleibt dünn und ruft nur die Bausteine auf. Sie darf bis zu 60 Sekunden laufen (`maxDuration = 60`).
3. **Karte holen** über `WeinStore.holen(kennung)`: Werte, volle Adressen der Fotos und die gelesene Spalte `Herkunft`.
4. **Lesen** (`lib/weinkartei/lesen.ts`, nur auf dem Server): Fotos laden, Sprachmodell über OpenRouter aufrufen, Form der Antwort prüfen.
5. **Prüfen** (`pruefen` in `lib/weinkartei/pruefen.ts`): jeden Wert formal prüfen; was nicht passt, verwerfen und unter „unsicher“ vermerken.
6. **Zusammenführen** (`zusammenfuehren` in `pruefen.ts`): Schutzregeln anwenden, neue Herkunft bilden. Dafür holt die Route die Karte noch einmal, damit gilt, was jetzt in Baserow steht, und nicht der Stand vor dem Modell. Scheitert dieses zweite Holen, antwortet die Route wie beim ersten (404 oder 502) und schreibt nichts.
7. **Schreiben** über `WeinStore.aktualisieren(kennung, felder, herkunft)`: einmal, ganz am Ende. Jeder Fehler davor lässt die Karte unverändert.

### Route: Antworten

Dieser Abschnitt folgt der technischen Spezifikation des Pakets und ist mit dem Stand der Route beim Schreiben der Doku abgeglichen; beide entstanden gleichzeitig.

| Code | Anlass | Text |
| --- | --- | --- |
| 200 | gelesen, auch ohne jedes Ergebnis | `LeseAntwort` (siehe `types.ts`) |
| 401 | nicht angemeldet (macht `proxy.ts`) | „nicht angemeldet“ |
| 503 | Datenbank nicht eingerichtet | „Die Datenbank ist nicht eingerichtet.“ |
| 503 | `OPENROUTER_API_KEY` oder `MODELL_ID` fehlt | „Das Lesen ist nicht eingerichtet (OPENROUTER_API_KEY fehlt).“ bzw. „(MODELL_ID fehlt).“ |
| 404 | Kennung hat nicht die Form `wk-…` oder steht nicht in Baserow | „Diese Karte gibt es nicht.“ |
| 502 | Karte hat kein Vorderfoto | „Zu dieser Karte gibt es kein Foto vom Vorderetikett.“ |
| 502 | jeder andere Fehler beim Holen, Lesen, Prüfen oder Schreiben | ein deutscher Satz aus `lesen.ts` oder `baserow.ts`; bei etwas Unerwartetem ein fester Ersatzsatz je Schritt |

Geprüft wird in dieser Reihenfolge. Fehler kommen immer als `{ "fehler": "…" }`, ohne Rohantworten und ohne Stacktraces. Es wird nur der Name einer fehlenden Variablen genannt, nie ein Wert.

Eine Antwort 200 mit leerer Liste `gelesen` heißt „auf den Fotos war nichts zu lesen“. Sie ist kein Fehler.

### Sprachmodell aufrufen (`lesen.ts`)

- `leseEinstellungen()` liest `OPENROUTER_API_KEY` und `MODELL_ID`. Leerer Text zählt als fehlend. Ein Ersatzmodell im Code gibt es nicht.
- **Fotos als Daten-URL.** Der Server lädt die vollen Fotos von den Adressen aus Baserow und schickt sie als Daten-URL mit. Er gibt dem Modell keine Adressen. Gründe:
  - Das Ergebnis hängt nicht davon ab, ob ein Anbieter die Adresse bei Baserow selbst abrufen kann oder darf. Das Verhalten ist für jedes Modell gleich, auch beim Vergleich mit einem zweiten Modell.
  - Ein fehlendes oder nicht ladbares Foto fällt im eigenen Code auf, mit eigener Meldung.
  - Die Größe ist unkritisch: Die Fotos sind auf 1600 Pixel verkleinert. Die Grenze von rund 4,5 MB bei Vercel gilt für ankommende Anfragen, nicht für diesen Aufruf nach außen.
  - Beim Laden der Fotos geht kein Baserow-Token mit. Den Medientyp nimmt der Code aus der Antwort, sonst `image/jpeg`.
- Ohne Rückenfoto bekommt das Modell nur das Vorderfoto und den Hinweis, für kein Feld „hinten“ anzugeben.
- Die Anfrage verlangt eine feste Antwortstruktur (`response_format` vom Typ `json_schema`, `strict: true`), dazu `temperature: 0` und höchstens 1500 Tokens.
- Zurück kommt eine `Modellantwort`: nur die Form ist geprüft, die Schlüssel sind schon Spaltennamen. Ob die Werte gültig sind, entscheidet `pruefen`.

**Zeitgrenzen:**

- je Foto 10 Sekunden zum Laden (beide parallel);
- 45 Sekunden für den Aufruf des Modells, damit die Route innerhalb ihrer 60 Sekunden noch antworten kann;
- dauert alles zusammen im ungünstigsten Fall länger, bricht Vercel ab; der Browser zeigt dann „Der Server hat nicht rechtzeitig geantwortet.“

**Keine Wiederholung.** Scheitert ein Aufruf, versucht der Code es nicht selbst noch einmal. Der Inhaber hat dafür den Knopf „Noch einmal lesen“.

**Fehlersätze** (`LESE_FEHLER`), die die Route unverändert weitergibt:

- „Das Sprachmodell hat nicht geantwortet.“ – Status nicht 2xx, Netzfehler, Fehler in der Antwort
- „Das Lesen hat zu lange gedauert.“ – eigene Zeitgrenze, oder OpenRouter meldet eine Zeitüberschreitung
- „Die Antwort des Sprachmodells war nicht verwertbar.“ – kein Inhalt, abgeschnitten, kein JSON, falsche Form
- „Das eingestellte Modell kann die feste Antwortstruktur nicht liefern.“ – erkannt am Text der Meldung von OpenRouter, weil es dafür keinen einheitlichen Statuscode gibt
- „Das Foto ließ sich nicht aus der Datenbank laden.“

**Protokoll:** je Aufruf eine Zeile mit Kennung, Modell, Dauer, Statuscode und Art des Fehlers. Nie Schlüssel, Bilddaten, Fotoadressen oder die Antwort des Modells.

### Prüfen und Zusammenführen (`pruefen.ts`)

Reine Funktionen: kein Netz, keine Umgebungsvariablen, keine Uhr, kein `server-only`. Jahr und Zeitpunkt kommen von der Route herein. Deshalb lässt sich die Datei auch außerhalb von Next.js ausführen und prüfen. Die Regeln selbst stehen in `docs/DATENMODELL.md` („Prüfung der gelesenen Werte“, „Regeln beim Schreiben“).

### Datenschicht (`WeinStore.holen` und `aktualisieren`)

- `holen(kennung)` liefert die Karte samt Fotoadressen und Herkunft, oder `null`, wenn es die Kennung nicht gibt. Fehlt eine der dreizehn Lesespalten oder `Herkunft`, oder ist der Text in `Herkunft` ungültig, gibt es einen Fehler.
- `aktualisieren(kennung, felder, herkunft)` schreibt nur Lesespalten und `Herkunft`. `Stand`, Fotos und alle übrigen Spalten gelangen nie in den Schreibvorgang. Die Spalten werden vor und nach dem Schreiben geprüft; fehlt eine, nennt der Fehler sie.
- `liste()` ist nachsichtig: Ungültiger Text in `Herkunft` lässt die Karte ohne Herkunft erscheinen, statt die ganze Liste scheitern zu lassen.

**Karte über `Kennung` finden.** Der Code nutzt am Baserow-Endpunkt „Zeilen auflisten“ den Parameter `filters` (JSON) mit dem Spaltennamen:

```
…/api/database/rows/table/{tabelle}/?user_field_names=true&size=200
  &filters={"filter_type":"AND","filters":[{"field":"Kennung","type":"equal","value":"wk-…"}]}
```

(Der JSON-Teil ist in der Adresse kodiert.) Quelle ist das OpenAPI-Schema von Baserow: Der Spaltenname ist dort erlaubt, wenn `user_field_names` gesetzt ist. Die Form `filter__{Feld}__equal` wird nicht verwendet. Diese Filterform ist noch nicht gegen eine echte Baserow-Tabelle erprobt.

Sicherung, falls Baserow den Filter nicht anwendet:

- Der Code behält nur Zeilen, deren `Kennung` genau gleich ist. So wird nie in eine falsche Zeile geschrieben.
- Liefert Baserow mehr als eine Seite, bricht der Code mit einem Fehler ab, statt alle Seiten zu durchsuchen. Sonst wäre „nicht gefunden“ nicht verlässlich.
- Stehen mehrere Zeilen mit derselben Kennung da, gibt es einen Fehler und es wird nichts geschrieben.
- Lehnt Baserow den Spaltennamen ab, erscheint „Baserow antwortet beim Suchen der Karte mit Status 400.“ Ausweichweg wäre die Feld-Nummer von `Kennung`.

### Oberfläche

- **„Wein aufnehmen“** (`app/aufnehmen/aufnahme.tsx`): Nach „Gespeichert“ erscheint unter „Gerade aufgenommen“ je Aufnahme eine Karteikarte, die sich mit dem Ergebnis füllt. Mehrere Lesevorgänge laufen nebeneinander. Der Bereich lebt nur, solange die Seite offen ist.
- **„Alle Weine“** (`app/weine/page.tsx`, Server Component): Drei Stapel „Noch zu lesen“, „Mit Unsicherem“, „Gelesen“, darüber eine Übersicht mit den drei Zahlen. Liefert „Noch einmal lesen“ einen Namen, lädt die Seite ihre Daten neu und die Karte wandert in ihren Stapel; sonst steht ein kurzer Satz im Kästchen.
- Bearbeiten gibt es noch nicht; das kommt mit der Prüfkarte in Paket 3.

## Sprachmodell

- Zugang über OpenRouter; Schlüssel in `OPENROUTER_API_KEY`, Modell in `MODELL_ID`. Kein Modellname im Code.
- Voreinstellung `google/gemini-3.1-flash-lite`: in einem öffentlichen Vergleich von 14 Modellen an 200 Bildern (28.09.2026) vorn bei der Texterkennung, rund 0,09 US-Cent je Bild. Nicht an echten Weinetiketten erprobt.
- Zum Vergleich vorgesehen: `anthropic/claude-haiku-5.5`.
- Jede Anfrage verlangt eine feste Antwortstruktur und setzt `provider.require_parameters` auf `true`, damit nur Anbieter antworten, die das können.

## Schriften

- Webschriften kommen als Pakete von Fontsource und werden mit der App ausgeliefert; kein Abruf bei Dritten.
- Gesetzt: Bricolage Grotesque (variabel, 200–800) für Überschriften und Schaltflächen.
- Fließtext vorerst Systemschrift, bis die übrigen Schriften feststehen.

## Noch offen

- Echte Anmeldung je Person; bis dahin ein gemeinsamer Zugangscode (`proxy.ts`, `lib/zugang.ts`).
- Übrige Schriften und Logo für die Vorlagen der Ausgaben.
- **Lesen ist noch nirgends gegen echte Dienste gelaufen.** Beim Bauen gab es keine Zugangsdaten. Unerprobt sind:
  - der Filter auf `Kennung` gegen eine echte Baserow-Tabelle;
  - der Aufruf von OpenRouter mit dem voreingestellten Modell;
  - das Verhalten bei unlesbaren Fotos. Das ist der wichtigste Test: Erfindet das Modell dort Angaben, wird zuerst der Auftrag geschärft; hilft das nicht, wird das Vergleichsmodell vorgeschlagen, nicht still gewechselt;
  - das Lesen an echten Weinetiketten überhaupt. Echte Fotos gehören nicht ins Repository.
- **Antwortstruktur:** Das Schema schreibt „Text oder nichts“ als Liste (`type: ["string", "null"]`). Ob der Anbieter des voreingestellten Modells das annimmt, zeigt erst der erste echte Aufruf. Ausweichform wäre `anyOf` mit `null`; umgebaut wird nur nach Rücksprache.
- **`keepalive` am Handy:** Ob das Lesen nach einem Seitenwechsel am Handy zuverlässig zu Ende läuft, ist offen. Wenn nicht, wäre ein Anstoß auf dem Server (`after()` in `POST /api/weine`) die Alternative; das weicht vom Briefing ab und braucht vorher Rücksprache.
- **Schreibweise des Landes:** bis zur Entscheidung „wie gedruckt“ („France“, „Italia“), nicht übersetzt.
