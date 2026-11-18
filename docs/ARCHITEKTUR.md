# Architektur

## Bausteine

| Baustein | Technik | Ort |
| --- | --- | --- |
| App fürs Handy und den Rechner | Next.js (App Router, TypeScript) | Vercel, Region Frankfurt |
| Dienst fürs Lesen der Etiketten | Route `app/api/weine/[kennung]/lesen/route.ts` | Vercel, läuft nur auf dem Server |
| Aufruf des Sprachmodells | `lib/weinkartei/lesen.ts` | im Code, nur auf dem Server |
| Prüfen und Zusammenführen | `lib/weinkartei/pruefen.ts` | im Code, reine Funktionen |
| Seite „Prüfkarte“ | `app/weine/[kennung]/` (Server Component und Client-Teil) | Vercel und Browser |
| Schreibroute der Prüfkarte | Route `app/api/weine/[kennung]/bearbeiten/route.ts` | Vercel, läuft nur auf dem Server |
| Frischer Stand einer Karte | Route `app/api/weine/[kennung]/route.ts` (nur `GET`) | Vercel, läuft nur auf dem Server |
| Regeln der Prüfkarte | `lib/weinkartei/pruefkarte.ts` | im Code, reine Funktionen (Server und Browser) |
| Aufruf der Routen aus dem Browser | `lib/weinkartei/karte-bearbeiten.ts` | im Browser |
| Schlange je Karte | `lib/weinkartei/schlange.ts` | im Browser |
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

Gebaut sind aus Stufe 1: Aufnehmen (Paket 1), Lesen (Paket 2) und Prüfkarte (Paket 3).

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

1. **Anstoßen im Browser** (`lib/weinkartei/lesen-anstossen.ts`). „Wein aufnehmen“ ruft `lesenAnstossen` gleich nach dem Speichern auf, ohne dass der Inhaber wartet. In „Alle Weine“ tut es der Knopf „Noch einmal lesen“ im Stapel „Noch zu lesen“ (`app/weine/nochmal-lesen.tsx`), auf der Prüfkarte der gleichnamige Knopf über die Schlange (siehe „Prüfkarte“). Die Funktion wirft nie; jeder Fehler kommt als deutscher Satz zurück, für beide Seiten gleich. Sie nutzt `keepalive`, damit die Anfrage weiterläuft, wenn die Seite verlassen wird.
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

- `holen(kennung)` liefert die Karte samt Fotoadressen, Herkunft und `pruefwerte`, oder `null`, wenn es die Kennung nicht gibt. Fehlt eine der dreizehn Lesespalten oder `Herkunft`, oder ist der Text in `Herkunft` ungültig, gibt es einen Fehler. Die drei Inhaberspalten sind beim Holen nicht Pflicht; fehlen sie, gelten sie als leer. Zum nachsichtigen Modus siehe „Prüfkarte“.
- `aktualisieren(kennung, felder, herkunft)` schreibt nur Lesespalten und `Herkunft`. `Stand`, Fotos und alle übrigen Spalten gelangen nie in den Schreibvorgang. Die Spalten werden vor und nach dem Schreiben geprüft; fehlt eine, nennt der Fehler sie. Die Prüfkarte schreibt über eine eigene Methode, `speichern` (siehe „Prüfkarte“).
- `liste()` ist nachsichtig: Ungültiger Text in `Herkunft` lässt die Karte ohne Herkunft erscheinen, statt die ganze Liste scheitern zu lassen.

**Karte über `Kennung` finden.** Der Code nutzt am Baserow-Endpunkt „Zeilen auflisten“ den Parameter `filters` (JSON) mit dem Spaltennamen:

```
…/api/database/rows/table/{tabelle}/?user_field_names=true&size=200
  &filters={"filter_type":"AND","filters":[{"field":"Kennung","type":"equal","value":"wk-…"}]}
```

(Der JSON-Teil ist in der Adresse kodiert.) Quelle ist das OpenAPI-Schema von Baserow: Der Spaltenname ist dort erlaubt, wenn `user_field_names` gesetzt ist. Die Form `filter__{Feld}__equal` wird nicht verwendet. Das Lesen vom 17.11.2026 gegen echte Dienste (siehe „Noch offen“) setzt voraus, dass diese Suche dort funktioniert hat; eigens geprüft und festgehalten ist das nicht.

Sicherung, falls Baserow den Filter nicht anwendet:

