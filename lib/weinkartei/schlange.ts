// Schlange für die Schritte einer Karte (Gleichzeitigkeit, Regeln 1 bis 3). Baserow kennt kein
// bedingtes Schreiben, und `Herkunft` wird von jedem Schreiber ganz zurückgeschrieben. Deshalb geht
// je Karte immer nur eine Anfrage zur Zeit hinaus. Kein React, kein `server-only`, nur relative
// Importe: Das Modul lässt sich mit `tsc` übersetzen und mit `node` prüfen.
import { karteBearbeiten, type BearbeitenErgebnis } from "./karte-bearbeiten";
import { TEXT_UNBEKANNTER_FEHLER } from "./lesen-anstossen";
import type { Aktion, PruefFeld } from "./types";

export type Senden = (
  kennung: string,
  aktion: Aktion,
  o: { keepalive: boolean },
) => Promise<BearbeitenErgebnis>;

export interface Schlange {
  /** Reiht ein; erfüllt sich mit dem Ergebnis. `beimStart` meldet, wann die Anfrage wirklich hinausgeht. */
  einreihen(aktion: Aktion, o?: { beimStart?: () => void }): Promise<BearbeitenErgebnis>;
  /** Läuft nach der laufenden Anfrage; bis `arbeit` fertig ist, geht kein Schritt hinaus. */
  exklusiv<T>(arbeit: () => Promise<T>): Promise<T>;
  /** pagehide / Abhängen: alle wartenden Schritte sofort mit keepalive (D4). */
  allesSofortAbschicken(): void;
}

/** Höchstzahl der Einträge in einem `bestaetigen`, die die Schreibroute annimmt. */
export const BESTAETIGEN_MAX_EINTRAEGE = 16;

type WartenderSchritt = {
  art: "schritt";
  aktion: Aktion;
  beimStart?: () => void;
  erfuellen: (ergebnis: BearbeitenErgebnis) => void;
};

type WartendeArbeit = { art: "exklusiv"; starten: () => Promise<void> };

type Wartend = WartenderSchritt | WartendeArbeit;

/** Mehrere Schritte, die als eine Anfrage hinausgehen; alle bekommen dasselbe Ergebnis. */
type Gruppe = { aktion: Aktion; schritte: WartenderSchritt[] };

/** Ruft `senden` so auf, dass nie etwas verworfen wird: Jeder Fehler wird zum Ergebnis. */
async function sicherSenden(
  senden: Senden,
  kennung: string,
  aktion: Aktion,
  keepalive: boolean,
): Promise<BearbeitenErgebnis> {
  try {
    return await senden(kennung, aktion, { keepalive });
  } catch {
    return { art: "fehler", text: TEXT_UNBEKANNTER_FEHLER };
  }
}

function meldeStart(schritt: WartenderSchritt): void {
  try {
    schritt.beimStart?.();
  } catch {
    // Ein Fehler im Rückruf der Seite darf die Schlange nicht aufhalten.
  }
}

/**
 * Legt direkt aufeinanderfolgende `bestaetigen` zu einer Anfrage zusammen (D4). Je Feld zählt der
 * letzte gesehene Wert; mehr als `BESTAETIGEN_MAX_EINTRAEGE` verschiedene Felder ergeben eine neue Gruppe.
 */
function zusammenlegen(schritte: WartenderSchritt[]): Gruppe[] {
  const gruppen: Gruppe[] = [];
  let felder: Map<PruefFeld, string> | null = null;
  let offen: WartenderSchritt[] = [];

  const abschliessen = () => {
    if (felder !== null && offen.length > 0) {
      const eintraege = [...felder].map(([feld, wert]) => ({ feld, wert }));
      gruppen.push({ aktion: { aktion: "bestaetigen", felder: eintraege }, schritte: offen });
    }
    felder = null;
    offen = [];
  };

  for (const schritt of schritte) {
    const { aktion } = schritt;
    if (aktion.aktion !== "bestaetigen") {
      abschliessen();
      gruppen.push({ aktion, schritte: [schritt] });
      continue;
    }
    const neue = new Set(aktion.felder.map((eintrag) => eintrag.feld));
    if (felder !== null) {
      const bisher: Map<PruefFeld, string> = felder;
      const zusammen = new Set([...bisher.keys(), ...neue]).size;
      if (zusammen > BESTAETIGEN_MAX_EINTRAEGE) abschliessen();
    }
    const ziel: Map<PruefFeld, string> = felder ?? new Map<PruefFeld, string>();
    for (const { feld, wert } of aktion.felder) ziel.set(feld, wert);
    felder = ziel;
    offen.push(schritt);
  }
  abschliessen();
  return gruppen;
}

/**
 * Erzeugt die Schlange einer Karte. Die Seite hält genau eine je Karte. Ohne `senden` gehen die
 * Schritte über `karteBearbeiten` an die Schreibroute.
 */
export function schlangeErstellen(kennung: string, senden: Senden = karteBearbeiten): Schlange {
  const wartend: Wartend[] = [];
  /** Eine Anfrage der Schlange oder eine `exklusiv`-Arbeit läuft. */
  let belegt = false;
  /** Anfragen aus `allesSofortAbschicken`, die noch unterwegs sind. */
  let sofortUnterwegs = 0;

  const weiter = () => {
    if (belegt || sofortUnterwegs > 0) return;
    const naechster = wartend.shift();
    if (naechster === undefined) return;
    belegt = true;

    const fertig = () => {
      belegt = false;
      weiter();
    };

    if (naechster.art === "exklusiv") {
      void naechster.starten().then(fertig);
      return;
    }
    meldeStart(naechster);
    void sicherSenden(senden, kennung, naechster.aktion, false).then((ergebnis) => {
      naechster.erfuellen(ergebnis);
      fertig();
    });
  };

  return {
    einreihen(aktion, o) {
      return new Promise<BearbeitenErgebnis>((erfuellen) => {
        wartend.push({ art: "schritt", aktion, beimStart: o?.beimStart, erfuellen });
        weiter();
      });
    },

    exklusiv<T>(arbeit: () => Promise<T>): Promise<T> {
      return new Promise<T>((erfuellen, verwerfen) => {
        const starten = async () => {
          try {
            erfuellen(await arbeit());
          } catch (fehler) {
            verwerfen(fehler);
          }
        };
        wartend.push({ art: "exklusiv", starten });
        weiter();
      });
    },

    allesSofortAbschicken() {
      // Nur Schritte; wartende `exklusiv`-Arbeiten bleiben in der Schlange und laufen später.
      const schritte: WartenderSchritt[] = [];
      const bleiben: WartendeArbeit[] = [];
      for (const eintrag of wartend) {
        if (eintrag.art === "schritt") schritte.push(eintrag);
        else bleiben.push(eintrag);
      }
      if (schritte.length === 0) return;
      wartend.splice(0, wartend.length, ...bleiben);

      for (const gruppe of zusammenlegen(schritte)) {
        gruppe.schritte.forEach(meldeStart);
        sofortUnterwegs += 1;
        void sicherSenden(senden, kennung, gruppe.aktion, true).then((ergebnis) => {
          for (const schritt of gruppe.schritte) schritt.erfuellen(ergebnis);
          sofortUnterwegs -= 1;
          weiter();
        });
      }
    },
  };
}
