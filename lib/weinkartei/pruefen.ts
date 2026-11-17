import {
  ART_TEXTE,
  LESE_FELDER,
  NAME_UNGELESEN,
  type FeldHerkunft,
  type KartenHerkunft,
  type LeseFeld,
  type Modellantwort,
  type PruefFeld,
  type Unsicher,
  type Wein,
} from "./types";

// Prüfen und Zusammenführen der Antwort des Sprachmodells.
// Reine Funktionen: kein Netz, keine Umgebungsvariablen, keine Uhr. Jahr und Zeit kommen als
// Parameter herein, damit sich die Datei auch außerhalb von Next.js ausführen lässt.
// Grundsatz des Inhabers: lieber leer als falsch.

/** Ein geprüfter Wert samt der Seite des Etiketts, auf der er stand. */
export interface GelesenerWert {
  wert: string;
  seite: "vorne" | "hinten";
}

/** Ergebnis von `pruefen`: gültige Werte und die Liste „unsicher“. */
export interface Geprueft {
  werte: Partial<Record<LeseFeld, GelesenerWert>>;
  unsicher: Unsicher[];
}

/** Ergebnis von `zusammenfuehren`: was geschrieben wird und was die Route meldet. */
export interface Zusammengefuehrt {
  /**
   * Alle nicht geschützten Lesespalten, auch unveränderte; `null` leert die Spalte. So passen
   * Spalten und `herkunft` nach dem Schreiben zusammen, auch wenn ein anderer Lauf dazwischen schrieb.
   */
  felder: Partial<Record<LeseFeld, string | null>>;
  herkunft: KartenHerkunft;
  /** Felder, die in diesem Lauf einen Wert bekommen haben; Reihenfolge wie `LESE_FELDER`. */
  gelesen: LeseFeld[];
  /** Je Feld aus `gelesen` der Wert, auch wenn er sich nicht geändert hat. */
  werte: Partial<Record<LeseFeld, string>>;
  /** Felder, die wegen der Schutzregeln nicht angefasst wurden. */
  geschuetzt: LeseFeld[];
}

// ---------------------------------------------------------------------------
// Grenzen und Gründe

export const JAHRGANG_MIN = 1900;
export const JAHRGANG_OHNE = "ohne";
export const ALKOHOL_MIN = 0;
export const ALKOHOL_MAX = 25;
export const FLASCHE_MIN_ML = 50;
export const FLASCHE_MAX_ML = 18000;
export const EAN_LAENGEN: readonly number[] = [8, 12, 13];
export const TEXT_MAX_ZEICHEN = 200;
/** Höchstlänge eines Grundes unter `unsicher` beim Speichern, in Zeichen. */
export const GRUND_MAX_ZEICHEN = 300;

/** Auslassungszeichen am Ende eines gekürzten Textes. */
const AUSLASSUNG = "…";

/** Ersatz, wenn das Modell ein Feld als unsicher meldet, aber keinen Grund nennt. */
export const GRUND_OHNE_ANGABE = "ohne Angabe des Grundes";

/** Gründe für verworfene Werte, wörtlich aus der Produktspezifikation. */
export const GRUENDE = {
  jahrgang: "verworfen: kein gültiger Jahrgang",
  art: "verworfen: keine der sieben Arten",
  alkohol: "verworfen: kein gültiger Alkoholwert",
  flaschengroesse: "verworfen: keine gültige Flaschengröße",
  eanPruefziffer: "verworfen: Prüfziffer stimmt nicht",
  eanUngueltig: "verworfen: keine gültige Strichcode-Nummer",
  zuLang: "verworfen: zu lang",
  seiteFehlt: "verworfen: Seite fehlt",
  keinRuecken: "verworfen: kein Rückenetikett aufgenommen",
} as const;

const ART_WERTE: readonly string[] = Object.values(ART_TEXTE);

/** Herkunftsangaben, die das Lesen selbst schreibt. */
const ETIKETT_HERKUNFT = {
  vorne: "etikett-vorne",
  hinten: "etikett-hinten",
} as const;

// ---------------------------------------------------------------------------
// Prüfen

/** Ergebnis der Prüfung eines einzelnen, schon bereinigten Werts. */
export type Pruefung = { art: "gueltig"; wert: string } | { art: "leer" } | { art: "verworfen"; grund: string };

const LEER: Pruefung = { art: "leer" };

function gueltig(wert: string): Pruefung {
  return { art: "gueltig", wert };
}

function verworfen(grund: string): Pruefung {
  return { art: "verworfen", grund };
}