- Der Code behält nur Zeilen, deren `Kennung` genau gleich ist. So wird nie in eine falsche Zeile geschrieben.
- Liefert Baserow mehr als eine Seite, bricht der Code mit einem Fehler ab, statt alle Seiten zu durchsuchen. Sonst wäre „nicht gefunden“ nicht verlässlich.
- Stehen mehrere Zeilen mit derselben Kennung da, gibt es einen Fehler und es wird nichts geschrieben.
- Lehnt Baserow den Spaltennamen ab, erscheint „Baserow antwortet beim Suchen der Karte mit Status 400.“ Ausweichweg wäre die Feld-Nummer von `Kennung`.

### Oberfläche

- **„Wein aufnehmen“** (`app/aufnehmen/aufnahme.tsx`): Nach „Gespeichert“ erscheint unter „Gerade aufgenommen“ je Aufnahme eine Karteikarte, die sich mit dem Ergebnis füllt. Mehrere Lesevorgänge laufen nebeneinander. Der Bereich lebt nur, solange die Seite offen ist. Ist das Lesen beendet (gelesen, nichts gelesen oder gescheitert), führt der Verweis „Karte prüfen“ zur Prüfkarte; solange „Wird gelesen …“ dasteht, gibt es ihn nicht.
- **„Alle Weine“** (`app/weine/page.tsx`, Server Component): Drei Stapel „Noch zu lesen“, „Zu prüfen“, „Geprüft“, darüber eine Übersicht mit den drei Zahlen; darunter der eingeklappte Abschnitt „Ausgelistet ({n})“, der fehlt, wenn keine Karte ausgelistet ist. Die Einordnung macht `einordnen` aus `pruefkarte.ts` (in „Zu prüfen“ Karten mit Unsicherem zuerst). Jede Karte, deren Kennung auf `KENNUNG_MUSTER` passt, ist ein Verweis auf ihre Prüfkarte, ohne Vorabladen (`prefetch={false}`), damit das Öffnen der Liste nicht jede Karte bei Baserow abfragt. Gründe unter „unsicher“ sind für die Anzeige auf 70 Zeichen gekürzt (`kurzerGrund`).
  - Im Stapel „Noch zu lesen“ steht neben dem Verweis „Noch einmal lesen“. Liefert es einen Namen, lädt die Seite ihre Daten neu und die Karte wandert in ihren Stapel; sonst steht ein kurzer Satz im Kästchen.
  - Im Abschnitt „Ausgelistet“ hat jede Zeile „Zurückholen“ (`app/weine/zurueckholen.tsx`). Es schickt `karteBearbeiten(kennung, { aktion: "zurueckholen" })` direkt, ohne Schlange, und lädt danach die Seite neu; ein Fehler steht als „Zurückholen hat nicht geklappt. {Satz}“ an der Zeile.
- **„Prüfkarte“** (`/weine/[kennung]`): siehe nächster Abschnitt.

## Prüfkarte

Auf der Prüfkarte sieht der Inhaber Vorder- und Rückenfoto und darunter die sechzehn Felder in zwei Gruppen („Vom Etikett“, „Von Torsten“). Er berichtigt sie, bestätigt sie einzeln oder alle auf einmal und schließt die Karte ab. Er kann sie auch auslisten, zurückholen oder noch einmal lesen lassen. Jeder Schritt wird sofort gespeichert; eine Schaltfläche „Speichern“ für die ganze Karte gibt es nicht. Welche Regeln dabei gelten, steht in `docs/DATENMODELL.md` („Regeln beim Schreiben (Prüfkarte)“, „Gleichzeitigkeit“).

### Ablauf

```
Browser                                              Server (Next.js, Vercel)
───────                                              ─────────────────────────
/weine/[kennung]  page.tsx (Server Component) ───── store.holen(k, nachsichtig), store.liste() → einordnen()
  └─ pruefkarte.tsx ("use client", key = kennung)
       ├─ schlange.einreihen(aktion)
       │     └─ karteBearbeiten(k, aktion) ──POST /api/weine/[k]/bearbeiten──► route.ts
       │           (eine Anfrage zur Zeit)            ├─ Form prüfen (≤ 10 kB)
       │                                              ├─ store.holen(k)            frisch, streng
       │                                              ├─ anwenden(karte, aktion)   pruefkarte.ts (rein)
       │                                              └─ store.speichern(…)        ein PATCH
       └─ schlange.exklusiv(async () => {
             lesenAnstossen(k) ──────────────────POST /api/weine/[k]/lesen──────► unverändert (Paket 2)
             karteAbrufen(k)   ──────────────────GET  /api/weine/[k]──────────────► store.holen(k) → KartenAnsicht
          })
/weine            page.tsx ── store.liste() → einordnen()  · Zurückholen → karteBearbeiten(k, {aktion:"zurueckholen"})
/aufnehmen        aufnahme.tsx ── Verweis „Karte prüfen“ nach dem Lesen
```

