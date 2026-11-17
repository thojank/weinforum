import { NextResponse } from "next/server";
import { weinStore } from "@/lib/weinkartei/store";
import { anwenden, istPruefFeld, MELDUNGEN, type Angewendet } from "@/lib/weinkartei/pruefkarte";
import {
  KENNUNG_MUSTER,
  PRUEF_FELDER,
  type Aktion,
  type BearbeitenAntwort,
  type PruefFeld,
  type Wein,
} from "@/lib/weinkartei/types";

/** Größter Körper eines Schritts, in Bytes am gelesenen Text. */
const MAX_KOERPER_BYTES = 10 * 1024;

/** Höchstens so viele Felder bestätigt ein Schritt auf einmal. */
const MAX_BESTAETIGEN = PRUEF_FELDER.length;

const AKTIONEN: readonly Aktion["aktion"][] = [
  "bestaetigen",
  "aendern",
  "leeren",
  "abschliessen",
  "auslisten",
  "zurueckholen",
];

/** Fehlerklassen, deren Text die Bausteine in `lib/weinkartei/` selbst als ganzen Satz schreiben. */
const EIGENE_FEHLER = new Set(["Error"]);

/** Sätze, wenn ein Schritt mit etwas Unerwartetem scheitert. */
const ERSATZ = {
  holen: "Die Karte ließ sich nicht aus der Datenbank holen.",
  anwenden: "Der Schritt ließ sich nicht verarbeiten. Es wurde nichts gespeichert.",
  speichern: "Der Schritt ließ sich nicht in der Datenbank speichern.",
} as const;

/** Sätze zur Form des Körpers. */
const FORM = {
  zuGross: "Der Schritt ist zu groß.",
  keinJson: "Der Schritt fehlt oder ist kein gültiges JSON.",
  keinObjekt: "Der Schritt hat die falsche Form.",
  unbekannteAktion: "Diesen Schritt gibt es nicht.",
  wertKeinText: "Der Wert muss Text sein.",
  felderAnzahl: `Bitte 1 bis ${MAX_BESTAETIGEN} Felder auf einmal bestätigen.`,
  feldDoppelt: "Jedes Feld darf in einem Schritt nur einmal vorkommen.",
} as const;

type Schritt = "kennung" | "koerper" | "form" | keyof typeof ERSATZ;

/** Eine Zeile je Fehler: Kennung, Aktion, Schritt, Status, Art. Nie Werte, nie Rohantworten. */
function protokoll(kennung: string, aktion: string, schritt: Schritt, status: number, art: string): void {
  console.warn(`[bearbeiten] kennung=${kennung} aktion=${aktion} schritt=${schritt} status=${status} fehler=${art}`);
}

function fehler(text: string, status: number, extra?: { feld?: PruefFeld; fehlend?: PruefFeld[] }) {
  return NextResponse.json({ fehler: text, ...extra }, { status });
}

/** Satz aus einem geworfenen Wert: eigener Satz aus `lib/weinkartei/` oder der feste Satz des Schritts. */
function alsSatz(wert: unknown, schritt: keyof typeof ERSATZ): string {
  const eigen = wert instanceof Error && EIGENE_FEHLER.has(wert.name) && wert.message.trim() !== "";
  return eigen ? wert.message : ERSATZ[schritt];
}

