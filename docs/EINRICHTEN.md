# Einrichten: Schritt für Schritt

Drei Teile, zusammen etwa 20 Minuten: Baserow, Probe auf dem eigenen Rechner, Vercel. Die Bezeichnungen der Schaltflächen stammen aus den Hilfeseiten von Baserow und Vercel (Stand 16.11.2026) und können leicht abweichen.

## Teil A: Baserow

1. Auf [baserow.io](https://baserow.io) anmelden oder ein kostenloses Konto anlegen.
2. Einen Arbeitsbereich wählen oder anlegen, zum Beispiel „Weinforum“.
3. Darin eine Datenbank anlegen, zum Beispiel „Weinkartei“.
4. In der Datenbank auf **+ Create table** klicken, **Import a CSV file** wählen, als Namen `Weine` eintragen, über **Choose CSV file** die Datei `docs/weine-vorlage.csv` aus diesem Ordner auswählen und mit **Add table** bestätigen.
   - Die erste Zeile der Datei enthält die Spaltennamen. Falls Baserow fragt, ob die erste Zeile die Überschriften sind: ja.
   - Die Namen der Spalten nicht ändern; die App liest sie genau so.
5. Zwei Spalten von Hand ergänzen, weil eine CSV-Datei keine Dateien enthalten kann: `Foto vorne` und `Foto hinten`, jeweils als Feldtyp für Dateien.
6. Tabellen-Nummer notieren: Bei geöffneter Tabelle steht sie in der Adresszeile hinter `/table/`. Beispiel: `…/database/456/table/12345/…` → `12345`.
7. Zugangsschlüssel anlegen: oben links auf den Namen des Arbeitsbereichs klicken → **Settings** → Reiter **Database tokens** → **Create token +**. Namen vergeben (zum Beispiel „Weinkartei App“), Arbeitsbereich wählen, **Create token**.
   - Rechte: Erstellen, Lesen und Ändern erlauben; Löschen nicht.
   - Den Schlüssel sofort kopieren. Er wird nach dem Schließen nicht mehr angezeigt.
   - Den Schlüssel nirgends eintragen außer in `.env.local` und in Vercel. Nicht in Chats, Dokumente oder ins Repository.

Ergebnis von Teil A: eine Tabelle `Weine` mit einer Beispielzeile, eine Tabellen-Nummer, ein Schlüssel.

## Teil B: Probe auf dem eigenen Rechner

1. Im Terminal in den Projektordner wechseln.
2. Vorlage kopieren: `cp .env.example .env.local`
3. `.env.local` öffnen und drei Zeilen ausfüllen:
   ```
   BASEROW_API_URL=https://api.baserow.io
   BASEROW_TOKEN=der Schlüssel aus A7
   BASEROW_TABLE_WEINE=die Nummer aus A6
   ```
   Die anderen Zeilen bleiben vorerst leer.
4. Starten: `npm run dev`
5. Im Browser öffnen:
   - `http://localhost:3000/api/health` → dort muss `"baserow": true` stehen.
   - `http://localhost:3000/weine` → dort muss der Beispielwein erscheinen.
6. Mit `Ctrl + C` im Terminal beenden.

Wenn `/weine` einen Fehler zeigt: Steht dort „Baserow antwortet mit 401“, stimmt der Schlüssel nicht; bei 404 stimmt die Tabellen-Nummer nicht.

## Teil C: Vercel

1. Auf [vercel.com/new](https://vercel.com/new) anmelden, am einfachsten mit dem GitHub-Konto `thojank`.
2. GitHub verbinden, falls noch nicht geschehen, und Vercel den Zugriff auf das Repository `thojank/weinforum` erlauben.
3. Das Repository `weinforum` auswählen. Vercel erkennt Next.js von selbst; an den Build-Einstellungen nichts ändern.
4. Die drei Einstellungen aus Teil B eintragen: `BASEROW_API_URL`, `BASEROW_TOKEN`, `BASEROW_TABLE_WEINE`.
   - Wird beim Import ein Abschnitt „Environment Variables“ angeboten, dort eintragen.
   - Sonst nach dem ersten Deploy im Projekt unter **Settings → Environment Variables** eintragen und danach neu deployen.
5. **Deploy** klicken und warten, bis Vercel die Adresse der Seite anzeigt.
6. Prüfen wie in Teil B: `…/api/health` und `…/weine` an die Adresse anhängen.
7. Auf dem Handy die Adresse öffnen und über das Teilen-Menü „Zum Home-Bildschirm“ wählen.

Ab jetzt baut Vercel bei jedem Push auf `main` von selbst neu.

## Wichtig zu wissen

- Zugangscode: In Vercel muss `APP_ZUGANGSCODE` gesetzt sein, sonst zeigt die Seite nur „Zugangscode ist nicht eingerichtet“. Wer die Adresse öffnet, wird nach dem Code gefragt; danach merkt sich der Browser ihn 90 Tage. Auf dem eigenen Rechner läuft die App auch ohne Code.
- Die Spalten `Foto vorne` und `Foto hinten` müssen Dateifelder sein und genau so heißen; `Stand` muss ein Textfeld bleiben, sonst lässt sich kein Wein aufnehmen.
- Die Beispielzeile kann gelöscht werden, sobald die Probe geklappt hat.
- Die Spalten kommen beim Import als Text an. Das genügt für den Anfang; Feldtypen wie Auswahl oder Zahl lassen sich später in Baserow umstellen.