1. **Seite** `/weine/[kennung]`, Server Component. Sie prüft die Kennung, holt die Karte mit `holen(kennung, { herkunft: "nachsichtig" })` und bestimmt über `liste()` und `einordnen()` die nächste Karte aus „Zu prüfen“ für „Nächste Karte prüfen“. Den Rest übernimmt ein Client-Teil, der für jede Kennung neu entsteht (`key = kennung`). Für eine unbekannte Kennung zeigt die Seite selbst „Diese Karte gibt es nicht.“ mit Rück-Link, statt der englischen 404-Seite von Next (D8). Ist `Herkunft` nicht lesbar, zeigt sie die Fotos und die Meldung; Bearbeiten ist dann gesperrt.
2. **Schritt im Browser.** Jeder Schritt (`bestaetigen`, `aendern`, `leeren`, `abschliessen`, `auslisten`, `zurueckholen`) geht über `schlange.einreihen` an `karteBearbeiten`, also als `POST /api/weine/[kennung]/bearbeiten` mit der `Aktion` als JSON.
3. **Schreibroute.** Sie holt die Karte frisch und streng, wendet den Schritt mit `anwenden` an und schreibt einmal mit `speichern`. Zwischen Holen und Schreiben liegt nur reine Rechnung.
4. **Antwort.** Bei Erfolg ersetzt die Seite ihren Stand durch `werte`, `herkunft` und `stand` aus der `BearbeitenAntwort`. Nach dem ersten Rendern lädt sie sich nicht über `router.refresh()` neu; ihr Zustand ändert sich nur durch Antworten der eigenen Routen (D1).
5. **Noch einmal lesen** läuft als `schlange.exklusiv(…)`: Es wartet auf eine laufende Anfrage, ruft dann `lesenAnstossen` und bei Erfolg `karteAbrufen` (`GET /api/weine/[kennung]`) auf. Erst wenn die Seite diesen frischen Stand übernommen hat, gehen die wartenden Schritte hinaus. Die Leseroute selbst ist unverändert aus Paket 2.
6. **Verlassen der Seite.** Bei `pagehide` und beim Abhängen des Client-Teils (Wechsel innerhalb der App) ruft die Seite `allesSofortAbschicken()` auf: Wartende Schritte gehen sofort mit `keepalive` hinaus (D4).

### Schreibroute: Antworten

`POST /api/weine/[kennung]/bearbeiten`, geschützt durch den Zugangscode (`proxy.ts`). Geprüft wird in dieser Reihenfolge:

1. Datenbank eingerichtet (`weinStore()`), sonst 503.
2. Kennung gegen `KENNUNG_MUSTER`, sonst 404, ohne Baserow aufzurufen.
3. Körper: höchstens 10 kB (10 240 Bytes am gelesenen Text), JSON, vollständige Formprüfung. Daraus entsteht eine saubere `Aktion`; unbekannte Schlüssel fallen weg.
4. `store.holen(kennung)`, streng.
5. `anwenden(karte, aktion, { jahr })`, das Jahr in UTC.
6. `store.speichern(…)`, der einzige Schreibvorgang.
7. 200 mit `BearbeitenAntwort` aus der Karte, wie `speichern` sie liefert.

