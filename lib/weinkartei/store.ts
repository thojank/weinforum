import "server-only";
import type { Aufnahme, KartenHerkunft, KartenStand, LeseFeld, PruefFeld, Wein } from "./types";
import { baserowStore } from "./baserow";

/**
 * Wie `holen` mit unlesbarem Text in „Herkunft“ umgeht. Streng: Fehler. Nachsichtig: die Karte
 * kommt ohne `herkunft` zurück (für die Seite, damit die Fotos trotzdem erscheinen).
 */
export type HerkunftModus = "streng" | "nachsichtig";

/** Was ein Schritt der Prüfkarte schreibt. null leert eine Spalte. */
export interface SpeicherAenderung {
  felder: Partial<Record<PruefFeld, string | null>>;
  /** Wird immer als Ganzes geschrieben. */
  herkunft: KartenHerkunft;
  /** Nur angeben, wenn sich der Stand ändert. */
  stand?: KartenStand;
}

/**
 * Dünne Schicht zwischen App und Datenbank.
 * Die App spricht nur mit dieser Schnittstelle, nie direkt mit Baserow.
 * Wer die Datenbank tauscht, schreibt eine zweite Umsetzung und ändert weinStore().
 */
export interface WeinStore {
  liste(): Promise<Wein[]>;
  /** Legt aus den Fotos eine neue Karte mit Stand „aufgenommen“ an. */
  aufnehmen(aufnahme: Aufnahme): Promise<Wein>;
  /**
   * Eine Karte samt Adressen der beiden Fotos, Herkunft und `pruefwerte`; null, wenn es die Kennung
   * nicht gibt. Voreinstellung `streng`: unlesbare Herkunft ist ein Fehler.
   */
  holen(kennung: string, o?: { herkunft?: HerkunftModus }): Promise<Wein | null>;
  /** Schreibt gelesene Felder und die Herkunft. null leert eine Spalte. Rührt Stand und Fotos nicht an. */
  aktualisieren(
    kennung: string,
    felder: Partial<Record<LeseFeld, string | null>>,
    herkunft: KartenHerkunft,
  ): Promise<void>;
  /**
   * Schreibt Felder der Prüfkarte, Herkunft und – wenn angegeben – Stand in einem Schreibvorgang.
   * Fehlt eine der Spalten, wird nichts geschrieben. Liefert die Karte, wie Baserow sie danach meldet.
   */
  speichern(kennung: string, aenderung: SpeicherAenderung): Promise<Wein>;
}

/** Liefert null, solange die Datenbank nicht eingerichtet ist. */
export function weinStore(): WeinStore | null {
  const url = process.env.BASEROW_API_URL;
  const token = process.env.BASEROW_TOKEN;
  const tabelle = process.env.BASEROW_TABLE_WEINE;
  if (!url || !token || !tabelle) return null;
  return baserowStore({ url, token, tabelle });
}
