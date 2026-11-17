// Einfacher Zugangsschutz: ein gemeinsamer Code, nach der Eingabe ein Cookie.
// Kein Ersatz für eine echte Anmeldung; genügt, solange keine Kundendaten in der App sind.

export const ZUGANG_COOKIE = "weinkartei_zugang";

/** Wert, der im Cookie steht: ein Fingerabdruck des Codes, nie der Code selbst. */
export async function zugangsMarke(code: string): Promise<string> {
  const daten = new TextEncoder().encode(`weinkartei:${code}`);
  const hash = await crypto.subtle.digest("SHA-256", daten);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