| Code | Anlass | Text bzw. Körper |
| --- | --- | --- |
| 200 | Schritt gespeichert, auch wenn einzelne Felder nicht bestätigt wurden | `BearbeitenAntwort`: `{ kennung, stand, werte, herkunft, nichtBestaetigt, zurueckgefallen? }` |
| 400 | kein JSON oder leerer Körper | „Der Schritt fehlt oder ist kein gültiges JSON.“ |
| 400 | Körper ist kein Objekt | „Der Schritt hat die falsche Form.“ |
| 400 | unbekannte `aktion` | „Diesen Schritt gibt es nicht.“ |
| 400 | Feld gehört nicht zur Prüfkarte | „Dieses Feld gibt es auf der Prüfkarte nicht.“ |
| 400 | `wert` ist kein Text | „Der Wert muss Text sein.“, mit `feld` |
| 400 | `bestaetigen` mit keinem oder mehr als 16 Einträgen | „Bitte 1 bis 16 Felder auf einmal bestätigen.“ |
| 400 | Feld doppelt in einem Schritt | „Jedes Feld darf in einem Schritt nur einmal vorkommen.“, mit `feld` |
| 400 | ungültiger Wert bei `aendern` | Meldung des Feldes (siehe `DATENMODELL.md`, „Eingaben“), mit `feld` |
| 401 | nicht angemeldet (macht `proxy.ts`) | „nicht angemeldet“ |
| 404 | Kennung hat nicht die Form `wk-…` oder steht nicht in Baserow | „Diese Karte gibt es nicht.“ |
| 409 | Abschließen nicht möglich | „Es fehlen noch: … .“ und/oder „Noch nicht bestätigt: … .“, mit `fehlend` |
| 409 | Karte ist ausgelistet | „Die Karte ist ausgelistet. Hole sie zuerst zurück.“ |
| 413 | Körper größer als 10 kB | „Der Schritt ist zu groß.“ |
| 502 | Fehler beim Holen (Baserow, `Herkunft` nicht lesbar, Lesespalte fehlt) | Satz aus `baserow.ts`, sonst „Die Karte ließ sich nicht aus der Datenbank holen.“ |
| 502 | unerwarteter Fehler in `anwenden` | „Der Schritt ließ sich nicht verarbeiten. Es wurde nichts gespeichert.“ |
| 502 | Fehler beim Speichern (Baserow, Spalte fehlt) | Satz aus `baserow.ts`, sonst „Der Schritt ließ sich nicht in der Datenbank speichern.“ |
| 503 | Datenbank nicht eingerichtet | „Die Datenbank ist nicht eingerichtet.“ |

- 409 heißt: Der Zustand der Karte lässt den Schritt nicht zu. Bei „Abschließen nicht möglich“ auf einer schon geprüften Karte schreibt die Route vorher noch `Stand` = `aufgenommen` („Stand bleibt wahr“, D7); die Antwort 409 trägt keinen Stand.
- Sätze aus `baserow.ts` sind etwa „Die Spalte „Preis Glas“ fehlt in Baserow.“, „In der Spalte „Herkunft“ steht Text, der sich nicht lesen lässt. Bitte die Spalte in Baserow prüfen.“, „Baserow ist nicht erreichbar.“ oder „Baserow lehnt das Schreiben der Karte ab (Status 503).“ Verschwindet die Karte zwischen Holen und Schreiben, kommt „Diese Karte gibt es nicht.“ mit 502.
- Fehler kommen immer als `{ "fehler": "…" }`, bei 400 und 409 gegebenenfalls mit `feld` bzw. `fehlend`; nie Rohantworten oder Stacktraces.
- **Protokoll:** eine Zeile je Fehler, `[bearbeiten] kennung=… aktion=… schritt=… status=… fehler=…` mit dem Schritt `kennung`, `koerper`, `form`, `holen`, `anwenden` oder `speichern` und der Art des Fehlers. Bei falscher Kennung steht `kennung=(ungueltig)`. Nie Werte.

### Abrufroute: Antworten

`GET /api/weine/[kennung]` liefert den frischen Stand einer Karte, damit die Prüfkarte nach „Noch einmal lesen“ alle Werte und die ganze Herkunft hat (`LeseAntwort` reicht dafür nicht). Die Route schreibt nie, holt streng und sendet `Cache-Control: no-store`.

| Code | Anlass | Text bzw. Körper |
| --- | --- | --- |
| 200 | Karte gefunden | `KartenAnsicht`: `{ kennung, stand, werte, herkunft }` |
| 401 | nicht angemeldet (macht `proxy.ts`) | „nicht angemeldet“ |
| 404 | Kennung hat nicht die Form `wk-…` (ohne Anfrage an Baserow) oder steht nicht in Baserow | „Diese Karte gibt es nicht.“ |
| 502 | Fehler in Baserow, `Herkunft` nicht lesbar, Lesespalte fehlt | Satz aus `baserow.ts`, sonst „Die Karte ließ sich nicht aus der Datenbank holen.“ |
| 503 | Datenbank nicht eingerichtet | „Die Datenbank ist nicht eingerichtet.“ |

