// Aufruf der Schreibroute und des frischen Stands einer Karte aus dem Browser. Kein Geheimnis,
// kein `server-only`: Prüfkarte und „Alle Weine“ („Zurückholen“) nutzen dieselben Funktionen und
// übersetzen Fehler gleich wie `lesenAnstossen`. Beide Funktionen werfen nie.
import {
  TEXT_ANTWORT_UNBRAUCHBAR,
  TEXT_KEINE_ANTWORT,
  TEXT_KEINE_VERBINDUNG,
  TEXT_NEU_ANMELDEN,
  TEXT_UNBEKANNTER_FEHLER,
} from "./lesen-anstossen";
import { istPruefFeld } from "./pruefkarte";
import type { Aktion, BearbeitenAntwort, KartenAnsicht, KartenStand, PruefFeld } from "./types";

export type BearbeitenErgebnis =
  | { art: "ok"; antwort: BearbeitenAntwort }
  | { art: "fehler"; text: string; netz?: true; feld?: PruefFeld; fehlend?: PruefFeld[] };

export type AbrufErgebnis = { art: "ok"; karte: KartenAnsicht } | { art: "fehler"; text: string };

const STATUS_NICHT_ANGEMELDET = 401;
const KARTEN_STAENDE: readonly KartenStand[] = ["aufgenommen", "geprueft", "ausgelistet"];

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/** Grobe Prüfung, damit die Oberfläche nicht an einer fremden Antwort zerbricht. */
function istKartenAnsicht(wert: unknown): wert is KartenAnsicht {
  return (
    istObjekt(wert) &&
    typeof wert.kennung === "string" &&
    KARTEN_STAENDE.some((stand) => stand === wert.stand) &&
    istObjekt(wert.werte) &&
    istObjekt(wert.herkunft) &&
    istObjekt(wert.herkunft.felder) &&
    Array.isArray(wert.herkunft.unsicher)
  );
}

function istBearbeitenAntwort(wert: unknown): wert is BearbeitenAntwort {
  return istObjekt(wert) && Array.isArray(wert.nichtBestaetigt) && istKartenAnsicht(wert);
}

/** Ergebnis der Anfrage bis einschließlich JSON: die Daten oder schon ein fertiger Fehler. */
type Gelesen =
  | { art: "daten"; antwort: Response; daten: unknown }
  | { art: "fehler"; text: string; netz?: true };

async function anfragen(adresse: string, init: RequestInit): Promise<Gelesen> {
  let antwort: Response;
  try {
    antwort = await fetch(adresse, init);
  } catch {
    return { art: "fehler", text: TEXT_KEINE_VERBINDUNG, netz: true };
  }

  if (antwort.status === STATUS_NICHT_ANGEMELDET) {
    return { art: "fehler", text: TEXT_NEU_ANMELDEN };
  }

  try {
    return { art: "daten", antwort, daten: await antwort.json() };
  } catch {
    return { art: "fehler", text: TEXT_KEINE_ANTWORT };
  }
}

/** Satz aus `{ fehler }`, falls die Antwort einen trägt. */
function eigenerFehler(daten: unknown): string | undefined {
  return istObjekt(daten) && typeof daten.fehler === "string" && daten.fehler ? daten.fehler : undefined;
}

/**
 * Schickt einen Schritt der Prüfkarte an `POST /api/weine/[kennung]/bearbeiten`. Wirft nie; jeder
 * Fehler kommt als ganzer deutscher Satz zurück, bei 400 und 409 mit `feld` bzw. `fehlend`.
 * `keepalive` beim Verlassen der Seite, damit wartende Schritte noch hinausgehen.
 */
export async function karteBearbeiten(
  kennung: string,
  aktion: Aktion,
  o?: { keepalive?: boolean },
): Promise<BearbeitenErgebnis> {
  let koerper: string;
  try {
    koerper = JSON.stringify(aktion);
  } catch {
    return { art: "fehler", text: TEXT_UNBEKANNTER_FEHLER };
  }

  const gelesen = await anfragen(`/api/weine/${encodeURIComponent(kennung)}/bearbeiten`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: koerper,
    keepalive: o?.keepalive === true,
  });
  if (gelesen.art === "fehler") return gelesen;
  const { antwort, daten } = gelesen;

  const fehler = eigenerFehler(daten);
  if (fehler !== undefined) {
    const ergebnis: BearbeitenErgebnis = { art: "fehler", text: fehler };
    if (istObjekt(daten)) {
      if (istPruefFeld(daten.feld)) ergebnis.feld = daten.feld;
      if (Array.isArray(daten.fehlend)) {
        const fehlend = daten.fehlend.filter(istPruefFeld);
        if (fehlend.length > 0) ergebnis.fehlend = fehlend;
      }
    }
    return ergebnis;
  }
  if (!antwort.ok) return { art: "fehler", text: TEXT_UNBEKANNTER_FEHLER };
  if (!istBearbeitenAntwort(daten)) return { art: "fehler", text: TEXT_ANTWORT_UNBRAUCHBAR };
  return { art: "ok", antwort: daten };
}

/** Holt den frischen Stand einer Karte über `GET /api/weine/[kennung]` (D1). Wirft nie. */
export async function karteAbrufen(kennung: string): Promise<AbrufErgebnis> {
  const gelesen = await anfragen(`/api/weine/${encodeURIComponent(kennung)}`, {
    method: "GET",
    cache: "no-store",
  });
  if (gelesen.art === "fehler") return { art: "fehler", text: gelesen.text };
  const { antwort, daten } = gelesen;

  const fehler = eigenerFehler(daten);
  if (fehler !== undefined) return { art: "fehler", text: fehler };
  if (!antwort.ok) return { art: "fehler", text: TEXT_UNBEKANNTER_FEHLER };
  if (!istKartenAnsicht(daten)) return { art: "fehler", text: TEXT_ANTWORT_UNBRAUCHBAR };
  return { art: "ok", karte: daten };
}
