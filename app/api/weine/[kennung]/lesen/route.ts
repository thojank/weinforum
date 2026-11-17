import { NextResponse } from "next/server";
import { weinStore, type WeinStore } from "@/lib/weinkartei/store";
import { leseEinstellungen, lesen } from "@/lib/weinkartei/lesen";
import { pruefen, zusammenfuehren } from "@/lib/weinkartei/pruefen";
import { KENNUNG_MUSTER, type LeseAntwort, type Wein } from "@/lib/weinkartei/types";

// Fotos laden und das Modell aufrufen dauert; das Modell selbst hat 45 Sekunden.
export const maxDuration = 60;

/**
 * Fehlerklassen, deren Text die Bausteine in `lib/weinkartei/` selbst als ganzen deutschen
 * Satz schreiben. Alles andere (etwa ein `TypeError` mit englischem Text) wird nicht
 * weitergegeben, sondern durch den Satz des jeweiligen Schritts ersetzt.
 */
const EIGENE_FEHLER = new Set(["Error", "LeseFehler"]);

/** Sätze, wenn ein Schritt mit etwas Unerwartetem scheitert. */
const ERSATZ = {
  holen: "Die Karte ließ sich nicht aus der Datenbank holen.",
  lesen: "Das Lesen der Etiketten ist fehlgeschlagen.",
  verarbeiten: "Die gelesenen Angaben ließen sich nicht verarbeiten.",
  schreiben: "Die gelesenen Angaben ließen sich nicht in der Datenbank speichern.",
} as const;

type Schritt = keyof typeof ERSATZ;

function fehler(text: string, status: number) {
  return NextResponse.json({ fehler: text }, { status });
}

/**
 * Macht aus einem geworfenen Wert einen deutschen Satz für die Antwort und schreibt eine
 * Zeile ins Protokoll: Kennung, Schritt, Art des Fehlers. Nie Rohantworten oder Stacktraces.
 * Für den Schritt „lesen“ protokolliert `lesen.ts` selbst.
 */
function alsSatz(wert: unknown, schritt: Schritt, kennung: string): string {
  const eigen = wert instanceof Error && EIGENE_FEHLER.has(wert.name) && wert.message.trim() !== "";
  if (schritt !== "lesen") {
    const art = wert instanceof Error ? wert.name : typeof wert;
    console.warn(`[lesen] kennung=${kennung} schritt=${schritt} fehler=${art}`);
  }
  return eigen ? wert.message : ERSATZ[schritt];
}

/**
 * Holt die Karte; scheitert das, kommt gleich die fertige Antwort zurück (404 ohne Karte, sonst 502).
 * Die Route holt zweimal: vor dem Modell und noch einmal direkt vor dem Zusammenführen.
 */
async function karteHolen(store: WeinStore, kennung: string): Promise<{ karte: Wein } | { antwort: NextResponse }> {
  let karte;
  try {
    karte = await store.holen(kennung);
  } catch (wert) {
    return { antwort: fehler(alsSatz(wert, "holen", kennung), 502) };
  }
  if (!karte) {
    return { antwort: fehler("Diese Karte gibt es nicht.", 404) };
  }
  return { karte };
}

// Liest die Etiketten einer Karte und schreibt das Ergebnis einmal, am Ende, nach Baserow.
export async function POST(_request: Request, { params }: { params: Promise<{ kennung: string }> }) {
  // 1. Datenbank
  const store = weinStore();
  if (!store) {
    return fehler("Die Datenbank ist nicht eingerichtet.", 503);
  }

  // 2. Lesen eingerichtet? Nur der Name der Variable, nie ein Wert.
  const einst = leseEinstellungen();
  if ("fehlt" in einst) {
    return fehler(`Das Lesen ist nicht eingerichtet (${einst.fehlt} fehlt).`, 503);
  }

  // 3. Karte; bei falschem Muster ohne Anfrage an Baserow.
  const { kennung } = await params;
  if (!KENNUNG_MUSTER.test(kennung)) {
    return fehler("Diese Karte gibt es nicht.", 404);
  }
  const geholt = await karteHolen(store, kennung);
  if ("antwort" in geholt) {
    return geholt.antwort;
  }
  const karte = geholt.karte;

  // 4. Vorderfoto
  if (!karte.fotoVorne) {
    return fehler("Zu dieser Karte gibt es kein Foto vom Vorderetikett.", 502);
  }
  const rueckenfoto = Boolean(karte.fotoHinten);

  // 5. Modell
  let antwort;
  try {
    antwort = await lesen({ vorne: karte.fotoVorne, hinten: karte.fotoHinten || undefined }, einst, kennung);
  } catch (wert) {
    return fehler(alsSatz(wert, "lesen", kennung), 502);
  }

  // 6. Prüfen; Jahr und Zeit setzt die Route (UTC).
  const jetzt = new Date();
  let geprueft;
  try {
    geprueft = pruefen(antwort, { rueckenfoto, jahr: jetzt.getUTCFullYear() });
  } catch (wert) {
    return fehler(alsSatz(wert, "verarbeiten", kennung), 502);
  }

  // 7. Karte noch einmal holen und damit zusammenführen. Was während des Lesens in Baserow
  // eingetragen oder bestätigt wurde, ist so geschützt. Die Fotos ändern sich beim Lesen nicht.
  const frisch = await karteHolen(store, kennung);
  if ("antwort" in frisch) {
    return frisch.antwort;
  }
  let ergebnis;
  try {
    ergebnis = zusammenfuehren(frisch.karte, geprueft, { modell: einst.modell, zeit: jetzt.toISOString() });
  } catch (wert) {
    return fehler(alsSatz(wert, "verarbeiten", kennung), 502);
  }

  // 8. Der einzige Schreibvorgang.
  try {
    await store.aktualisieren(kennung, ergebnis.felder, ergebnis.herkunft);
  } catch (wert) {
    return fehler(alsSatz(wert, "schreiben", kennung), 502);
  }

  // 9. Antwort. `name` und `jahrgang` nur, wenn sie in diesem Lauf gelesen wurden;
  // ein geschütztes Feld gilt als nicht gelesen.
  const lese: LeseAntwort = {
    kennung,
    name: ergebnis.werte["Name"] ?? null,
    jahrgang: ergebnis.werte["Jahrgang"] ?? null,
    gelesen: ergebnis.gelesen,
    werte: ergebnis.werte,
    unsicher: ergebnis.herkunft.unsicher,
    geschuetzt: ergebnis.geschuetzt,
    rueckenfoto,
  };
  return NextResponse.json(lese);
}
