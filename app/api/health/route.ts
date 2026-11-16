import { NextResponse } from "next/server";

// Zeigt, ob die App läuft und welche Einstellungen gesetzt sind – ohne deren Werte.
export function GET() {
  return NextResponse.json({
    ok: true,
    baserow: Boolean(process.env.BASEROW_TOKEN && process.env.BASEROW_TABLE_WEINE),
    modell: Boolean(process.env.MODELL_API_KEY),
  });
}
