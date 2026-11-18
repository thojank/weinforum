// Anzeige der Felder auf der Prüfkarte: Eingabeart, Anzeigeform, Wörter für Herkunft und Stand.
// Die Regeln selbst (gültig, Pflicht, Stapel) stehen nur in `lib/weinkartei/pruefkarte.ts`.
import { hatWert, TEXT_MAX_ZEICHEN } from "@/lib/weinkartei/pruefen";
import { eingabePruefen, PFLICHT_FELDER, stapelVon, type EingabeErgebnis, type Stapel } from "@/lib/weinkartei/pruefkarte";
import {
  ART_TEXTE,
  PRUEF_FELDER,
  type FeldHerkunft,
  type Herkunft,
  type KartenHerkunft,
  type KartenStand,
  type PruefFeld,
} from "@/lib/weinkartei/types";

/** Stand einer Karte, wie ihn die Seite zeigt; wird nach jeder Antwort der eigenen Routen ersetzt. */
export interface KartenStandAnsicht {
  stand: KartenStand;
  werte: Partial<Record<PruefFeld, string>>;
  herkunft: KartenHerkunft;
}

/** Adressen der Fotos; volle Adresse für die Anzeige, Vorschau für die kleinen Bilder. */
export interface Fotos {
  vorne?: string;
  vorneVorschau?: string;
  hinten?: string;
  hintenVorschau?: string;
}

export type Seite = "vorne" | "hinten";

export const SEITEN: readonly Seite[] = ["vorne", "hinten"];

export const FOTO_ALT: Record<Seite, string> = { vorne: "Vorderetikett", hinten: "Rückenetikett" };

export const TEXT_HERKUNFT_UNLESBAR =
  "In der Spalte „Herkunft“ steht Text, der sich nicht lesen lässt. Bitte die Spalte in Baserow prüfen.";

/** Die sieben Arten in der Reihenfolge von `ART_TEXTE`. */
export const ARTEN: readonly string[] = Object.values(ART_TEXTE);

export const KURZTEXT_MAX = TEXT_MAX_ZEICHEN;

/** Wie ein Feld bearbeitet wird. */
export interface Eingabeart {
  art: "text" | "art" | "lang";
  modus?: "numeric" | "decimal";
  /** Einheit rechts neben dem Eingabefeld. */
  einheit?: string;
  /** Formathinweis an der Beschriftung. */
  format?: string;
  /** Eingabehilfe; ein Tipp übernimmt diesen Wert. */
  tipp?: string;
}

const EINGABEARTEN: Partial<Record<PruefFeld, Eingabeart>> = {
  Art: { art: "art" },
  Rebsorten: { art: "text", tipp: "Cuvée", format: "mit Komma getrennt" },
  Jahrgang: { art: "text", modus: "numeric", tipp: "ohne", format: "vier Ziffern oder „ohne“" },
  Alkohol: { art: "text", modus: "decimal", einheit: "% vol", format: "zum Beispiel 12,5" },
  Flaschengröße: { art: "text", modus: "numeric", einheit: "ml", format: "ganze Milliliter" },
  EAN: { art: "text", modus: "numeric", format: "8, 12 oder 13 Ziffern" },
  "Preis Flasche": { art: "text", modus: "decimal", einheit: "€", format: "zum Beispiel 8,90" },
  "Preis Glas": { art: "text", modus: "decimal", einheit: "€", format: "zum Beispiel 4,50" },
  "Kurztext kurz": { art: "lang", format: `höchstens ${TEXT_MAX_ZEICHEN} Zeichen` },
};

export function eingabeart(feld: PruefFeld): Eingabeart {
  return EINGABEARTEN[feld] ?? { art: "text" };
}

const HERKUNFT_WORTE: Record<Herkunft, string> = {
  "etikett-vorne": "Etikett vorne",
  "etikett-hinten": "Etikett hinten",
  "e-label": "E-Label",
  haendler: "Händler",
  ki: "KI",
  inhaber: "Inhaber",
  import: "Import",
};

/** Herkunft als Wort; ohne Eintrag „ohne Herkunft“, Unbekanntes so, wie es dasteht. */
export function herkunftWort(eintrag: FeldHerkunft | undefined): string {
  if (!eintrag) return "ohne Herkunft";
  return HERKUNFT_WORTE[eintrag.herkunft] ?? String(eintrag.herkunft);
}

/** Stand als Wort und Zeichen; ohne Eintrag „nicht bestätigt“. */
export function standWort(eintrag: FeldHerkunft | undefined): string {
  switch (eintrag?.stand) {
    case "bestaetigt":
      return "✓ bestätigt";
    case "gelesen":
      return "gelesen";
    case "vorgeschlagen":
      return "vorgeschlagen";
    default:
      return "nicht bestätigt";
  }
}

export const STAPEL_WORTE: Record<Stapel, string> = {
  nochZuLesen: "Noch zu lesen",
  zuPruefen: "Zu prüfen",
  geprueft: "Geprüft",
  ausgelistet: "Ausgelistet",
};

