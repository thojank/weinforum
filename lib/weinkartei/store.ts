import "server-only";
import type { Aufnahme, KartenHerkunft, LeseFeld, Wein } from "./types";
import { baserowStore } from "./baserow";

/**
 * Dünne Schicht zwischen App und Datenbank.
 * Die App spricht nur mit dieser Schnittstelle, nie direkt mit Baserow.
 * Wer die Datenbank tauscht, schreibt eine zweite Umsetzung und ändert weinStore().
 */
export interface WeinStore {
  liste(): Promise<Wein[]>;
  /** Legt aus den Fotos eine neue Karte mit Stand „aufgenommen“ an. */
  aufnehmen(aufnahme: Aufnahme): Promise<Wein>;
  /** Eine Karte samt Adressen der beiden Fotos und Herkunft; null, wenn es die Kennung nicht gibt. */
  holen(kennung: string): Promise<Wein | null>;
  /** Schreibt gelesene Felder und die Herkunft. null leert eine Spalte. Rührt Stand und Fotos nicht an. */
  aktualisieren(
    kennung: string,
    felder: Partial<Record<LeseFeld, string | null>>,
    herkunft: KartenHerkunft,
  ): Promise<void>;
}

/** Liefert null, solange die Datenbank nicht eingerichtet ist. */
export function weinStore(): WeinStore | null {
  const url = process.env.BASEROW_API_URL;
  const token = process.env.BASEROW_TOKEN;
  const tabelle = process.env.BASEROW_TABLE_WEINE;
  if (!url || !token || !tabelle) return null;
  return baserowStore({ url, token, tabelle });
}
