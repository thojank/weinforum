# Weinkartei

Kleine Web-App für das Weinforum in Groß Lafferde: Weine per Foto erfassen, prüfen und danach überall verwenden – Weinliste, Monatsplakat, Preisschild, Beitrag.

## Stand

Gebaut sind Zugangscode, Aufnehmen (Paket 1), Lesen (Paket 2) und die Prüfkarte (Paket 3).

- Zwei Fotos am Handy legen eine Karte „aufgenommen“ in Baserow an.
- Gleich danach liest ein Sprachmodell die Etiketten und trägt ein, was dort gedruckt steht. Unlesbares bleibt leer. Je Angabe hält die App fest, woher sie stammt und ob sie bestätigt ist.
- Unter „Gerade aufgenommen“ zeigt die Seite je Aufnahme eine Karteikarte mit dem Ergebnis und, sobald das Lesen beendet ist, den Verweis „Karte prüfen“.
- Auf der **Prüfkarte** (`/weine/[kennung]`) stehen Vorder- und Rückenfoto über den sechzehn Feldern. Der Inhaber berichtigt Angaben, bestätigt sie einzeln („Stimmt so“) oder alle auf einmal („Alles stimmt so“), trägt Preise und Kurztext ein und schließt die Karte mit „Karte ist geprüft“ ab. Jeder Schritt wird sofort gespeichert. Karten lassen sich dort auch auslisten, zurückholen und noch einmal lesen.
- „Alle Weine“ ordnet die Karten in drei Stapel: Noch zu lesen, Zu prüfen, Geprüft; ausgelistete Karten stehen in einem eingeklappten Abschnitt und lassen sich zurückholen. Jede Karte führt zu ihrer Prüfkarte.
- Das Lesen ist am 17.11.2026 gegen echte Dienste gelaufen, aber noch nicht an vielen echten Weinetiketten erprobt.
- Die Prüfkarte ist bisher nur gegen eine nachgebildete Baserow erprobt, noch nicht gegen die echte Tabelle.
- Noch offen sind unter anderem die Ausgaben (Monatsplakat, Weinliste, Preisschild) und die Beschreibung durch das Sprachmodell; mehr in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md), „Noch offen“.

## Einrichten

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev                  # http://localhost:3000
```

- `npm run typecheck` prüft die Typen.
- `npm run build` baut die App wie auf Vercel.
- `/api/health` zeigt, ob Datenbank und Modell eingerichtet sind.

## Datenbank

Baserow. Schritt für Schritt in [docs/EINRICHTEN.md](docs/EINRICHTEN.md); die Spalten beschreibt [docs/DATENMODELL.md](docs/DATENMODELL.md), eine Importvorlage liegt in `docs/weine-vorlage.csv`.

## Betrieb

Vercel, Region Frankfurt (`vercel.json`). Repository mit Vercel verbinden und die Variablen aus `.env.example` dort anlegen.

## Aufbau

```
app/                 Seiten und Server-Routen
lib/weinkartei/      Typen, Datenschicht (Baserow dahinter), Lesen, Prüfen, Regeln der Prüfkarte
docs/                Architektur, Datenmodell, Einrichten
docs/briefings/      Aufträge der Arbeitspakete
```

Mehr in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

## Regeln

- Keine Geheimnisse, keine echten Daten, keine Fotos ins Repository.
- Die KI füllt Felder, der Inhaber bestätigt auf der Prüfkarte. Nur Bestätigtes erscheint in Ausgaben.
