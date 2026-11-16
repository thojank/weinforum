# Weinkartei

Kleine Web-App für das Weinforum in Groß Lafferde: Weine per Foto erfassen, prüfen und danach überall verwenden – Weinliste, Monatsplakat, Preisschild, Beitrag.

Stand: Grundgerüst. Es gibt eine Startseite, eine Liste und eine Statusadresse; Aufnehmen und Prüfen sind noch nicht gebaut.

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

Baserow. Tabelle „Weine“ nach [docs/DATENMODELL.md](docs/DATENMODELL.md) anlegen, einen Datenbank-Token erzeugen und Token sowie Tabellen-ID in `.env.local` eintragen.

## Betrieb

Vercel, Region Frankfurt (`vercel.json`). Repository mit Vercel verbinden und die Variablen aus `.env.example` dort anlegen.

## Aufbau

```
app/                 Seiten und Server-Routen
lib/weinkartei/      Typen und Datenschicht (Baserow dahinter)
docs/                Architektur und Datenmodell
```

Mehr in [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md).

## Regeln

- Keine Geheimnisse, keine echten Daten, keine Fotos ins Repository.
- Die KI füllt Felder, der Inhaber bestätigt. Nur Bestätigtes erscheint in Ausgaben.
