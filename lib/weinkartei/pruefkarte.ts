import {
  ALKOHOL_MAX,
  ALKOHOL_MIN,
  FLASCHE_MAX_ML,
  FLASCHE_MIN_ML,
  GRUENDE,
  JAHRGANG_MIN,
  JAHRGANG_OHNE,
  TEXT_MAX_ZEICHEN,
  hatWert,
  leerraumBereinigen,
  pruefeAlkohol,
  pruefeArt,
  pruefeEan,
  pruefeFlaschengroesse,
  pruefeJahrgang,
  pruefeText,
  zeichenzahl,
  type Pruefung,
} from "./pruefen";
import {
  INHABER_FELDER,
  NAME_UNGELESEN,
  PRUEF_FELDER,
  type Aktion,
  type FeldHerkunft,
  type KartenHerkunft,
  type KartenStand,
  type PruefFeld,
  type Wein,
} from "./types";

// Regeln der Prüfkarte: Eingaben prüfen, Schritte anwenden, Pflichtfelder, Einordnung in Stapel.
// Reine Funktionen wie `pruefen.ts`: kein Netz, keine Umgebungsvariablen, keine Uhr, kein
// `server-only`, nur relative Importe. Seite und Schreibroute benutzen dieselben Funktionen;
// verbindlich ist das Ergebnis auf dem Server.

// ---------------------------------------------------------------------------
// Pflichtfelder

/** Felder, die gefüllt und bestätigt sein müssen, damit eine Karte als geprüft gilt. */
export const PFLICHT_FELDER: readonly PruefFeld[] = [
  "Name",
  "Erzeuger",
  "Art",
  "Rebsorten",
  "Jahrgang",
  "Land",
  "Alkohol",
  "Flaschengröße",
];

/** Ob ein Text ein Feld der Prüfkarte ist. */
export function istPruefFeld(wert: unknown): wert is PruefFeld {
  return typeof wert === "string" && (PRUEF_FELDER as readonly string[]).includes(wert);
}

function istInhaberFeld(feld: PruefFeld): boolean {
  return (INHABER_FELDER as readonly string[]).includes(feld);
}

function nachFeldReihenfolge(a: PruefFeld, b: PruefFeld): number {
  return PRUEF_FELDER.indexOf(a) - PRUEF_FELDER.indexOf(b);
}

/**
 * Pflichtfelder, die noch nicht erfüllt sind, je in Feldreihenfolge. Erfüllt ist ein Feld, wenn
 * die Spalte einen Wert hat (`hatWert` am Rohtext) und sein Eintrag in `Herkunft` `bestaetigt` ist.
 * Ein Eintrag zu einer leeren Spalte zählt nicht.
 */
export function offenePflichtfelder(karte: Pick<Wein, "pruefwerte" | "herkunft">): {
  fehlend: PruefFeld[];
  unbestaetigt: PruefFeld[];
} {
  const fehlend: PruefFeld[] = [];
  const unbestaetigt: PruefFeld[] = [];
  for (const feld of [...PFLICHT_FELDER].sort(nachFeldReihenfolge)) {
    if (!hatWert(feld, karte.pruefwerte?.[feld])) fehlend.push(feld);
    else if (karte.herkunft?.felder[feld]?.stand !== "bestaetigt") unbestaetigt.push(feld);
  }
  return { fehlend, unbestaetigt };
}

/** Alle offenen Pflichtfelder in Feldreihenfolge. */
function allesOffene(karte: Pick<Wein, "pruefwerte" | "herkunft">): PruefFeld[] {
  const { fehlend, unbestaetigt } = offenePflichtfelder(karte);
  return [...fehlend, ...unbestaetigt].sort(nachFeldReihenfolge);
}

// ---------------------------------------------------------------------------
// Eingabe prüfen

/** Ergebnis von `eingabePruefen`. */
export type EingabeErgebnis =
  /** bereinigt, so wird gespeichert */
  | { art: "gueltig"; wert: string }
  | { art: "leer" }
  /** ganzer deutscher Satz, sagt, was erwartet wird */
  | { art: "ungueltig"; meldung: string };

/** Größter Betrag eines Preises: vier Stellen vor dem Komma, zwei danach. */
const PREIS_MUSTER = /^\d{1,4}(\.\d{1,2})?$/;
const PREIS_NACHKOMMA = 2;

