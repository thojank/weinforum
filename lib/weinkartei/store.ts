import "server-only";
import type { Wein } from "./types";
import { baserowStore } from "./baserow";

/**
 * Dünne Schicht zwischen App und Datenbank.
 * Die App spricht nur mit dieser Schnittstelle, nie direkt mit Baserow.
 * Wer die Datenbank tauscht, schreibt eine zweite Umsetzung und ändert weinStore().
 */
export interface WeinStore {
  liste(): Promise<Wein[]>;
}

/** Liefert null, solange die Datenbank nicht eingerichtet ist. */
export function weinStore(): WeinStore | null {
  const url = process.env.BASEROW_API_URL;
  const token = process.env.BASEROW_TOKEN;
  const tabelle = process.env.BASEROW_TABLE_WEINE;
  if (!url || !token || !tabelle) return null;
  return baserowStore({ url, token, tabelle });
}
