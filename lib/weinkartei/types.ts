// Fachliche Typen der Weinkartei. Quelle der Wahrheit für die Felder ist docs/DATENMODELL.md.

/** Woher eine Angabe stammt. */
export type Herkunft =
  | "etikett-vorne"
  | "etikett-hinten"
  | "e-label"
  | "haendler"
  | "ki"
  | "inhaber"
  | "import";

/** Wie weit eine Angabe ist. Nur Bestätigtes darf in Ausgaben erscheinen. */
export type AngabenStand = "gelesen" | "vorgeschlagen" | "bestaetigt";

/** Stand der ganzen Karteikarte. */
export type KartenStand = "aufgenommen" | "geprueft" | "ausgelistet";

export type Weinart = "schaumwein" | "weiss" | "rose" | "rot" | "suesswein" | "alkoholfrei" | "sonstiges";

/** Text der Spalte „Art“ in Baserow zu jeder `Weinart`. */
export const ART_TEXTE: Record<Weinart, string> = {
  schaumwein: "Schaumwein",
  weiss: "Weiß",
  rose: "Rosé",
  rot: "Rot",
  suesswein: "Süßwein",
  alkoholfrei: "alkoholfrei",
  sonstiges: "Sonstiges",
};

/** Form der eigenen Kennung einer Karte, z. B. „wk-3f9a2c1b“. */
export const KENNUNG_MUSTER = /^wk-[0-9a-f]{8}$/;

/** Die dreizehn Spalten, die das Lesen füllt. Werte sind die Spaltennamen in Baserow. */
export const LESE_FELDER = [
  "Name",
  "Erzeuger",
  "Art",
  "Rebsorten",
  "Jahrgang",
  "Land",
  "Region",
  "Qualitätsstufe",
  "Alkohol",
  "Flaschengröße",
  "Geschmacksangabe",
  "Allergene",
  "EAN",
] as const;
export type LeseFeld = (typeof LESE_FELDER)[number];

/** Herkunft und Stand einer einzelnen Angabe. */
export interface FeldHerkunft {
  herkunft: Herkunft;
  stand: AngabenStand;
}

/** Ein Feld, bei dem das Lesen unsicher war oder dessen Wert verworfen wurde. */
export interface Unsicher {
  feld: LeseFeld;
  grund: string;
}

/** Inhalt der Spalte „Herkunft“. */
export interface KartenHerkunft {
  /** Schlüssel sind Spaltennamen; auch Felder späterer Pakete dürfen hier stehen. */
  felder: Record<string, FeldHerkunft>;
  unsicher: Unsicher[];
  /** Modell und Zeitpunkt des letzten Lesens; zeit: ISO 8601, UTC. */
  lauf?: { modell: string; zeit: string };
}

/** Eine Karteikarte: eine Flasche, also Wein + Jahrgang + Flaschengröße. */
export interface Wein {
  /** Eigene, stabile Kennung. Stammt nicht aus der Datenbank. */
  kennung: string;
  name: string;
  erzeuger?: string;
  art?: Weinart;
  rebsorten?: string[];
  /** Zahl oder "ohne". */
  jahrgang?: string;
  land?: string;
  region?: string;
  qualitaetsstufe?: string;
  alkohol?: number;
  flaschengroesseMl?: number;
  geschmacksangabe?: string;
  allergene?: string;
  /** Strichcode-Nummer vom Rückenetikett; Schlüssel gegen Doppelte und zum Bestandssystem. */
  ean?: string;
  /** Eigener Artikelcode; führt das Bestandssystem. */
  artikelcode?: string;
  /** Inhalt der Spalte „Herkunft“; fehlt, wenn er sich nicht lesen ließ. */
  herkunft?: KartenHerkunft;
  /** Volle Adresse des Fotos vom Vorderetikett, für das Lesen. */
  fotoVorne?: string;
  /** Volle Adresse des Fotos vom Rückenetikett, für das Lesen. */
  fotoHinten?: string;
  /** Kleine Vorschau des Vorderetiketts, falls ein Foto vorliegt. */
  fotoVorneVorschau?: string;
  /** Kleine Vorschau des Rückenetiketts, falls ein Foto vorliegt. */
  fotoHintenVorschau?: string;
  /**
   * Text der dreizehn Lesespalten genau so, wie er in Baserow steht; nur nicht leere Spalten.
   * Füllt `holen()`; die Schutzregeln brauchen ihn, weil die typisierten Felder
   * nicht umwandelbare Werte verlieren.
   */
  lesewerte?: Partial<Record<LeseFeld, string>>;
  stand: KartenStand;
}

/**
 * Antwort des Sprachmodells nach der Strukturprüfung, Schlüssel schon als Spaltennamen.
 * Noch ungeprüft: Ob ein Wert gültig ist, entscheidet erst `pruefen`.
 */
export interface Modellantwort {
  felder: Record<LeseFeld, { wert: string | null; seite: string | null }>;
  /** `feld` als Spaltenname, wenn bekannt, sonst der Rohschlüssel des Modells. */
  unsicher: { feld: string; grund: string }[];
}

/** Antwort der Route `POST /api/weine/[kennung]/lesen` bei Erfolg (200). */
export interface LeseAntwort {
  kennung: string;
  /** `null`, wenn nicht gelesen. */
  name: string | null;
  /** `null`, wenn nicht gelesen. */
  jahrgang: string | null;
  /** Felder, die in diesem Lauf einen Wert bekommen haben; Reihenfolge wie `LESE_FELDER`. */
  gelesen: LeseFeld[];
  /** Je Feld aus `gelesen` der Wert, wie er in Baserow geschrieben wurde. */
  werte: Partial<Record<LeseFeld, string>>;
  /** Unsicheres nach dem Lauf, also `herkunft.unsicher`. */
  unsicher: Unsicher[];
  /** Felder, die wegen der Schutzregeln nicht angefasst wurden. */
  geschuetzt: LeseFeld[];
  /** Ob die Karte ein Rückenfoto hat. */
  rueckenfoto: boolean;
}

/** Was beim Aufnehmen ankommt: die beiden Fotos. */
export interface Aufnahme {
  vorne: Blob;
  hinten?: Blob;
}

/** Name, den eine frisch aufgenommene Karte trägt, bis das Etikett gelesen ist. */
export const NAME_UNGELESEN = "(noch nicht gelesen)";