Protokoll wie bei der Schreibroute, als `[abrufen] … aktion=abrufen schritt=holen …`.

### Datenschicht (`WeinStore.speichern` und `holen` nachsichtig)

- `speichern(kennung, { felder, herkunft, stand? })` ist die zweite und einzige neue Schreibmethode; `aktualisieren` für das Lesen bleibt unverändert. Sie schreibt nur Spalten aus `PRUEF_FELDER`, `Herkunft` (als Ganzes) und, wenn angegeben, `Stand`; `null` leert eine Spalte. Vor dem Schreiben prüft sie, dass jede zu schreibende Spalte in Baserow vorhanden ist, denn Baserow übergeht unbekannte Spalten still. Fehlt eine, wird nichts geschrieben, und der Fehler nennt die Spalte. Dann folgt genau ein `PATCH`. Die Rückgabe entsteht aus der Antwort des `PATCH` (streng, ohne zweites Holen), nachdem geprüft ist, dass sie die Spalten und dieselbe Kennung trägt.
- `holen(kennung, { herkunft: "nachsichtig" })` benutzt nur die Seite: Ist der Text in `Herkunft` nicht lesbar, kommt die Karte ohne `herkunft` zurück statt mit einem Fehler, damit die Fotos trotzdem erscheinen. Voreinstellung bleibt `streng`; Leseroute, Schreibroute und Abrufroute holen streng.
- Die drei Inhaberspalten sind beim Holen nicht Pflicht. Fehlt eine, gilt sie als leer; erst ein Schritt, der sie schreibt, scheitert mit „Die Spalte „…“ fehlt in Baserow.“ Ebenso `Stand`: Fehlt die Spalte, gilt jede Karte als `aufgenommen`, und jeder Schritt, der den Stand ändert (Abschließen, Auslisten), scheitert.

### Schlange (`lib/weinkartei/schlange.ts`)

Läuft im Browser, ohne React und ohne `server-only`. Die Seite erzeugt mit `schlangeErstellen(kennung)` genau eine Schlange je Karte; sie lebt so lange wie der Client-Teil.

- `einreihen(aktion, { beimStart? })`: reiht einen Schritt ein und erfüllt sich mit dessen Ergebnis. Es geht immer nur eine Anfrage zur Zeit hinaus, in der Reihenfolge der Tipps. `beimStart` meldet, wann die Anfrage wirklich hinausgeht; bis dahin zeigt die Seite bei einem Schritt hinter dem Lesen „wartet auf das Lesen …“, danach „Speichert …“. Das Promise wird nie verworfen; jeder Fehler kommt als Ergebnis zurück.
- `exklusiv(arbeit)`: startet nach der laufenden Anfrage; bis `arbeit` fertig ist (auch wenn sie scheitert), geht kein Schritt hinaus. In `arbeit` darf nicht auf `einreihen` gewartet werden.
- `allesSofortAbschicken()`: schickt alle wartenden Schritte sofort mit `keepalive` ab, auch während ein `exklusiv` läuft. Direkt aufeinanderfolgende `bestaetigen` werden zu einer Anfrage zusammengelegt (je Feld der letzte gesehene Wert, höchstens 16 Felder, `BESTAETIGEN_MAX_EINTRAEGE`); andere Schritte gehen einzeln und gleichzeitig. Die laufende Anfrage wird nicht abgebrochen. Wartende `exklusiv` bleiben stehen. Neue Schritte warten danach, bis alle sofort abgeschickten Anfragen zurück sind.

### Aufruf aus dem Browser (`lib/weinkartei/karte-bearbeiten.ts`)

`karteBearbeiten(kennung, aktion, { keepalive? })` und `karteAbrufen(kennung)` werfen nie, wie `lesenAnstossen`. Fehler kommen als ganzer deutscher Satz zurück, bei der Schreibroute mit `feld` bzw. `fehlend`. Den Satz der Route reichen sie durch; sonst gilt:

- 401 → „Bitte melde dich neu an.“
- Netzfehler → „Keine Verbindung. Bitte noch einmal versuchen.“ (mit `netz: true`)
- Antwort ohne JSON → „Der Server hat nicht rechtzeitig geantwortet.“
- Fehlerstatus ohne Satz → „Der Server hat einen Fehler gemeldet.“
- JSON in falscher Form → „Die Antwort des Servers war unbrauchbar.“

