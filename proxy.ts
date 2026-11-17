import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ZUGANG_COOKIE, zugangsMarke } from "@/lib/zugang";

// Läuft vor jeder Seite und jeder Server-Route (außer den Ausnahmen unten)
// und lässt nur durch, wer den Zugangscode eingegeben hat.
export async function proxy(request: NextRequest) {
  const code = process.env.APP_ZUGANGSCODE;

  if (!code) {
    // Auf dem eigenen Rechner ohne Code arbeiten; im Betrieb lieber zu als offen.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("Zugangscode ist nicht eingerichtet (APP_ZUGANGSCODE).", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.next();
  }

  const erwartet = await zugangsMarke(code);
  if (request.cookies.get(ZUGANG_COOKIE)?.value === erwartet) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ fehler: "nicht angemeldet" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/anmelden", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|anmelden|api/anmelden|api/health).*)",
  ],
};
