import { NextResponse } from "next/server";

/** Wert einer Einstellung; leerer Text oder nur Leerraum zählt wie in `leseEinstellungen()` als fehlend. */
function einstellung(name: string): string | null {
  return process.env[name]?.trim() || null;
}

// Zeigt, ob die App läuft und welche Einstellungen gesetzt sind – ohne deren Werte.
// Lesen ist eingerichtet, wenn `modell` wahr ist und `modellId` nicht null.
export function GET() {
  return NextResponse.json({
    ok: true,
    baserow: Boolean(process.env.BASEROW_TOKEN && process.env.BASEROW_TABLE_WEINE),
    modell: einstellung("OPENROUTER_API_KEY") !== null,
    modellId: einstellung("MODELL_ID"),
  });
}
