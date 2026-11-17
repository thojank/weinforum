# Entwicklungspaket 2: Etiketten lesen

Briefing für einen Coding-Assistenten. Stand 17.11.2026. Alles, was du brauchst, steht hier oder in den genannten Dateien; nichts davon setzt Wissen aus früheren Gesprächen voraus.

## Worum es geht

Die Weinkartei ist eine kleine Web-App für einen Weinladen. Der Inhaber fotografiert am Handy Vorder- und Rückenetikett einer Flasche; daraus soll eine geprüfte Karteikarte werden, aus der später Weinliste, Plakat und Preisschild entstehen.

Paket 1 ist fertig und im Betrieb: Zugangscode, Aufnehmen mit zwei Fotos, Ablage in Baserow. Eine neue Karte heißt bisher „(noch nicht gelesen)“ und hat nur Kennung, Stand und Fotos.

**Paket 2 füllt die Karte:** Ein Sprachmodell liest die beiden Fotos und trägt ein, was auf den Etiketten steht. Nicht mehr.

## Zuerst lesen

- `AGENTS.md` – Regeln für dieses Repository
- `docs/ARCHITEKTUR.md` – Bausteine und Grundsätze
- `docs/DATENMODELL.md` – Spalten der Tabelle „Weine“
- `lib/weinkartei/store.ts`, `baserow.ts`, `types.ts` – die Datenschicht
- `app/api/weine/route.ts`, `app/aufnehmen/aufnahme.tsx` – der heutige Ablauf

## Ziel

Nach dem Speichern einer Aufnahme steht die Karte innerhalb weniger Sekunden mit den gelesenen Angaben in Baserow und in der Liste, ohne dass der Inhaber etwas tippt.

## Der wichtigste Grundsatz

**Lesen, nicht vermuten.** Das Modell überträgt nur, was auf den Fotos gedruckt steht. Was nicht lesbar ist, bleibt leer. Es beschreibt den Wein nicht, ergänzt kein Weinwissen und sucht nicht im Netz. Geschmack, Aroma und Speiseempfehlungen sind ein eigenes, späteres Paket.

Grund: In der bisherigen Arbeitsweise im Chat standen Gelesenes und Vermutetes ununterscheidbar nebeneinander. Die Kartei soll für jede Angabe wissen, woher sie stammt.

## Umfang

### 1. Lesen im Hintergrund nach der Aufnahme

- Neue Server-Route, Vorschlag `POST /api/weine/[kennung]/lesen`.
- `aufnahme.tsx` stößt sie nach erfolgreichem Speichern an, ohne den Inhaber warten zu lassen: Die Meldung „Gespeichert“ erscheint sofort, er kann den nächsten Wein aufnehmen. Das Ergebnis des Lesens erscheint darunter nach, zum Beispiel „Gelesen: Name, Jahrgang“ oder „Lesen hat nicht geklappt“.
- Die Route darf bis zu 60 Sekunden laufen (`export const maxDuration = 60`).

### 2. Aufruf des Sprachmodells über OpenRouter

