import { NextResponse } from "next/server";
import { weinStore } from "@/lib/weinkartei/store";
import { KENNUNG_MUSTER, type KartenAnsicht, type Wein } from "@/lib/weinkartei/types";

/** Fehlerklassen, deren Text die Bausteine in `lib/weinkartei/` selbst als ganzen Satz schreiben. */
const EIGENE_FEHLER = new Set(["Error"]);

/** Satz, wenn das Holen mit etwas Unerwartetem scheitert. */
const ERSATZ_HOLEN = "Die Karte ließ sich nicht aus der Datenbank holen.";

/** Eine Zeile je Fehler: Kennung, Aktion, Schritt, Status, Art. Nie Werte, nie Rohantworten. */
function protokoll(kennung: string, status: number, art: string): void {
  console.warn(`[abrufen] kennung=${kennung} aktion=abrufen schritt=holen status=${status} fehler=${art}`);
}

function fehler(text: string, status: number) {
  return NextResponse.json({ fehler: text }, { status });
}

// Frischer Stand einer Karte für die Prüfkarte (D1). Schreibt nie.
export async function GET(_request: Request, { params }: { params: Promise<{ kennung: string }> }) {
  const store = weinStore();
  if (!store) {
    return fehler("Die Datenbank ist nicht eingerichtet.", 503);
  }

  const { kennung } = await params;
  if (!KENNUNG_MUSTER.test(kennung)) {
    protokoll("(ungueltig)", 404, "muster");
    return fehler("Diese Karte gibt es nicht.", 404);
  }

  let karte: Wein | null;
  try {
    karte = await store.holen(kennung);
  } catch (wert) {
    protokoll(kennung, 502, wert instanceof Error ? wert.name : typeof wert);
    const eigen = wert instanceof Error && EIGENE_FEHLER.has(wert.name) && wert.message.trim() !== "";
    return fehler(eigen ? wert.message : ERSATZ_HOLEN, 502);
  }
  if (!karte) {
    protokoll(kennung, 404, "unbekannt");
    return fehler("Diese Karte gibt es nicht.", 404);
  }
  // Streng geholt, also mit Herkunft; die Prüfung hält nur den Typ ehrlich.
  if (!karte.herkunft) {
    protokoll(kennung, 502, "ohne-herkunft");
    return fehler(ERSATZ_HOLEN, 502);
  }

  const ansicht: KartenAnsicht = {
    kennung: karte.kennung,
    stand: karte.stand,
    werte: karte.pruefwerte ?? {},
    herkunft: karte.herkunft,
  };
  return NextResponse.json(ansicht, { headers: { "Cache-Control": "no-store" } });
}
