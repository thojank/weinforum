# Architektur

## Bausteine

| Baustein | Technik | Ort |
| --- | --- | --- |
| App fürs Handy und den Rechner | Next.js (App Router, TypeScript) | Vercel, Region Frankfurt |
| Dienst fürs Lesen der Etiketten | Route unter `app/api/` | Vercel, läuft nur auf dem Server |
| Datenbank und sichtbare Tabelle | Baserow | Baserow Cloud |
| Dünne Datenschicht | `lib/weinkartei/store.ts` | im Code |

## Grundsätze

1. Die App spricht nur über `WeinStore` mit der Datenbank. Baserow lässt sich später tauschen.
2. Schlüssel und Tokens liegen ausschließlich in Umgebungsvariablen auf dem Server. Nichts davon gelangt in den Browser oder ins Repository.
3. Das Sprachmodell bekommt je Aufruf genau einen Wein. Lesen und Beschreiben sind getrennte Aufträge.
4. Strichcode und QR-Code liest die App selbst, nicht das Sprachmodell.
5. Zusammenspiel mit dem späteren Bestandssystem über zwei Schlüssel: EAN und eigener Artikelcode.
6. Keine echten Daten und keine Fotos im Repository.

## Stufen

- Stufe 1 Erfassen: Aufnehmen mit zwei Fotos, Lesen, Beschreiben, Dublettenprüfung, Prüfkarte.
- Stufe 2 Verwenden: Monatsauswahl, Weinliste, Monatsplakat, Preisschilder, Suche.
- Stufe 3 Wissen: Verkostungsnotizen, Rückmeldungen, ähnliche Weine.
- Stufe 4 Anbindung an Kasse und Bestandssystem.

## Sprachmodell

- Zugang über OpenRouter; Schlüssel in `OPENROUTER_API_KEY`, Modell in `MODELL_ID`.
- Voreinstellung `google/gemini-3.1-flash-lite`: in einem öffentlichen Vergleich von 14 Modellen an 200 Bildern (28.09.2026) vorn bei der Texterkennung, rund 0,09 US-Cent je Bild. Nicht an echten Weinetiketten erprobt.
- Zum Vergleich vorgesehen: `anthropic/claude-haiku-5.5`.
- Jede Anfrage verlangt eine feste Antwortstruktur und setzt `provider.require_parameters` auf `true`, damit nur Anbieter antworten, die das können.

## Noch offen

- Echte Anmeldung je Person; bis dahin ein gemeinsamer Zugangscode (`proxy.ts`, `lib/zugang.ts`).
- Schriften und Logo für die Vorlagen der Ausgaben.