- Adresse: `POST https://openrouter.ai/api/v1/chat/completions`, Kopf `Authorization: Bearer $OPENROUTER_API_KEY`.
- Modell aus `MODELL_ID` (Voreinstellung `google/gemini-3.1-flash-lite`). Nie fest im Code.
- Beide Fotos in einer Nachricht, als Bildteile (`type: "image_url"`). Die Fotos liegen in Baserow unter öffentlichen Adressen; ob du die Adressen übergibst oder die Bilder lädst und als Daten-URL schickst, entscheidest du – begründe die Wahl kurz im Commit.
- Feste Antwortstruktur verlangen: `response_format` vom Typ `json_schema` mit `strict: true`, dazu `provider: { require_parameters: true }`, damit nur Anbieter antworten, die das können.
- `temperature: 0`.
- Die genauen Feldnamen der OpenRouter-Schnittstelle bitte gegen die aktuelle Dokumentation prüfen (https://openrouter.ai/docs); die Angaben hier sind aus der Erinnerung.
- Eigenes Modul, Vorschlag `lib/weinkartei/lesen.ts`, beginnt mit `import "server-only"`.

### 3. Was gelesen wird

Je Feld liefert das Modell den Wert und die Seite, auf der er stand (`vorne` oder `hinten`), oder `null`.

| Feld | Spalte in Baserow | Hinweis |
| --- | --- | --- |
| Name des Weins | `Name` | ohne Erzeuger und Jahrgang |
| Erzeuger oder Abfüller | `Erzeuger` | steht meist hinten |
| Art | `Art` | genau einer von: Schaumwein, Weiß, Rosé, Rot, Süßwein, alkoholfrei, Sonstiges; nur wenn das Etikett es hergibt |
| Rebsorten | `Rebsorten` | mit Komma getrennt |
| Jahrgang | `Jahrgang` | vierstellig, oder „ohne“, wenn ausdrücklich keiner angegeben ist |
| Land | `Land` | |
| Region | `Region` | |
| Qualitätsstufe oder Herkunftsangabe | `Qualitätsstufe` | z. B. Qualitätswein, AOP, Vin de France |
| Alkohol | `Alkohol` | Zahl in % vol mit Punkt, z. B. `12.5` |
| Flaschengröße | `Flaschengröße` | Zahl in ml, z. B. `750` |
| Geschmacksangabe | `Geschmacksangabe` | nur wenn gedruckt: trocken, halbtrocken, lieblich, süß, brut … |
| Allergene | `Allergene` | z. B. „enthält Sulfite“ |
| Strichcode-Nummer | `EAN` | nur wenn die Ziffern unter dem Strichcode lesbar sind |

Zusätzlich liefert das Modell eine kurze Liste `unsicher`: Felder, bei denen es sich nicht sicher ist, mit einem Halbsatz warum.

Die Spalten sind in Baserow Textfelder; alle Werte als Text schreiben.

### 4. Herkunft festhalten

Die Spalte `Herkunft` bekommt ein JSON-Objekt als Text:

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

Die Werte für `herkunft` und `stand` stehen als Typen in `lib/weinkartei/types.ts`.

### 5. Datenschicht erweitern

`WeinStore` bekommt zwei Methoden; die App spricht weiter nie direkt mit Baserow:

- `holen(kennung)` – eine Karte samt Adressen der beiden Fotos
- `aktualisieren(kennung, felder, herkunft)` – schreibt gelesene Felder und die Herkunft

Die Zeile findest du über die Spalte `Kennung`. Wie Baserow nach einem Feldwert filtert, bitte in der Baserow-API-Dokumentation nachsehen und nicht raten.

Der Typ `Wein` in `types.ts` und `docs/DATENMODELL.md` werden mitgepflegt.

### 6. Regeln beim Schreiben

- Der Stand der Karte bleibt `aufgenommen`. Geprüft wird sie erst durch den Inhaber (Paket 3).
- Ein Feld, das der Inhaber schon bestätigt hat (`stand: "bestaetigt"` in der Herkunft), wird nie überschrieben.
- Liefert das Modell keinen Namen, bleibt „(noch nicht gelesen)“ stehen.
- Schlägt das Lesen fehl, bleibt die Karte unverändert; die Fotos gehen nie verloren.

### 7. Oberfläche

- Liste `/weine`: zeigt Name, Jahrgang, Erzeuger wie bisher; Karten mit unsicheren Feldern bekommen einen kleinen Hinweis.
- Je Karte in der Liste ein Knopf „Noch einmal lesen“ für Karten, die noch „(noch nicht gelesen)“ heißen.
- Keine Bearbeitungsmaske. Die kommt mit der Prüfkarte in Paket 3.
- Texte auf Deutsch, in der Du-Form, kurz. Überschriften und Schaltflächen nutzen `var(--schrift-titel)`.

## Auftrag an das Modell (Entwurf, darf verbessert werden)

> Du bekommst zwei Fotos einer Weinflasche: zuerst das Vorderetikett, dann das Rückenetikett. Übertrage in die vorgegebene Struktur ausschließlich, was auf den Etiketten gedruckt steht.
> Regeln: Rate nichts. Ergänze nichts aus deinem Wissen über Wein, Erzeuger oder Regionen. Ist eine Angabe nicht lesbar oder nicht vorhanden, gib `null` zurück. Gib zu jedem Wert an, ob er vorne oder hinten stand. Schreibe Namen so, wie sie gedruckt sind, mit Akzenten. Nenne unter `unsicher` jedes Feld, bei dem du dir nicht sicher bist, mit einem kurzen Grund.

## Nicht Teil dieses Pakets

- Beschreibung des Weins (Farbe, Aroma, Geschmack, Speisen, Trinktemperatur, Kurztexte)
- Dublettenprüfung
- Prüfkarte, Bearbeiten, „stimmt so“
- Strichcode und QR-Code im Browser auslesen
- Preise, Bestand, Monatsauswahl, Ausgaben
- Echte Anmeldung je Person

## Rahmen

- Next.js 16 (App Router, TypeScript), Betrieb auf Vercel. Die Datei für vorgeschaltete Logik heißt in Next.js 16 `proxy.ts`, nicht `middleware.ts`; sie schützt bereits alle Routen außer den dort genannten Ausnahmen.
- Keine neue Abhängigkeit für dieses Paket. `fetch` genügt.
- Schlüssel nur aus Umgebungsvariablen: `OPENROUTER_API_KEY`, `MODELL_ID`, `BASEROW_API_URL`, `BASEROW_TOKEN`, `BASEROW_TABLE_WEINE`. Sie stehen lokal in `.env.local` und in Vercel. Niemals ausgeben, protokollieren oder einchecken.
- Keine echten Weindaten, Fotos oder Zugangsdaten ins Repository.
- Bezeichner dürfen deutsch sein und folgen den Begriffen aus `docs/DATENMODELL.md`.
- Vercel nimmt je Anfrage rund 4,5 MB an; die Fotos sind bereits auf 1600 Pixel verkleinert.

## Fertig, wenn

1. `npm run typecheck` und `npm run build` laufen fehlerfrei.
2. Lokal mit `npm run dev`: Ein Wein mit zwei Fotos wird aufgenommen, und kurz darauf stehen in Baserow die gelesenen Felder und ein gültiges JSON in `Herkunft`.
3. In `/weine` erscheint die Karte mit ihrem richtigen Namen statt „(noch nicht gelesen)“.
4. Ein Foto ohne Rückenetikett funktioniert; die Felder von hinten bleiben leer.
5. Ein unlesbares Foto (zum Beispiel eine Tischplatte) erzeugt keine erfundenen Angaben: Die Felder bleiben leer, der Name bleibt „(noch nicht gelesen)“.
6. Ohne `OPENROUTER_API_KEY` meldet die Route einen verständlichen Fehler, und die Aufnahme selbst funktioniert weiter.
7. `docs/DATENMODELL.md`, `docs/ARCHITEKTUR.md` und `README.md` beschreiben den neuen Stand.

Punkt 5 ist der wichtigste Test. Wenn das Modell dort Angaben erfindet, ist das Paket nicht fertig.

## Arbeitsweise

- Kleine Commits mit deutscher Beschreibung, was und warum.
- Erst lokal erproben, dann übertragen: Ein Push auf `main` geht sofort in den Betrieb.
- Wenn etwas an diesem Briefing nicht zur Wirklichkeit passt (Schnittstelle anders, Spalte fehlt), nicht stillschweigend umbauen, sondern melden und einen Vorschlag machen.
- Am Ende kurz berichten: was gebaut ist, was erprobt wurde und wie, was offen bleibt.

## Ausblick, nur zur Einordnung

Paket 3: Prüfkarte mit Bearbeiten und „stimmt so“. Paket 4: Beschreibung als gekennzeichneter Vorschlag. Paket 5: Dublettenprüfung über Strichcode. Danach Monatsauswahl und Ausgaben.