/** Meldungen am Feld, wörtlich aus der Produktspezifikation (Umfang 2). */
export const MELDUNGEN = {
  jahrgang: (jahr: number) => `Bitte vier Ziffern von ${JAHRGANG_MIN} bis ${jahr} oder „${JAHRGANG_OHNE}“.`,
  art: "Bitte eine der sieben Arten wählen.",
  alkohol: `Bitte eine Zahl von ${ALKOHOL_MIN} bis ${ALKOHOL_MAX}, zum Beispiel 12,5.`,
  flaschengroesse: `Bitte ganze Milliliter von ${FLASCHE_MIN_ML} bis ${FLASCHE_MAX_ML}, zum Beispiel 750.`,
  eanUngueltig: "Bitte 8, 12 oder 13 Ziffern.",
  eanPruefziffer: "Die Prüfziffer stimmt nicht. Bitte mit den Ziffern unter dem Strichcode vergleichen.",
  preis: "Bitte einen Betrag in Euro, zum Beispiel 8,90.",
  kurztext: (zeichen: number) => `Höchstens ${TEXT_MAX_ZEICHEN} Zeichen. Es sind ${zeichen}.`,
  text: `Höchstens ${TEXT_MAX_ZEICHEN} Zeichen.`,
  geaendert: (feld: PruefFeld) => `${feld} hat sich inzwischen geändert. Bitte noch einmal ansehen.`,
  ausgelistet: "Die Karte ist ausgelistet. Hole sie zuerst zurück.",
  fehlen: (felder: PruefFeld[]) => `Es fehlen noch: ${felder.join(", ")}.`,
  nichtBestaetigt: (felder: PruefFeld[]) => `Noch nicht bestätigt: ${felder.join(", ")}.`,
  unbekanntesFeld: "Dieses Feld gibt es auf der Prüfkarte nicht.",
} as const;

/** Übersetzt das Ergebnis einer Prüfung aus `pruefen.ts` in das Ergebnis der Eingabe. */
function alsEingabe(pruefung: Pruefung, meldung: (grund: string) => string): EingabeErgebnis {
  if (pruefung.art === "gueltig") return { art: "gueltig", wert: pruefung.wert };
  if (pruefung.art === "leer") return { art: "leer" };
  return { art: "ungueltig", meldung: meldung(pruefung.grund) };
}

/** „ 8,90 € “ → `8.90`. Nur Beträge größer 0 bis 9999,99 mit höchstens zwei Nachkommastellen. */
function preisPruefen(wert: string): EingabeErgebnis {
  const roh = wert.replace(/€/g, "").replace(/\s+/g, "").replace(/,/g, ".");
  if (!PREIS_MUSTER.test(roh)) return { art: "ungueltig", meldung: MELDUNGEN.preis };
  const zahl = Number(roh);
  if (!(zahl > 0)) return { art: "ungueltig", meldung: MELDUNGEN.preis };
  return { art: "gueltig", wert: zahl.toFixed(PREIS_NACHKOMMA) };
}

/**
 * Prüft eine Eingabe der Prüfkarte. Die Lesespalten benutzen dieselben Prüfungen wie das Lesen
 * (`pruefen.ts`); hier wird nur die Meldung je Feld zugeordnet. Leerraum wird vorher bereinigt;
 * was danach keinen Wert hat (`hatWert`), ist `leer`.
 */
export function eingabePruefen(feld: PruefFeld, roh: string, o: { jahr: number }): EingabeErgebnis {
  const wert = leerraumBereinigen(roh);
  if (!hatWert(feld, wert)) return { art: "leer" };

  switch (feld) {
    case "Jahrgang":
      return alsEingabe(pruefeJahrgang(wert, o.jahr), () => MELDUNGEN.jahrgang(o.jahr));
    case "Art":
      return alsEingabe(pruefeArt(wert), () => MELDUNGEN.art);
    case "Alkohol":
      return alsEingabe(pruefeAlkohol(wert), () => MELDUNGEN.alkohol);
    case "Flaschengröße":
      return alsEingabe(pruefeFlaschengroesse(wert), () => MELDUNGEN.flaschengroesse);
    case "EAN":
      return alsEingabe(pruefeEan(wert), (grund) =>
        grund === GRUENDE.eanPruefziffer ? MELDUNGEN.eanPruefziffer : MELDUNGEN.eanUngueltig,
      );
    case "Preis Flasche":
    case "Preis Glas":
      return preisPruefen(wert);
    case "Kurztext kurz":
      return alsEingabe(pruefeText(wert), () => MELDUNGEN.kurztext(zeichenzahl(wert)));
    default:
      return alsEingabe(pruefeText(wert), () => MELDUNGEN.text);
  }
}

