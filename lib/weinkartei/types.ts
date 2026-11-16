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
  alkohol?: number;
  flaschengroesseMl?: number;
  /** Strichcode-Nummer vom Rückenetikett; Schlüssel gegen Doppelte und zum Bestandssystem. */
  ean?: string;
  /** Eigener Artikelcode; führt das Bestandssystem. */
  artikelcode?: string;
  stand: KartenStand;
}
