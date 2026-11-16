# Datenmodell

Arbeitsstand für Stufe 1. Die Tabelle wird in Baserow von Hand angelegt; die Spaltennamen müssen genau so heißen, weil `lib/weinkartei/baserow.ts` sie liest.

## Tabelle „Weine“ (eine Zeile je Flasche: Wein, Jahrgang, Flaschengröße)

| Spalte | Typ in Baserow | Zuerst aus | Pflicht zum Bestätigen |
| --- | --- | --- | --- |
| Kennung | Text | App (eigene, stabile Kennung) | ja |
| Name | Text | Etikett vorne | ja |
| Erzeuger | Text | Etikett hinten | ja |
| Art | Auswahl: Schaumwein, Weiß, Rosé, Rot, Süßwein, alkoholfrei, Sonstiges | Etikett oder Inhaber | ja |
| Rebsorten | Text | Etikett | ja, sonst „Cuvée“ |
| Jahrgang | Text | Etikett | ja, sonst „ohne“ |
| Land | Text | Etikett | ja |
| Region | Text | Etikett | nein |
| Qualitätsstufe | Text | Etikett | nein |
| Alkohol | Zahl (% vol) | Etikett hinten | ja |
| Flaschengröße | Zahl (ml) | Etikett | ja |
| Geschmacksangabe | Text | Etikett | nein |
| Süße, Säure, Körper | je Zahl 1–5 | KI-Vorschlag, dann Inhaber | ja |
| Farbe, Aroma, Geschmack | je langer Text | KI-Vorschlag („typisch für“) | nein |
| Passt zu | Langer Text | KI-Vorschlag | nein |
| Trinktemperatur | Text | KI-Vorschlag | nein |
| Kurztext kurz, Kurztext lang | je langer Text | KI-Vorschlag | nein |
| Verkostungsnotiz | Langer Text | Inhaber | nein |
| Allergene | Text | Etikett | nein |
| E-Label | Link | QR-Code | nein |
| EAN | Text | Strichcode | nein |
| Artikelcode | Text | Bestandssystem | später |
| Preis Flasche, Preis Glas | je Zahl (€) | Inhaber, später Kasse | Flasche ja |
| Foto vorne, Foto hinten | je Datei | Aufnahme | ja |
| Herkunft | Langer Text (JSON: Feld → Herkunft und Stand) | App | – |
| Stand | Auswahl: aufgenommen, geprueft, ausgelistet | App | – |

## Regeln

- Lesen vor Vermuten: Etikett, dann E-Label, dann Händler, zuletzt KI. Unlesbares bleibt leer.
- Jede Angabe hat Herkunft und Stand. Nur Bestätigtes erscheint in Ausgaben.
- Fachliche Regeln liegen in der App, nicht in Formeln der Datenbank.
- Keine Kundendaten in dieser Tabelle.

Weitere Tabellen (Monatsauswahl, Ausgaben, Rückmeldungen) folgen mit Stufe 2 und 3.