// ---------------------------------------------------------------------------
// Schritt anwenden

/** Ergebnis von `anwenden`. */
export type Angewendet =
  | {
      art: "ok";
      /** Nur die Spalten, die dieser Schritt schreibt; null leert. */
      felder: Partial<Record<PruefFeld, string | null>>;
      herkunft: KartenHerkunft;
      /** Nur gesetzt, wenn sich der Stand der Karte ändert. */
      stand?: KartenStand;
      /** Felder, die nicht bestätigt wurden, je mit Satz. */
      nichtBestaetigt: { feld: PruefFeld; meldung: string }[];
      /** Ergänzung: gesetzt, wenn der Stand von „geprueft“ auf „aufgenommen“ fällt (D6). */
      zurueckgefallen?: { feld: PruefFeld };
    }
  | {
      art: "abgelehnt";
      status: 400 | 409;
      fehler: string;
      feld?: PruefFeld;
      fehlend?: PruefFeld[];
      /**
       * Ergänzung (D7): Trotz der Ablehnung muss geschrieben werden, damit der Stand wahr bleibt
       * (geprüfte Karte mit offenem Pflichtfeld → „aufgenommen“). Die Route schreibt das mit
       * `speichern` und antwortet danach mit `status`.
       */
      schreiben?: { felder: Partial<Record<PruefFeld, string | null>>; herkunft: KartenHerkunft; stand: KartenStand };
    };

/** Text der Spalte nach dem Leeren. */
function leerWert(feld: PruefFeld): string | null {
  return feld === "Name" ? NAME_UNGELESEN : null;
}

/**
 * Rohtext einer Spalte aus `pruefwerte`. Nur wenn die Karte gar keine `pruefwerte` trägt, gilt
 * `lesewerte` (dann sind die Inhaberfelder leer).
 */
function rohwert(karte: Wein, feld: PruefFeld): string | undefined {
  if (karte.pruefwerte) return karte.pruefwerte[feld];
  const lesewerte: Partial<Record<string, string>> | undefined = karte.lesewerte;
  return lesewerte?.[feld];
}

/** Arbeitsstand eines Schritts: was geschrieben wird und wie die Karte danach aussieht. */
interface Entwurf {
  felder: Partial<Record<PruefFeld, string | null>>;
  herkunftFelder: Record<string, FeldHerkunft>;
  /** Felder, deren Einträge unter `unsicher` entfallen. */
  betroffen: Set<PruefFeld>;
  nichtBestaetigt: { feld: PruefFeld; meldung: string }[];
}

/** Bestätigt ein Feld mit dem bereinigten Wert; die Herkunft bleibt (ohne Eintrag: `inhaber`). */
function bestaetigeFeld(entwurf: Entwurf, feld: PruefFeld, wert: string): void {
  const bisher = entwurf.herkunftFelder[feld];
  const herkunft = istInhaberFeld(feld) ? "inhaber" : (bisher?.herkunft ?? "inhaber");
  entwurf.felder[feld] = wert;
  entwurf.herkunftFelder[feld] = { herkunft, stand: "bestaetigt" };
  entwurf.betroffen.add(feld);
}

function leereFeld(entwurf: Entwurf, feld: PruefFeld): void {
  entwurf.felder[feld] = leerWert(feld);
  delete entwurf.herkunftFelder[feld];
  entwurf.betroffen.add(feld);
}

/** Bereinigte Form eines gespeicherten Werts, falls er die Prüfung besteht. */
function bereinigt(feld: PruefFeld, wert: string | undefined, o: { jahr: number }): string | undefined {
  if (wert === undefined) return undefined;
  const ergebnis = eingabePruefen(feld, wert, o);
  return ergebnis.art === "gueltig" ? ergebnis.wert : undefined;
}