/** Alles, was die Seite über ein Feld wissen muss, aus dem letzten Stand berechnet. */
export interface FeldInfo {
  feld: PruefFeld;
  pflicht: boolean;
  /** Rohtext wie in Baserow; nur gesetzt, wenn das Feld einen Wert hat. */
  wert?: string;
  gefuellt: boolean;
  /** Herkunftseintrag; ein Eintrag zu einer leeren Spalte zählt nicht. */
  eintrag?: FeldHerkunft;
  bestaetigt: boolean;
  /** Gründe unter `unsicher`, vollständig. */
  unsicher: string[];
  /** Ergebnis der Prüfung des gespeicherten Werts; null bei leerem Feld. */
  pruefung: EingabeErgebnis | null;
  /** Gefüllt, nicht bestätigt, und der Wert besteht die Prüfung (D5). */
  bestaetigbar: boolean;
  /** Gefüllt, aber der gespeicherte Wert besteht die Prüfung nicht. */
  ungueltig: boolean;
}

export function feldInfo(feld: PruefFeld, karte: KartenStandAnsicht, jahr: number): FeldInfo {
  const roh = karte.werte[feld];
  const gefuellt = hatWert(feld, roh);
  const eintrag = gefuellt ? karte.herkunft.felder[feld] : undefined;
  const bestaetigt = eintrag?.stand === "bestaetigt";
  const pruefung = gefuellt && roh !== undefined ? eingabePruefen(feld, roh, { jahr }) : null;
  const ungueltig = pruefung?.art === "ungueltig";
  return {
    feld,
    pflicht: PFLICHT_FELDER.includes(feld),
    wert: gefuellt ? roh : undefined,
    gefuellt,
    eintrag,
    bestaetigt,
    unsicher: karte.herkunft.unsicher.filter((u) => u.feld === feld).map((u) => u.grund),
    pruefung,
    bestaetigbar: gefuellt && !bestaetigt && pruefung?.art === "gueltig",
    ungueltig,
  };
}

export function alleInfos(karte: KartenStandAnsicht, jahr: number): Record<PruefFeld, FeldInfo> {
  const infos = {} as Record<PruefFeld, FeldInfo>;
  for (const feld of PRUEF_FELDER) infos[feld] = feldInfo(feld, karte, jahr);
  return infos;
}

const komma = (wert: string) => wert.replace(".", ",");

/** Anzeigeform: „12,5 % vol“, „750 ml“, „8,90 €“, „ohne Jahrgang“. Ungültiges steht, wie es ist. */
export function anzeigeForm(info: FeldInfo): string {
  const roh = info.wert ?? "";
  if (info.pruefung?.art !== "gueltig") return roh;
  const wert = info.pruefung.wert;
  switch (info.feld) {
    case "Alkohol":
      return `${komma(wert)} % vol`;
    case "Flaschengröße":
      return `${wert} ml`;
    case "Preis Flasche":
    case "Preis Glas":
      return `${komma(wert)} €`;
    case "Jahrgang":
      return wert === "ohne" ? "ohne Jahrgang" : wert;
    default:
      return roh;
  }
}

/** Startwert im Eingabefeld: Zahlen mit Komma, sonst der Rohtext; ein leeres Feld beginnt leer. */
export function eingabeForm(info: FeldInfo): string {
  if (!info.gefuellt || info.wert === undefined) return "";
  if (info.pruefung?.art !== "gueltig") return info.wert;
  switch (info.feld) {
    case "Alkohol":
    case "Preis Flasche":
    case "Preis Glas":
      return komma(info.pruefung.wert);
    default:
      return info.wert;
  }
}

/** Kurzer Hinweis am Feld bei ungültigem gespeichertem Wert. */
export function ungueltigHinweis(info: FeldInfo): string {
  if (info.pruefung?.art !== "ungueltig") return "";
  return info.feld === "Art" ? "keine der sieben Arten" : info.pruefung.meldung;
}

/** Stapel der Karte als Wort, nach derselben Einordnung wie in „Alle Weine“. */
export function stapelWort(kennung: string, karte: KartenStandAnsicht): string {
  return STAPEL_WORTE[stapelVon({ kennung, name: "", stand: karte.stand, pruefwerte: karte.werte, herkunft: karte.herkunft })];
}

/** Überschrift: Name und Jahrgang, ohne Name „Noch nicht gelesen“. */
export function kopfWerte(werte: Partial<Record<PruefFeld, string>>): { name?: string; jahrgang?: string } {
  const name = hatWert("Name", werte.Name) ? werte.Name : undefined;
  const jahrgang = hatWert("Jahrgang", werte.Jahrgang) ? werte.Jahrgang : undefined;
  return { name, jahrgang: jahrgang === "ohne" ? "ohne Jahrgang" : jahrgang };
}

/** Ids je Feld; der Index in `PRUEF_FELDER` hält sie frei von Leer- und Sonderzeichen. */
export function feldIds(feld: PruefFeld) {
  const i = PRUEF_FELDER.indexOf(feld);
  return {
    zeile: `feld-${i}`,
    wert: `wert-${i}`,
    eingabe: `eingabe-${i}`,
    name: `name-${i}`,
    fehler: `fehler-${i}`,
    einheit: `einheit-${i}`,
    zaehler: `zaehler-${i}`,
    meldung: `meldung-${i}`,
  };
}

export function mehrzahl(n: number, eins: string, viele: string): string {
  return `${n} ${n === 1 ? eins : viele}`;
}
