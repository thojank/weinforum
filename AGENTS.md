# Hinweise für KI-Assistenten und Mitentwickler

- Sprache in Oberfläche, Kommentaren und Doku: Deutsch. Bezeichner im Code dürfen deutsch sein und folgen den Begriffen aus `docs/DATENMODELL.md`.
- Vor Änderungen `docs/ARCHITEKTUR.md` und `docs/DATENMODELL.md` lesen; nach Änderungen am Datenmodell beide Stellen pflegen: die Doku und `lib/weinkartei/types.ts`.
- Zugriff auf die Datenbank nur über `WeinStore` in `lib/weinkartei/store.ts`.
- Schlüssel nur in Umgebungsvariablen; Code, der sie liest, beginnt mit `import "server-only"`.
- Keine echten Weindaten, Fotos, Kundendaten oder Zugangsdaten einchecken.
- Klein bleiben: keine neue Abhängigkeit ohne Grund.
- Nach jeder Änderung `npm run typecheck` und `npm run build`.
- Arbeitspakete stehen als Briefing unter `docs/briefings/`. Vor dem Start das jeweilige Briefing ganz lesen.