function bestaetigen(
  karte: Wein,
  entwurf: Entwurf,
  felder: { feld: PruefFeld; wert: string }[],
  o: { jahr: number },
): void {
  for (const { feld, wert: gesehen } of felder) {
    const frisch = rohwert(karte, feld);
    const frischHatWert = hatWert(feld, frisch);
    // Leere Felder werden übergangen, wenn auch die Seite sie leer gesehen hat.
    if (!frischHatWert && !hatWert(feld, gesehen)) continue;
    if (!frischHatWert || frisch !== gesehen) {
      entwurf.nichtBestaetigt.push({ feld, meldung: MELDUNGEN.geaendert(feld) });
      continue;
    }
    const ergebnis = eingabePruefen(feld, frisch, o);
    if (ergebnis.art === "ungueltig") {
      entwurf.nichtBestaetigt.push({ feld, meldung: ergebnis.meldung });
      continue;
    }
    if (ergebnis.art === "leer") continue;
    // D3: geschrieben wird die bereinigte Form des gesehenen Werts.
    bestaetigeFeld(entwurf, feld, ergebnis.wert);
  }
}

/**
 * Wendet einen Schritt der Prüfkarte auf den frischen Stand der Karte an (Regeltabelle der
 * technischen Spezifikation, dazu D3, D6, D7). `herkunft` geht immer als Ganzes zurück; `lauf`
 * und fremde Einträge bleiben. Eine Karte ohne `herkunft` ist ein Programmfehler: dann `throw`.
 */
export function anwenden(karte: Wein, aktion: Aktion, o: { jahr: number }): Angewendet {
  const alt = karte.herkunft;
  if (!alt) {
    throw new Error("Die Herkunft der Karte fehlt. Der Schritt wurde nicht gespeichert.");
  }

  const entwurf: Entwurf = {
    felder: {},
    herkunftFelder: { ...alt.felder },
    betroffen: new Set(),
    nichtBestaetigt: [],
  };

  switch (aktion.aktion) {
    case "auslisten":
      return ok(karte, entwurf, karte.stand === "ausgelistet" ? undefined : "ausgelistet");
    case "zurueckholen":
      return ok(karte, entwurf, karte.stand === "ausgelistet" ? "aufgenommen" : undefined);
    case "abschliessen":
      return abschliessen(karte, entwurf);
    default:
      break;
  }

  if (karte.stand === "ausgelistet") {
    return { art: "abgelehnt", status: 409, fehler: MELDUNGEN.ausgelistet };
  }

  switch (aktion.aktion) {
    case "bestaetigen":
      for (const { feld } of aktion.felder) {
        if (!istPruefFeld(feld)) return unbekanntesFeld();
      }
      bestaetigen(karte, entwurf, aktion.felder, o);
      break;
    case "aendern": {
      if (!istPruefFeld(aktion.feld)) return unbekanntesFeld();
      const feld = aktion.feld;
      const ergebnis = eingabePruefen(feld, aktion.wert, o);
      if (ergebnis.art === "ungueltig") {
        return { art: "abgelehnt", status: 400, fehler: ergebnis.meldung, feld };
      }
      if (ergebnis.art === "leer") {
        leereFeld(entwurf, feld);
        break;
      }
      if (ergebnis.wert === bereinigt(feld, rohwert(karte, feld), o)) {
        // Unveränderter Wert: gilt als „Stimmt so“, die Herkunft bleibt.
        bestaetigeFeld(entwurf, feld, ergebnis.wert);
        break;
      }
      entwurf.felder[feld] = ergebnis.wert;
      entwurf.herkunftFelder[feld] = { herkunft: "inhaber", stand: "bestaetigt" };
      entwurf.betroffen.add(feld);
      break;
    }
    case "leeren":
      if (!istPruefFeld(aktion.feld)) return unbekanntesFeld();
      leereFeld(entwurf, aktion.feld);
      break;
  }

  return ok(karte, entwurf, undefined);
}

function unbekanntesFeld(): Angewendet {
  return { art: "abgelehnt", status: 400, fehler: MELDUNGEN.unbekanntesFeld };
}

/** Herkunft nach dem Schritt, als Ganzes: Einträge, `unsicher` ohne betroffene Felder, `lauf`. */
function neueHerkunft(alt: KartenHerkunft, entwurf: Entwurf): KartenHerkunft {
  const herkunft: KartenHerkunft = {
    felder: entwurf.herkunftFelder,
    unsicher: alt.unsicher.filter((u) => !entwurf.betroffen.has(u.feld)).map((u) => ({ ...u })),
  };
  if (alt.lauf) herkunft.lauf = { ...alt.lauf };
  return herkunft;
}

