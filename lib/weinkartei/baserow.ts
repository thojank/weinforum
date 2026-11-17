import "server-only";
import { NAME_UNGELESEN, type Aufnahme, type KartenStand, type Wein } from "./types";
import type { WeinStore } from "./store";

// Umsetzung des WeinStore für Baserow.
// Erwartet die Spaltennamen aus docs/DATENMODELL.md.

interface Einstellungen {
  url: string;
  token: string;
  tabelle: string;
}

type Zeile = Record<string, unknown>;

interface HochgeladeneDatei {
  name: string;
}

function text(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.trim() !== "" ? wert : undefined;
}

/** Vorschau-Adresse aus einem Dateifeld, falls vorhanden. */
function vorschau(wert: unknown): string | undefined {
  if (!Array.isArray(wert) || wert.length === 0) return undefined;
  const datei = wert[0] as { url?: string; thumbnails?: { small?: { url?: string } } };
  return datei.thumbnails?.small?.url ?? datei.url;
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
    fotoVorneVorschau: vorschau(zeile["Foto vorne"]),
    stand: (stand as KartenStand) ?? "aufgenommen",
  };
}

function neueKennung(): string {
  return `wk-${crypto.randomUUID().slice(0, 8)}`;
}

export function baserowStore({ url, token, tabelle }: Einstellungen): WeinStore {
  const kopf = { Authorization: `Token ${token}` };
  const zeilenAdresse = `${url}/api/database/rows/table/${tabelle}/?user_field_names=true`;

  async function hochladen(foto: Blob, dateiname: string): Promise<HochgeladeneDatei> {
    const formular = new FormData();
    formular.append("file", foto, dateiname);
    const antwort = await fetch(`${url}/api/user-files/upload-file/`, {
      method: "POST",
      headers: kopf,
      body: formular,
    });
    if (!antwort.ok) {
      throw new Error(`Baserow nimmt das Foto nicht an (${antwort.status})`);
    }
    return (await antwort.json()) as HochgeladeneDatei;
  }

  return {
    async liste() {
      const antwort = await fetch(`${zeilenAdresse}&size=200`, { headers: kopf, cache: "no-store" });
      if (!antwort.ok) {
        throw new Error(`Baserow antwortet mit ${antwort.status}`);
      }
      const daten = (await antwort.json()) as { results: Zeile[] };
      return daten.results.map(zuWein);
    },

    async aufnehmen({ vorne, hinten }: Aufnahme) {
      const kennung = neueKennung();
      const dateiVorne = await hochladen(vorne, `${kennung}-vorne.jpg`);
      const dateiHinten = hinten ? await hochladen(hinten, `${kennung}-hinten.jpg`) : undefined;

      const zeile: Zeile = {
        Kennung: kennung,
        Name: NAME_UNGELESEN,
        Stand: "aufgenommen",
        "Foto vorne": [{ name: dateiVorne.name }],
        "Foto hinten": dateiHinten ? [{ name: dateiHinten.name }] : [],
      };
      const antwort = await fetch(zeilenAdresse, {
        method: "POST",
        headers: { ...kopf, "Content-Type": "application/json" },
        body: JSON.stringify(zeile),
      });
      if (!antwort.ok) {
        const grund = await antwort.text();
        throw new Error(`Baserow legt die Karte nicht an (${antwort.status}): ${grund.slice(0, 300)}`);
      }
      return zuWein((await antwort.json()) as Zeile);
    },
  };
}