`karteAbrufen` fragt ohne Zwischenspeicher an (`cache: "no-store"`). Prüfkarte und „Zurückholen“ in „Alle Weine“ benutzen dieselbe Funktion.

## Sprachmodell

- Zugang über OpenRouter; Schlüssel in `OPENROUTER_API_KEY`, Modell in `MODELL_ID`. Kein Modellname im Code.
- Voreinstellung `google/gemini-3.1-flash-lite`: in einem öffentlichen Vergleich von 14 Modellen an 200 Bildern (28.09.2026) vorn bei der Texterkennung, rund 0,09 US-Cent je Bild. Nicht an echten Weinetiketten erprobt.
- Zum Vergleich vorgesehen: `anthropic/claude-haiku-5.5`.
- Jede Anfrage verlangt eine feste Antwortstruktur und setzt `provider.require_parameters` auf `true`, damit nur Anbieter antworten, die das können.

## Schriften

- Webschriften kommen als Pakete von Fontsource und werden mit der App ausgeliefert; kein Abruf bei Dritten.
- Gesetzt: Bricolage Grotesque (variabel, 200–800) für Überschriften und Schaltflächen (`@fontsource-variable/bricolage-grotesque`).
- Fließtext: Inter (variabel, `@fontsource-variable/inter`), beide importiert in `app/layout.tsx`. In `app/globals.css` gilt `--schrift-text: "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif;`, die Systemschrift bleibt also Ersatz.

## Noch offen

- Echte Anmeldung je Person; bis dahin ein gemeinsamer Zugangscode (`proxy.ts`, `lib/zugang.ts`).
- Übrige Schriften und Logo für die Vorlagen der Ausgaben.
- **Lesen an echten Etiketten.** Laut Briefing zu Paket 3 ist das Lesen am 17.11.2026 gegen echte Dienste gelaufen; eine Mineralwasserflasche wurde richtig als „kein Wein“ gemeldet, nichts erfunden. Welche Einzelheiten dabei geprüft wurden (Modell, Filter auf `Kennung`, Antwortstruktur), ist hier nicht festgehalten. Offen bleibt, wie zuverlässig das Modell an vielen echten Weinetiketten und an schwer lesbaren Fotos liest. Erfindet es dort Angaben, wird zuerst der Auftrag geschärft; hilft das nicht, wird das Vergleichsmodell vorgeschlagen, nicht still gewechselt. Echte Fotos gehören nicht ins Repository.
- **Antwortstruktur:** Das Schema schreibt „Text oder nichts“ als Liste (`type: ["string", "null"]`). Ausweichform wäre `anyOf` mit `null`, falls ein Anbieter die Liste ablehnt (etwa nach einem Modellwechsel); umgebaut wird nur nach Rücksprache.
- **Prüfkarte nur gegen Attrappen erprobt.** Paket 3 ist bisher nur gegen eine nachgebildete Baserow erprobt, nicht gegen die echte Tabelle und nicht am Handy. Unerprobt sind insbesondere der `PATCH` von `speichern` mit `Stand` und den Inhaberspalten gegen echtes Baserow und das sofortige Abschicken mit `keepalive` beim Verlassen der Seite am Handy.
- **Gleichzeitigkeit, Fall 3:** Ein Lesen von anderer Stelle (anderes Gerät, Lesen direkt nach dem Aufnehmen) kann eine Bestätigung der Prüfkarte überschreiben oder umgekehrt (Fenster A und B). Ganz schließen ließe sich das nur mit einer Sperre außerhalb von Baserow oder einer eigenen Spalte je Herkunftseintrag. Beschrieben in `docs/DATENMODELL.md`, „Gleichzeitigkeit“.
- **Restlücke beim Verlassen der Seite (D4):** Wartende Schritte gehen beim Verlassen gleichzeitig hinaus und können einander überschreiben. Dasselbe gilt für Schritte auf derselben Karte aus zwei Fenstern oder von zwei Geräten. Beschrieben ebenda.
- **`keepalive` am Handy:** Ob das Lesen nach einem Seitenwechsel am Handy zuverlässig zu Ende läuft, ist offen. Wenn nicht, wäre ein Anstoß auf dem Server (`after()` in `POST /api/weine`) die Alternative; das weicht vom Briefing ab und braucht vorher Rücksprache.
- **Schreibweise des Landes:** bis zur Entscheidung „wie gedruckt“ („France“, „Italia“), nicht übersetzt.