function artVon(wert: unknown): string {
  return wert instanceof Error ? wert.name : typeof wert;
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

type Formpruefung = { art: "ok"; aktion: Aktion } | { art: "fehler"; text: string; feld?: PruefFeld };

/**
 * Prüft die Form des Körpers vollständig und baut daraus eine saubere `Aktion`; unbekannte
 * Schlüssel fallen weg. Ob ein Wert gültig ist, entscheidet erst `anwenden`.
 */
function formPruefen(daten: unknown): Formpruefung {
  if (!istObjekt(daten)) return { art: "fehler", text: FORM.keinObjekt };
  const aktion = AKTIONEN.find((a) => a === daten.aktion);
  if (!aktion) return { art: "fehler", text: FORM.unbekannteAktion };

  switch (aktion) {
    case "bestaetigen": {
      const felder = daten.felder;
      if (!Array.isArray(felder) || felder.length < 1 || felder.length > MAX_BESTAETIGEN) {
        return { art: "fehler", text: FORM.felderAnzahl };
      }
      const sauber: { feld: PruefFeld; wert: string }[] = [];
      const gesehen = new Set<PruefFeld>();
      for (const eintrag of felder) {
        if (!istObjekt(eintrag)) return { art: "fehler", text: FORM.keinObjekt };
        if (!istPruefFeld(eintrag.feld)) return { art: "fehler", text: MELDUNGEN.unbekanntesFeld };
        if (typeof eintrag.wert !== "string") return { art: "fehler", text: FORM.wertKeinText, feld: eintrag.feld };
        if (gesehen.has(eintrag.feld)) return { art: "fehler", text: FORM.feldDoppelt, feld: eintrag.feld };
        gesehen.add(eintrag.feld);
        sauber.push({ feld: eintrag.feld, wert: eintrag.wert });
      }
      return { art: "ok", aktion: { aktion, felder: sauber } };
    }
    case "aendern":
      if (!istPruefFeld(daten.feld)) return { art: "fehler", text: MELDUNGEN.unbekanntesFeld };
      if (typeof daten.wert !== "string") return { art: "fehler", text: FORM.wertKeinText, feld: daten.feld };
      return { art: "ok", aktion: { aktion, feld: daten.feld, wert: daten.wert } };
    case "leeren":
      if (!istPruefFeld(daten.feld)) return { art: "fehler", text: MELDUNGEN.unbekanntesFeld };
      return { art: "ok", aktion: { aktion, feld: daten.feld } };
    default:
      return { art: "ok", aktion: { aktion } };
  }
}

/** Antwort 200 aus der Karte, wie `speichern` sie geliefert hat. */
function antwortAus(karte: Wein, a: Extract<Angewendet, { art: "ok" }>): BearbeitenAntwort | null {
  if (!karte.herkunft) return null;
  const antwort: BearbeitenAntwort = {
    kennung: karte.kennung,
    stand: karte.stand,
    werte: karte.pruefwerte ?? {},
    herkunft: karte.herkunft,
    nichtBestaetigt: a.nichtBestaetigt,
  };
  if (a.zurueckgefallen) antwort.zurueckgefallen = a.zurueckgefallen;
  return antwort;
}

// Ein Schritt der Prüfkarte: frisch holen, rein rechnen, einmal schreiben.
export async function POST(request: Request, { params }: { params: Promise<{ kennung: string }> }) {
  // 1. Datenbank
  const store = weinStore();
  if (!store) {
    return fehler("Die Datenbank ist nicht eingerichtet.", 503);
  }

  // 2. Kennung; bei falschem Muster ohne Anfrage an Baserow.
  const { kennung } = await params;
  if (!KENNUNG_MUSTER.test(kennung)) {
    protokoll("(ungueltig)", "-", "kennung", 404, "muster");
    return fehler("Diese Karte gibt es nicht.", 404);
  }

  // 3. Körper: höchstens 10 kB, JSON, Form vollständig prüfen.
  let text: string;
  try {
    text = await request.text();
  } catch (wert) {
    protokoll(kennung, "-", "koerper", 400, artVon(wert));
    return fehler(FORM.keinJson, 400);
  }
  if (new TextEncoder().encode(text).byteLength > MAX_KOERPER_BYTES) {
    protokoll(kennung, "-", "koerper", 413, "zu-gross");
    return fehler(FORM.zuGross, 413);
  }
  let daten: unknown;
  try {
    daten = JSON.parse(text);
  } catch {
    protokoll(kennung, "-", "koerper", 400, "kein-json");
    return fehler(FORM.keinJson, 400);
  }
  const form = formPruefen(daten);
  if (form.art === "fehler") {
    const name = istObjekt(daten) ? AKTIONEN.find((a) => a === daten.aktion) ?? "-" : "-";
    protokoll(kennung, name, "form", 400, "form");
    return fehler(form.text, 400, form.feld ? { feld: form.feld } : undefined);
  }
  const aktion = form.aktion;
  const name = aktion.aktion;

  // 4. Frischer Stand, streng.
  let karte: Wein | null;
  try {
    karte = await store.holen(kennung);
  } catch (wert) {
    protokoll(kennung, name, "holen", 502, artVon(wert));
    return fehler(alsSatz(wert, "holen"), 502);
  }
  if (!karte) {
    protokoll(kennung, name, "holen", 404, "unbekannt");
    return fehler("Diese Karte gibt es nicht.", 404);
  }

  // 5. Reine Rechnung; das Jahr setzt die Route (UTC).
  let a: Angewendet;
  try {
    a = anwenden(karte, aktion, { jahr: new Date().getUTCFullYear() });
  } catch (wert) {
    protokoll(kennung, name, "anwenden", 502, artVon(wert));
    return fehler(ERSATZ.anwenden, 502);
  }

  if (a.art === "abgelehnt") {
    // D7: Stand bleibt wahr, auch wenn der Schritt abgelehnt wird.
    if (a.schreiben) {
      try {
        await store.speichern(kennung, a.schreiben);
      } catch (wert) {
        protokoll(kennung, name, "speichern", 502, artVon(wert));
        return fehler(alsSatz(wert, "speichern"), 502);
      }
    }
    protokoll(kennung, name, "anwenden", a.status, a.status === 409 ? "abgelehnt" : "ungueltig");
    const extra: { feld?: PruefFeld; fehlend?: PruefFeld[] } = {};
    if (a.feld) extra.feld = a.feld;
    if (a.fehlend) extra.fehlend = a.fehlend;
    return fehler(a.fehler, a.status, extra);
  }

  // 6. Der einzige Schreibvorgang.
  let gespeichert: Wein;
  try {
    gespeichert = await store.speichern(kennung, { felder: a.felder, herkunft: a.herkunft, stand: a.stand });
  } catch (wert) {
    protokoll(kennung, name, "speichern", 502, artVon(wert));
    return fehler(alsSatz(wert, "speichern"), 502);
  }

  // 7. Antwort aus der gespeicherten Karte.
  const antwort = antwortAus(gespeichert, a);
  if (!antwort) {
    protokoll(kennung, name, "speichern", 502, "ohne-herkunft");
    return fehler(ERSATZ.speichern, 502);
  }
  return NextResponse.json(antwort);
}