/** Text aller Felder nach dem Schritt, nur nicht leere Spalten. */
function werteNachher(karte: Wein, felder: Partial<Record<PruefFeld, string | null>>): Partial<Record<PruefFeld, string>> {
  const werte: Partial<Record<PruefFeld, string>> = {};
  for (const feld of PRUEF_FELDER) {
    const wert = feld in felder ? felder[feld] : rohwert(karte, feld);
    if (typeof wert === "string" && wert !== "") werte[feld] = wert;
  }
  return werte;
}

/**
 * Baut das Ergebnis eines gelungenen Schritts. „Stand bleibt wahr“: Ist die Karte geprüft und
 * nach dem Schritt nicht mehr jedes Pflichtfeld erfüllt, fällt der Stand auf „aufgenommen“.
 */
function ok(karte: Wein, entwurf: Entwurf, stand: KartenStand | undefined): Angewendet {
  const alt = karte.herkunft as KartenHerkunft;
  const herkunft = neueHerkunft(alt, entwurf);
  const ergebnis: Angewendet = {
    art: "ok",
    felder: entwurf.felder,
    herkunft,
    nichtBestaetigt: entwurf.nichtBestaetigt,
  };
  if (stand !== undefined && stand !== karte.stand) ergebnis.stand = stand;

  const standDanach = ergebnis.stand ?? karte.stand;
  if (standDanach === "geprueft") {
    const offen = allesOffene({ pruefwerte: werteNachher(karte, entwurf.felder), herkunft });
    if (offen.length > 0) {
      ergebnis.stand = "aufgenommen";
      ergebnis.zurueckgefallen = { feld: offen[0] };
    }
  }
  return ergebnis;
}

/** `abschliessen`: nur mit allen Pflichtfeldern; auf einer schon geprüften Karte ohne Wirkung (D7). */
function abschliessen(karte: Wein, entwurf: Entwurf): Angewendet {
  if (karte.stand === "ausgelistet") {
    return { art: "abgelehnt", status: 409, fehler: MELDUNGEN.ausgelistet };
  }
  const { fehlend, unbestaetigt } = offenePflichtfelder({
    pruefwerte: werteNachher(karte, {}),
    herkunft: karte.herkunft,
  });
  if (fehlend.length === 0 && unbestaetigt.length === 0) {
    return ok(karte, entwurf, "geprueft");
  }

  const saetze: string[] = [];
  if (fehlend.length > 0) saetze.push(MELDUNGEN.fehlen(fehlend));
  if (unbestaetigt.length > 0) saetze.push(MELDUNGEN.nichtBestaetigt(unbestaetigt));
  const abgelehnt: Angewendet = {
    art: "abgelehnt",
    status: 409,
    fehler: saetze.join(" "),
    fehlend: [...fehlend, ...unbestaetigt].sort(nachFeldReihenfolge),
  };
  if (karte.stand === "geprueft") {
    // D7: Stand bleibt wahr, auch wenn der Schritt abgelehnt wird.
    abgelehnt.schreiben = {
      felder: {},
      herkunft: neueHerkunft(karte.herkunft as KartenHerkunft, entwurf),
      stand: "aufgenommen",
    };
  }
  return abgelehnt;
}

// ---------------------------------------------------------------------------
// Stapel

export type Stapel = "nochZuLesen" | "zuPruefen" | "geprueft" | "ausgelistet";

/** Einordnung einer Karte; ob `Name` fehlt, entscheidet `hatWert` am Rohtext, nie `wein.name`. */
export function stapelVon(wein: Wein): Stapel {
  if (wein.stand === "ausgelistet") return "ausgelistet";
  if (wein.stand === "geprueft") return "geprueft";
  if (!hatWert("Name", rohwert(wein, "Name"))) return "nochZuLesen";
  return "zuPruefen";
}

function hatUnsicheres(wein: Wein): boolean {
  return (wein.herkunft?.unsicher.length ?? 0) > 0;
}

/** Ordnet Karten in Stapel. In „Zu prüfen“ stehen Karten mit Unsicherem vorn, sonst bleibt die Reihenfolge. */
export function einordnen(weine: Wein[]): Record<Stapel, Wein[]> {
  const stapel: Record<Stapel, Wein[]> = { nochZuLesen: [], zuPruefen: [], geprueft: [], ausgelistet: [] };
  for (const wein of weine) stapel[stapelVon(wein)].push(wein);
  stapel.zuPruefen = [
    ...stapel.zuPruefen.filter(hatUnsicheres),
    ...stapel.zuPruefen.filter((wein) => !hatUnsicheres(wein)),
  ];
  return stapel;
}
