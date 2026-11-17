// Aufruf zum Lesen der Etiketten aus dem Browser. Kein Geheimnis, kein `server-only`:
// „Wein aufnehmen“ und „Alle Weine“ nutzen diese Funktion und übersetzen Fehler so gleich.
import type { LeseAntwort } from "./types";

export type LeseErgebnis = { art: "ok"; antwort: LeseAntwort } | { art: "fehler"; text: string };

const STATUS_NICHT_ANGEMELDET = 401;

const TEXT_NEU_ANMELDEN = "Bitte melde dich neu an.";
const TEXT_KEINE_VERBINDUNG = "Keine Verbindung. Bitte noch einmal versuchen.";
/** Antwort ohne verwertbares JSON, z. B. eine Zeitüberschreitung der Plattform. */
const TEXT_KEINE_ANTWORT = "Der Server hat nicht rechtzeitig geantwortet.";
/** Antwort mit Fehlerstatus, aber ohne eigenen Satz. */
const TEXT_UNBEKANNTER_FEHLER = "Der Server hat einen Fehler gemeldet.";
/** JSON, aber nicht in der erwarteten Form. */
const TEXT_ANTWORT_UNBRAUCHBAR = "Die Antwort des Servers war unbrauchbar.";

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/** Grobe Prüfung, damit die Oberfläche nicht an einer fremden Antwort zerbricht. */
function istLeseAntwort(wert: unknown): wert is LeseAntwort {
  return (
    istObjekt(wert) &&
    typeof wert.kennung === "string" &&
    Array.isArray(wert.gelesen) &&
    istObjekt(wert.werte) &&
    Array.isArray(wert.unsicher) &&
    Array.isArray(wert.geschuetzt) &&
    typeof wert.rueckenfoto === "boolean"
  );
}

/**
 * Stößt das Lesen einer Karte an. Wirft nie; jeder Fehler kommt als ganzer deutscher Satz zurück.
 * `keepalive`, damit die Anfrage auch dann zu Ende läuft, wenn die Seite verlassen wird.
 */
export async function lesenAnstossen(kennung: string): Promise<LeseErgebnis> {
  let antwort: Response;
  try {
    antwort = await fetch(`/api/weine/${encodeURIComponent(kennung)}/lesen`, {
      method: "POST",
      keepalive: true,
    });
  } catch {
    return { art: "fehler", text: TEXT_KEINE_VERBINDUNG };
  }

  if (antwort.status === STATUS_NICHT_ANGEMELDET) {
    return { art: "fehler", text: TEXT_NEU_ANMELDEN };
  }

  let daten: unknown;
  try {
    daten = await antwort.json();
  } catch {
    return { art: "fehler", text: TEXT_KEINE_ANTWORT };
  }

  if (istObjekt(daten) && typeof daten.fehler === "string" && daten.fehler) {
    return { art: "fehler", text: daten.fehler };
  }
  if (!antwort.ok) {
    return { art: "fehler", text: TEXT_UNBEKANNTER_FEHLER };
  }
  if (!istLeseAntwort(daten)) {
    return { art: "fehler", text: TEXT_ANTWORT_UNBRAUCHBAR };
  }
  return { art: "ok", antwort: daten };
}