/** Leerraum an den Rändern entfernen, Folgen von Leerraum zu einem Leerzeichen. */
export function leerraumBereinigen(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Länge in Zeichen (nicht in UTF-16-Einheiten). */
export function zeichenzahl(text: string): number {
  return Array.from(text).length;
}

/** Leerraum und Satzzeichen am Ende, die vor „…“ wegfallen. */
const ENDE_OHNE_WORT = /[\s\p{P}]+$/u;

/**
 * Kürzt einen Text auf höchstens `max` Zeichen (nicht UTF-16-Einheiten). Kürzerer Text bleibt,
 * wie er ist. Längerer Text wird an der letzten Wortgrenze vor der Grenze geschnitten, Leerraum und
 * Satzzeichen am Ende fallen weg, dann folgt „…“. Ein einzelnes Wort, das länger ist als die
 * Grenze, wird hart geschnitten, ebenfalls mit „…“. Für die Anzeige, z. B. `kurzerGrund(grund, 70)`.
 */
export function kurzerGrund(text: string, max: number): string {
  const zeichen = Array.from(text);
  if (zeichen.length <= max) return text;
  if (max < 1) return "";

  // Platz für den Text vor dem Auslassungszeichen.
  const platz = max - 1;
  const kopf = zeichen.slice(0, platz);
  // Steht direkt hinter dem Kopf Leerraum, endet dort ein Wort; sonst die letzte Lücke im Kopf.
  let schnitt = /\s/.test(zeichen[platz] ?? "") ? platz : -1;
  if (schnitt < 0) {
    for (let i = kopf.length - 1; i > 0; i--) {
      if (/\s/.test(kopf[i])) {
        schnitt = i;
        break;
      }
    }
  }

  const amWort = schnitt > 0 ? kopf.slice(0, schnitt).join("").replace(ENDE_OHNE_WORT, "") : "";
  if (amWort !== "") return amWort + AUSLASSUNG;

  // Keine brauchbare Wortgrenze: ein einzelnes, zu langes Wort wird hart geschnitten.
  const hart = kopf.join("");
  return (hart.replace(ENDE_OHNE_WORT, "") || hart) + AUSLASSUNG;
}

/** Kürzen beim Speichern, nach derselben Regel wie `kurzerGrund`. */
function kuerzen(text: string, max: number): string {
  return kurzerGrund(text, max);
}

function istLeseFeld(feld: string): feld is LeseFeld {
  return (LESE_FELDER as readonly string[]).includes(feld);
}

export function pruefeText(wert: string): Pruefung {
  return zeichenzahl(wert) > TEXT_MAX_ZEICHEN ? verworfen(GRUENDE.zuLang) : gueltig(wert);
}

export function pruefeJahrgang(wert: string, jahr: number): Pruefung {
  if (wert === JAHRGANG_OHNE) return gueltig(wert);
  if (!/^\d{4}$/.test(wert)) return verworfen(GRUENDE.jahrgang);
  const zahl = Number(wert);
  return zahl >= JAHRGANG_MIN && zahl <= jahr ? gueltig(wert) : verworfen(GRUENDE.jahrgang);
}

export function pruefeArt(wert: string): Pruefung {
  return ART_WERTE.includes(wert) ? gueltig(wert) : verworfen(GRUENDE.art);
}

/** „12,5 % vol“ → `12.5`, „12.0“ → `12`. Nur eine Zahl von 0 bis 25. */
export function pruefeAlkohol(wert: string): Pruefung {
  const roh = wert
    .replace(/vol\.?/gi, "")
    .replace(/%/g, "")
    .replace(/\s+/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(roh)) return verworfen(GRUENDE.alkohol);
  const zahl = Number(roh);
  if (zahl < ALKOHOL_MIN || zahl > ALKOHOL_MAX) return verworfen(GRUENDE.alkohol);
  // String(Number) schreibt mit Punkt und ohne überflüssige Nullen.
  return gueltig(String(zahl));
}

/** Nur ganze Milliliter; Liter oder Zentiliter werden nicht umgerechnet, sondern verworfen. */
export function pruefeFlaschengroesse(wert: string): Pruefung {
  const roh = wert.replace(/ml/gi, "").replace(/\s+/g, "");
  if (!/^\d+$/.test(roh)) return verworfen(GRUENDE.flaschengroesse);
  const zahl = Number(roh);
  if (zahl < FLASCHE_MIN_ML || zahl > FLASCHE_MAX_ML) return verworfen(GRUENDE.flaschengroesse);
  return gueltig(String(zahl));
}

/** Prüfziffer nach GS1 (Modulo 10): von rechts gewichtet 3, 1, 3, … ohne die Prüfziffer selbst. */
function gs1PruefzifferStimmt(ziffern: string): boolean {
  const nutz = ziffern.slice(0, -1);
  let summe = 0;
  for (let i = 0; i < nutz.length; i++) {
    const ziffer = Number(nutz[nutz.length - 1 - i]);
    summe += i % 2 === 0 ? ziffer * 3 : ziffer;
  }
  const erwartet = (10 - (summe % 10)) % 10;
  return erwartet === Number(ziffern[ziffern.length - 1]);
}

export function pruefeEan(wert: string): Pruefung {
  const roh = wert.replace(/\s+/g, "");
  if (!/^\d+$/.test(roh) || !EAN_LAENGEN.includes(roh.length)) {
    return verworfen(GRUENDE.eanUngueltig);
  }
  return gs1PruefzifferStimmt(roh) ? gueltig(roh) : verworfen(GRUENDE.eanPruefziffer);
}

/** Fachliche Prüfung des schon bereinigten, nicht leeren Werts je Feld. */
function pruefeWert(feld: LeseFeld, wert: string, jahr: number): Pruefung {
  switch (feld) {
    case "Jahrgang":
      return pruefeJahrgang(wert, jahr);
    case "Art":
      return pruefeArt(wert);
    case "Alkohol":
      return pruefeAlkohol(wert);
    case "Flaschengröße":
      return pruefeFlaschengroesse(wert);
    case "EAN":
      return pruefeEan(wert);
    default:
      return pruefeText(wert);
  }
}

/**
 * Prüft ein Feld der Modellantwort: zuerst, ob es überhaupt einen Wert gibt, dann die Seite,
 * dann den Wert selbst. Liefert die gültige Seite mit, falls der Wert gültig ist.
 */
function pruefeFeld(
  feld: LeseFeld,
  roh: { wert: string | null; seite: string | null } | undefined,
  o: { rueckenfoto: boolean; jahr: number },
): { pruefung: Pruefung; seite?: GelesenerWert["seite"] } {
  const wert = typeof roh?.wert === "string" ? leerraumBereinigen(roh.wert) : "";
  if (wert === "") return { pruefung: LEER };

  const seite = roh?.seite;
  if (seite !== "vorne" && seite !== "hinten") return { pruefung: verworfen(GRUENDE.seiteFehlt) };
  if (seite === "hinten" && !o.rueckenfoto) return { pruefung: verworfen(GRUENDE.keinRuecken) };

  return { pruefung: pruefeWert(feld, wert, o.jahr), seite };
}

/**
 * Meldungen des Modells unter „unsicher“: unbekannte Felder fallen weg, `grund` wird bereinigt
 * und auf `GRUND_MAX_ZEICHEN` Zeichen gekürzt, an einer Wortgrenze mit „…“. Je Feld zählt nur die erste Meldung.
 */
function modellMeldungen(roh: Modellantwort["unsicher"]): Map<LeseFeld, string> {
  const meldungen = new Map<LeseFeld, string>();
  for (const eintrag of Array.isArray(roh) ? roh : []) {
    if (typeof eintrag?.feld !== "string" || !istLeseFeld(eintrag.feld)) continue;
    if (meldungen.has(eintrag.feld)) continue;
    const grund = typeof eintrag.grund === "string" ? leerraumBereinigen(eintrag.grund) : "";
    meldungen.set(eintrag.feld, kuerzen(grund === "" ? GRUND_OHNE_ANGABE : grund, GRUND_MAX_ZEICHEN));
  }
  return meldungen;
}

/**
 * Prüft jeden Wert des Modells formal. Was nicht passt, wird verworfen und unter „unsicher“
 * vermerkt, genau einmal je Feld. Hat die App einen Wert verworfen, ersetzt ihr Grund eine
 * Meldung des Modells zum selben Feld. Meldungen des Modells zu Feldern ohne Wert bleiben erhalten.
 */
export function pruefen(a: Modellantwort, o: { rueckenfoto: boolean; jahr: number }): Geprueft {
  const werte: Partial<Record<LeseFeld, GelesenerWert>> = {};
  const unsicher: Unsicher[] = [];
  const meldungen = modellMeldungen(a.unsicher);

  for (const feld of LESE_FELDER) {
    const { pruefung, seite } = pruefeFeld(feld, a.felder?.[feld], o);
    if (pruefung.art === "verworfen") {
      unsicher.push({ feld, grund: pruefung.grund });
      continue;
    }
    if (pruefung.art === "gueltig" && seite) werte[feld] = { wert: pruefung.wert, seite };
    const meldung = meldungen.get(feld);
    if (meldung !== undefined) unsicher.push({ feld, grund: meldung });
  }

  return { werte, unsicher };
}

// ---------------------------------------------------------------------------
// Zusammenführen

/** Herkunft der Karte; fehlt sie oder ist sie unvollständig, gilt sie als leer. */
function alteHerkunft(karte: Wein): KartenHerkunft {
  const h = karte.herkunft;
  return {
    felder: h && typeof h.felder === "object" && h.felder !== null ? h.felder : {},
    unsicher: h && Array.isArray(h.unsicher) ? h.unsicher : [],
    lauf: h?.lauf,
  };
}

/**
 * Ob die Spalte einen Wert hat, gemessen am Rohtext aus Baserow (`pruefwerte` bzw. `lesewerte`).
 * `Name` mit `NAME_UNGELESEN` gilt als leer. Die einzige Stelle, die das entscheidet.
 */
export function hatWert(feld: PruefFeld, wert: string | undefined): boolean {
  if (wert === undefined || wert.trim() === "") return false;
  return !(feld === "Name" && wert === NAME_UNGELESEN);
}

/** Ob der Herkunftseintrag vom Lesen selbst stammt (gelesen, vom Etikett). */
function vomLesen(eintrag: FeldHerkunft | undefined): boolean {
  return (
    eintrag?.stand === "gelesen" &&
    (eintrag.herkunft === ETIKETT_HERKUNFT.vorne || eintrag.herkunft === ETIKETT_HERKUNFT.hinten)
  );
}

/** Schutzregeln 1 und 3: bestätigt, oder ein Wert, den nicht das Lesen geschrieben hat. */
function istGeschuetzt(feld: LeseFeld, eintrag: FeldHerkunft | undefined, alterWert: string | undefined): boolean {
  if (eintrag?.stand === "bestaetigt") return true;
  return hatWert(feld, alterWert) && !vomLesen(eintrag);
}

/** Wert der Spalte, wenn der Lauf für das Feld nichts liefert. */
function leerWert(feld: LeseFeld): string | null {
  return feld === "Name" ? NAME_UNGELESEN : null;
}

function nachFeldReihenfolge(a: Unsicher, b: Unsicher): number {
  return LESE_FELDER.indexOf(a.feld) - LESE_FELDER.indexOf(b.feld);
}

/**
 * Führt das geprüfte Ergebnis eines Laufs mit der Karte zusammen (Regeln 1 bis 3 und „Danach“
 * der technischen Spezifikation). Geschützte Felder bleiben, für alle anderen gilt der letzte Lauf.
 */
export function zusammenfuehren(
  karte: Wein,
  geprueft: Geprueft,
  lauf: { modell: string; zeit: string },
): Zusammengefuehrt {
  const alt = alteHerkunft(karte);
  const herkunftFelder: Record<string, FeldHerkunft> = { ...alt.felder };
  const felder: Partial<Record<LeseFeld, string | null>> = {};
  const gelesen: LeseFeld[] = [];
  const werte: Partial<Record<LeseFeld, string>> = {};
  const geschuetzt: LeseFeld[] = [];

  for (const feld of LESE_FELDER) {
    const alterWert = karte.lesewerte?.[feld];
    if (istGeschuetzt(feld, alt.felder[feld], alterWert)) {
      geschuetzt.push(feld);
      continue;
    }

    const neu = geprueft.werte[feld];
    // Immer schreiben, nicht nur bei Änderung: Die Karte ist ein Stand von vorher, `herkunft` wird
    // ganz geschrieben. Nur so passen Spalten und `herkunft` zusammen, wenn ein anderer Lauf dazwischen schrieb.
    felder[feld] = neu ? neu.wert : leerWert(feld);

    if (neu) {
      herkunftFelder[feld] = { herkunft: ETIKETT_HERKUNFT[neu.seite], stand: "gelesen" };
      gelesen.push(feld);
      werte[feld] = neu.wert;
    } else {
      delete herkunftFelder[feld];
    }
  }

  const unsicher = [
    ...alt.unsicher.filter((u) => geschuetzt.includes(u.feld)),
    ...geprueft.unsicher.filter((u) => istLeseFeld(u.feld) && !geschuetzt.includes(u.feld)),
  ].sort(nachFeldReihenfolge);

  return {
    felder,
    herkunft: { felder: herkunftFelder, unsicher, lauf: { modell: lauf.modell, zeit: lauf.zeit } },
    gelesen,
    werte,
    geschuetzt,
  };
}
