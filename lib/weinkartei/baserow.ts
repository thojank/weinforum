import "server-only";
import type { KartenStand, Wein } from "./types";
import type { WeinStore } from "./store";

// Umsetzung des WeinStore für Baserow. Noch nicht gegen eine echte Tabelle getestet.
// Erwartet die Spaltennamen aus docs/DATENMODELL.md.

interface Einstellungen {
  url: string;
  token: string;
  tabelle: string;
}

type Zeile = Record<string, unknown>;

function text(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.trim() !== "" ? wert : undefined;
}

function zuWein(zeile: Zeile): Wein {
  const standRoh = zeile["Stand"];
  const stand =
    typeof standRoh === "object" && standRoh !== null && "value" in standRoh
      ? String((standRoh as { value: unknown }).value)
      : text(standRoh);
  return {
    kennung: text(zeile["Kennung"]) ?? String(zeile["id"]),
    name: text(zeile["Name"]) ?? "(ohne Name)",
    erzeuger: text(zeile["Erzeuger"]),
    jahrgang: text(zeile["Jahrgang"]),
    ean: text(zeile["EAN"]),
    artikelcode: text(zeile["Artikelcode"]),
    stand: (stand as KartenStand) ?? "aufgenommen",
  };
}

export function baserowStore({ url, token, tabelle }: Einstellungen): WeinStore {
  return {
    async liste() {
      const antwort = await fetch(
        `${url}/api/database/rows/table/${tabelle}/?user_field_names=true&size=200`,
        { headers: { Authorization: `Token ${token}` }, cache: "no-store" },
      );
      if (!antwort.ok) {
        throw new Error(`Baserow antwortet mit ${antwort.status}`);
      }
      const daten = (await antwort.json()) as { results: Zeile[] };
      return daten.results.map(zuWein);
    },
  };
}
