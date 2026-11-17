# Einrichten: Schritt für Schritt

Drei Teile, zusammen etwa 20 Minuten: Baserow, Probe auf dem eigenen Rechner, Vercel. Dazu kommt ein Schlüssel für OpenRouter, damit die App die Etiketten lesen kann. Die Bezeichnungen der Schaltflächen stammen aus den Hilfeseiten von Baserow und Vercel (Stand 16.11.2026) und können leicht abweichen.

## Teil A: Baserow

1. Auf [baserow.io](https://baserow.io) anmelden oder ein kostenloses Konto anlegen.
2. Einen Arbeitsbereich wählen oder anlegen, zum Beispiel „Weinforum“.
3. Darin eine Datenbank anlegen, zum Beispiel „Weinkartei“.
4. In der Datenbank auf **+ Create table** klicken, **Import a CSV file** wählen, als Namen `Weine` eintragen, über **Choose CSV file** die Datei `docs/weine-vorlage.csv` aus diesem Ordner auswählen und mit **Add table** bestätigen.
   - Die erste Zeile der Datei enthält die Spaltennamen. Falls Baserow fragt, ob die erste Zeile die Überschriften sind: ja.
   - Die Namen der Spalten nicht ändern; die App liest sie genau so.
5. Zwei Spalten von Hand ergänzen, weil eine CSV-Datei keine Dateien enthalten kann: `Foto vorne` und `Foto hinten`, jeweils als Feldtyp für Dateien.
   - Außerdem die Spalte `Herkunft` auf den Feldtyp für langen Text umstellen (in Baserow „Long text“). Beim Import kommt sie als einfacher Text an. In ihr hält die App fest, woher jede Angabe stammt.
6. Tabellen-Nummer notieren: Bei geöffneter Tabelle steht sie in der Adresszeile hinter `/table/`. Beispiel: `…/database/456/table/12345/…` → `12345`.
7. Zugangsschlüssel anlegen: oben links auf den Namen des Arbeitsbereichs klicken → **Settings** → Reiter **Database tokens** → **Create token +**. Namen vergeben (zum Beispiel „Weinkartei App“), Arbeitsbereich wählen, **Create token**.
   - Rechte: Erstellen, Lesen und Ändern erlauben; Löschen nicht.
   - Den Schlüssel sofort kopieren. Er wird nach dem Schließen nicht mehr angezeigt.
   - Den Schlüssel nirgends eintragen außer in `.env.local` und in Vercel. Nicht in Chats, Dokumente oder ins Repository.

Ergebnis von Teil A: eine Tabelle `Weine` mit einer Beispielzeile, eine Tabellen-Nummer, ein Schlüssel.

## Zwischenschritt: Schlüssel für das Lesen (OpenRouter)

Ohne diesen Schritt läuft alles außer dem Lesen der Etiketten.

1. Auf [openrouter.ai](https://openrouter.ai) anmelden und etwas Guthaben aufladen.
2. Unter den Einstellungen für API-Schlüssel („Keys“) einen neuen Schlüssel anlegen und sofort kopieren.
   - Den Schlüssel nirgends eintragen außer in `.env.local` und in Vercel.
3. Das Modell steht schon in `.env.example`: `MODELL_ID=google/gemini-3.1-flash-lite`. Es lässt sich dort tauschen, ohne den Code zu ändern.

Die Bezeichnungen bei OpenRouter sind nicht aus deren Hilfeseiten nachgesehen und können abweichen.

## Teil B: Probe auf dem eigenen Rechner

1. Im Terminal in den Projektordner wechseln.
2. Vorlage kopieren: `cp .env.example .env.local`
3. `.env.local` öffnen und drei Zeilen ausfüllen:
   ```
   BASEROW_API_URL=https://api.baserow.io
   BASEROW_TOKEN=der Schlüssel aus A7
   BASEROW_TABLE_WEINE=die Nummer aus A6
   ```
   Für das Lesen dazu diese zwei Zeilen:
   ```
   OPENROUTER_API_KEY=der Schlüssel von OpenRouter
   MODELL_ID=google/gemini-3.1-flash-lite
   ```
   `APP_ZUGANGSCODE` darf auf dem eigenen Rechner leer bleiben.
4. Starten: `npm run dev`
5. Im Browser öffnen:
   - `http://localhost:3000/api/health` → dort muss `"baserow": true` stehen. Für das Lesen außerdem `"modell": true` und unter `modellId` der Name des Modells.
   - `http://localhost:3000/weine` → dort muss der Beispielwein erscheinen.
6. Mit `Ctrl + C` im Terminal beenden.

Wenn `/weine` einen Fehler zeigt: Steht dort „Baserow antwortet mit 401“, stimmt der Schlüssel nicht; bei 404 stimmt die Tabellen-Nummer nicht.

## Teil C: Vercel

1. Auf [vercel.com/new](https://vercel.com/new) anmelden, am einfachsten mit dem GitHub-Konto `thojank`.
2. GitHub verbinden, falls noch nicht geschehen, und Vercel den Zugriff auf das Repository `thojank/weinforum` erlauben.
3. Das Repository `weinforum` auswählen. Vercel erkennt Next.js von selbst; an den Build-Einstellungen nichts ändern.
4. Die Einstellungen aus Teil B eintragen: `BASEROW_API_URL`, `BASEROW_TOKEN`, `BASEROW_TABLE_WEINE`, für das Lesen `OPENROUTER_API_KEY` und `MODELL_ID`, dazu `APP_ZUGANGSCODE` (siehe unten).
   - Wird beim Import ein Abschnitt „Environment Variables“ angeboten, dort eintragen.
   - Sonst nach dem ersten Deploy im Projekt unter **Settings → Environment Variables** eintragen und danach neu deployen.
5. **Deploy** klicken und warten, bis Vercel die Adresse der Seite anzeigt.
6. Prüfen wie in Teil B: `…/api/health` und `…/weine` an die Adresse anhängen.
7. Auf dem Handy die Adresse öffnen und über das Teilen-Menü „Zum Home-Bildschirm“ wählen.

Ab jetzt baut Vercel bei jedem Push auf `main` von selbst neu.

## Wichtig zu wissen

- Zugangscode: In Vercel muss `APP_ZUGANGSCODE` gesetzt sein, sonst zeigt die Seite nur „Zugangscode ist nicht eingerichtet“. Wer die Adresse öffnet, wird nach dem Code gefragt; danach merkt sich der Browser ihn 90 Tage. Auf dem eigenen Rechner läuft die App auch ohne Code.
- Die Spalten `Foto vorne` und `Foto hinten` müssen Dateifelder sein und genau so heißen; `Stand` muss ein Textfeld bleiben, sonst lässt sich kein Wein aufnehmen.
- Die Spalte `Herkunft` muss es geben, als langes Textfeld. Fehlt sie oder eine der Spalten, die das Lesen füllt, meldet das Lesen einen Fehler mit dem Namen der Spalte. Das gilt für die Tabelle im Betrieb und ebenso für eine Tabelle zum Ausprobieren („Weine QA“).
- Fehlt `OPENROUTER_API_KEY` oder `MODELL_ID`, meldet das Lesen, dass es nicht eingerichtet ist, und nennt die fehlende Einstellung, zum Beispiel „Das Lesen ist nicht eingerichtet (OPENROUTER_API_KEY fehlt).“ Das Aufnehmen funktioniert trotzdem weiter; die Karten heißen dann „(noch nicht gelesen)“ und lassen sich später in „Alle Weine“ mit „Noch einmal lesen“ lesen.
- Die Spalten kommen beim Import als Text an und bleiben Text. Nicht auf Auswahl oder Zahl umstellen: Die App schreibt beim Lesen Text hinein. Welche Werte erlaubt sind, prüft die App selbst (siehe `docs/DATENMODELL.md`).
- `Herkunft` nur ändern, wenn man die Form aus `docs/DATENMODELL.md` genau einhält. Ungültiger Text dort sperrt das Lesen dieser Karte.
- Die Beispielzeile kann gelöscht werden, sobald die Probe geklappt hat. Lesen lässt sie sich nicht, weil ihre Kennung nicht die Form der App hat.
- Das Lesen ist noch nicht an echten Etiketten erprobt. Beim ersten Einsatz die gelesenen Angaben mit den Etiketten vergleichen.
