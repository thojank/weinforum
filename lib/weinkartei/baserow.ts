import "server-only";
import {
  ART_TEXTE,
  LESE_FELDER,
  NAME_UNGELESEN,
  PRUEF_FELDER,
  type AngabenStand,
  type Aufnahme,
  type FeldHerkunft,
  type Herkunft,
  type KartenHerkunft,
  type KartenStand,
  type LeseFeld,
  type PruefFeld,
  type Unsicher,
  type Wein,
  type Weinart,
} from "./types";
import type { HerkunftModus, SpeicherAenderung, WeinStore } from "./store";

// Umsetzung des WeinStore für Baserow.
// Erwartet die Spaltennamen aus docs/DATENMODELL.md.
// Die Zeilen-ID von Baserow bleibt in dieser Datei; die App kennt nur die eigene Kennung.

interface Einstellungen {
  url: string;
  token: string;
  tabelle: string;
}

type Zeile = Record<string, unknown>;

interface HochgeladeneDatei {
  name: string;
}

/** Spaltennamen, die diese Datei außerhalb von LESE_FELDER kennt. */
const SPALTE_KENNUNG = "Kennung";
const SPALTE_HERKUNFT = "Herkunft";
const SPALTE_STAND = "Stand";
const SPALTE_FOTO_VORNE = "Foto vorne";
const SPALTE_FOTO_HINTEN = "Foto hinten";
const SPALTE_ARTIKELCODE = "Artikelcode";

/** Größte Seite, die Baserow beim Auflisten liefert (sonst ERROR_PAGE_SIZE_LIMIT). */
const SEITENGROESSE = 200;

/** Name, den eine Karte ohne Text in „Name“ in der App trägt. */
const NAME_FEHLT = "(ohne Name)";

const KARTEN_STAENDE: readonly KartenStand[] = ["aufgenommen", "geprueft", "ausgelistet"];
const HERKUENFTE: readonly Herkunft[] = [
  "etikett-vorne",
  "etikett-hinten",
  "e-label",
  "haendler",
  "ki",
  "inhaber",
  "import",
];
const ANGABEN_STAENDE: readonly AngabenStand[] = ["gelesen", "vorgeschlagen", "bestaetigt"];

/** Spalten, die vorhanden sein müssen, bevor gelesen oder geschrieben wird. */
const PFLICHTSPALTEN_HOLEN: readonly string[] = [...LESE_FELDER, SPALTE_HERKUNFT];

/** Was `Herkunft` bei leerer Spalte bedeutet. */
function leereHerkunft(): KartenHerkunft {
  return { felder: {}, unsicher: [] };
}

function text(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.trim() !== "" ? wert : undefined;
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

function istLeseFeld(wert: unknown): wert is LeseFeld {
  return typeof wert === "string" && (LESE_FELDER as readonly string[]).includes(wert);
}

/**
 * Rohtext einer Zelle, wie er in Baserow steht. Die Lesespalten sind Text;
 * Zahl- oder Auswahlfelder aus älteren Tabellen werden trotzdem als Text gelesen.
 */
function rohtext(wert: unknown): string | undefined {
  if (typeof wert === "number" && Number.isFinite(wert)) return String(wert);
  if (istObjekt(wert) && "value" in wert) return text(wert.value);
  return text(wert);
}

/** Erstes Element eines Dateifelds, falls vorhanden. */
function ersteDatei(wert: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(wert) || wert.length === 0) return undefined;
  const datei: unknown = wert[0];
  return istObjekt(datei) ? datei : undefined;
}

/** Volle Adresse aus einem Dateifeld, falls vorhanden. */
function dateiAdresse(wert: unknown): string | undefined {
  return text(ersteDatei(wert)?.url);
}

/** Vorschau-Adresse aus einem Dateifeld, falls vorhanden. */
function vorschau(wert: unknown): string | undefined {
  const datei = ersteDatei(wert);
  if (!datei) return undefined;
  const vorschauen = datei.thumbnails;
  if (istObjekt(vorschauen) && istObjekt(vorschauen.small)) {
    const klein = text(vorschauen.small.url);
    if (klein) return klein;
  }
  return text(datei.url);
}

function zuArt(roh: string | undefined): Weinart | undefined {
  if (!roh) return undefined;
  const gesucht = roh.trim();
  const treffer = (Object.keys(ART_TEXTE) as Weinart[]).find((art) => ART_TEXTE[art] === gesucht);
  return treffer;
}

/** Zahl aus Text; Komma zählt als Dezimalzeichen. Nicht umwandelbar → undefined. */
function zuZahl(roh: string | undefined): number | undefined {
  if (!roh) return undefined;
  const bereinigt = roh.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(bereinigt)) return undefined;
  const zahl = Number(bereinigt);
  return Number.isFinite(zahl) ? zahl : undefined;
}

function zuGanzzahl(roh: string | undefined): number | undefined {
  const zahl = zuZahl(roh);
  return zahl !== undefined && Number.isInteger(zahl) ? zahl : undefined;
}

function zuRebsorten(roh: string | undefined): string[] | undefined {
  if (!roh) return undefined;
  const sorten = roh
    .split(",")
    .map((sorte) => sorte.trim())
    .filter((sorte) => sorte !== "");
  return sorten.length > 0 ? sorten : undefined;
}

function zuStand(wert: unknown): KartenStand {
  const roh = rohtext(wert);
  return KARTEN_STAENDE.find((stand) => stand === roh) ?? "aufgenommen";
}

function zuFeldHerkunft(wert: unknown): FeldHerkunft | undefined {
  if (!istObjekt(wert)) return undefined;
  const herkunft = HERKUENFTE.find((h) => h === wert.herkunft);
  const stand = ANGABEN_STAENDE.find((s) => s === wert.stand);
  return herkunft && stand ? { herkunft, stand } : undefined;
}

function zuUnsicher(wert: unknown): Unsicher | undefined {
  if (!istObjekt(wert) || !istLeseFeld(wert.feld) || typeof wert.grund !== "string") return undefined;
  return { feld: wert.feld, grund: wert.grund };
}

/**
 * Liest den Text der Spalte „Herkunft“.
 * Leer → leeres Objekt. Text, der sich nicht als KartenHerkunft lesen lässt → null.
 */
function zuHerkunft(wert: unknown): KartenHerkunft | null {
  if (wert === null || wert === undefined) return leereHerkunft();
  if (typeof wert !== "string") return null;
  if (wert.trim() === "") return leereHerkunft();

  let daten: unknown;
  try {
    daten = JSON.parse(wert);
  } catch {
    return null;
  }
  if (!istObjekt(daten) || !istObjekt(daten.felder) || !Array.isArray(daten.unsicher)) return null;

  const felder: Record<string, FeldHerkunft> = {};
  for (const [spalte, eintragRoh] of Object.entries(daten.felder)) {
    const eintrag = zuFeldHerkunft(eintragRoh);
    if (!eintrag) return null;
    felder[spalte] = eintrag;
  }

  const unsicher: Unsicher[] = [];
  for (const meldungRoh of daten.unsicher) {
    const meldung = zuUnsicher(meldungRoh);
    if (!meldung) return null;
    unsicher.push(meldung);
  }

  const ergebnis: KartenHerkunft = { felder, unsicher };
  if (daten.lauf !== undefined) {
    const lauf = daten.lauf;
    if (!istObjekt(lauf) || typeof lauf.modell !== "string" || typeof lauf.zeit !== "string") return null;
    ergebnis.lauf = { modell: lauf.modell, zeit: lauf.zeit };
  }
  return ergebnis;
}

/**
 * Einzige Stelle, an der Rohwerte von Baserow in Typen der App umgewandelt werden.
 * Streng: ungültige Herkunft ist ein Fehler. Nachsichtig: die Karte bleibt ohne `herkunft`.
 */
function zuWein(zeile: Zeile, modus: HerkunftModus = "nachsichtig"): Wein {
  const lesewerte: Partial<Record<LeseFeld, string>> = {};
  for (const feld of LESE_FELDER) {
    const roh = rohtext(zeile[feld]);
    if (roh !== undefined) lesewerte[feld] = roh;
  }
  // Alle sechzehn Felder der Prüfkarte; eine fehlende Inhaberspalte gilt hier als leer.
  const pruefwerte: Partial<Record<PruefFeld, string>> = {};
  for (const feld of PRUEF_FELDER) {
    const roh = rohtext(zeile[feld]);
    if (roh !== undefined) pruefwerte[feld] = roh;
  }

  const herkunft = zuHerkunft(zeile[SPALTE_HERKUNFT]);
  if (herkunft === null && modus === "streng") {
    throw new Error(
      "In der Spalte „Herkunft“ steht Text, der sich nicht lesen lässt. Bitte die Spalte in Baserow prüfen.",
    );
  }

  return {
    kennung: text(zeile[SPALTE_KENNUNG]) ?? String(zeile["id"]),
    name: lesewerte["Name"] ?? NAME_FEHLT,
    erzeuger: lesewerte["Erzeuger"],
    art: zuArt(lesewerte["Art"]),
    rebsorten: zuRebsorten(lesewerte["Rebsorten"]),
    jahrgang: lesewerte["Jahrgang"],
    land: lesewerte["Land"],
    region: lesewerte["Region"],
    qualitaetsstufe: lesewerte["Qualitätsstufe"],
    alkohol: zuZahl(lesewerte["Alkohol"]),
    flaschengroesseMl: zuGanzzahl(lesewerte["Flaschengröße"]),
    geschmacksangabe: lesewerte["Geschmacksangabe"],
    allergene: lesewerte["Allergene"],
    ean: lesewerte["EAN"],
    artikelcode: text(zeile[SPALTE_ARTIKELCODE]),
    herkunft: herkunft ?? undefined,
    fotoVorne: dateiAdresse(zeile[SPALTE_FOTO_VORNE]),
    fotoHinten: dateiAdresse(zeile[SPALTE_FOTO_HINTEN]),
    fotoVorneVorschau: vorschau(zeile[SPALTE_FOTO_VORNE]),
    fotoHintenVorschau: vorschau(zeile[SPALTE_FOTO_HINTEN]),
    lesewerte,
    preisFlasche: pruefwerte["Preis Flasche"],
    preisGlas: pruefwerte["Preis Glas"],
    kurztextKurz: pruefwerte["Kurztext kurz"],
    pruefwerte,
    stand: zuStand(zeile[SPALTE_STAND]),
  };
}

/** Wirft, wenn eine der Spalten in der Zeile fehlt. */
function spaltenPruefen(zeile: Zeile, spalten: Iterable<string>): void {
  for (const spalte of spalten) {
    if (!(spalte in zeile)) {
      throw new Error(`Die Spalte „${spalte}“ fehlt in Baserow.`);
    }
  }
}

function neueKennung(): string {
  return `wk-${crypto.randomUUID().slice(0, 8)}`;
}

export function baserowStore({ url, token, tabelle }: Einstellungen): WeinStore {
  const kopf = { Authorization: `Token ${token}` };
  const tabellenAdresse = `${url}/api/database/rows/table/${tabelle}`;
  const zeilenAdresse = `${tabellenAdresse}/?user_field_names=true`;

  /** fetch mit festem Fehlertext, wenn Baserow gar nicht erreichbar ist. */
  async function anfrage(adresse: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(adresse, { ...init, cache: "no-store" });
    } catch {
      throw new Error("Baserow ist nicht erreichbar.");
    }
  }

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

  /**
   * Sucht die eine Zeile mit genau dieser Kennung. null, wenn es keine gibt.
   *
   * Filter: Parameter `filters` (JSON) mit dem Feldnamen; laut API-Doku von Baserow
   * ist der Feldname dort erlaubt, wenn `user_field_names` gesetzt ist.
   * Zur Sicherheit prüft der Code die gelieferten Zeilen selbst auf exakte Gleichheit.
   * Würde Baserow den Filter still übergehen, kämen alle Zeilen; passen sie nicht auf
   * eine Seite, wäre „nicht gefunden“ nicht verlässlich, deshalb ist das dann ein Fehler.
   */
  async function zeileSuchen(kennung: string): Promise<Zeile | null> {
    const filter = {
      filter_type: "AND",
      filters: [{ field: SPALTE_KENNUNG, type: "equal", value: kennung }],
    };
    const adresse =
      `${zeilenAdresse}&size=${SEITENGROESSE}` + `&filters=${encodeURIComponent(JSON.stringify(filter))}`;
    const antwort = await anfrage(adresse, { headers: kopf });
    if (!antwort.ok) {
      throw new Error(`Baserow antwortet beim Suchen der Karte mit Status ${antwort.status}.`);
    }

    const daten: unknown = await antwort.json().catch(() => null);
    if (!istObjekt(daten) || !Array.isArray(daten.results)) {
      throw new Error("Baserow liefert beim Suchen der Karte eine unerwartete Antwort.");
    }
    if (daten.next !== null && daten.next !== undefined) {
      throw new Error(
        "Baserow liefert beim Suchen der Karte mehr Zeilen als erwartet; der Filter auf die Kennung greift offenbar nicht.",
      );
    }

    const treffer = daten.results.filter(
      (zeile): zeile is Zeile => istObjekt(zeile) && zeile[SPALTE_KENNUNG] === kennung,
    );
    if (treffer.length > 1) {
      throw new Error(`Die Kennung ${kennung} steht in mehreren Zeilen.`);
    }
    return treffer[0] ?? null;
  }

  function zeilenId(zeile: Zeile): number {
    const id = zeile["id"];
    if (typeof id !== "number" || !Number.isInteger(id)) {
      throw new Error("Baserow liefert die Zeile ohne gültige Nummer.");
    }
    return id;
  }

  return {
    async liste() {
      const antwort = await fetch(`${zeilenAdresse}&size=${SEITENGROESSE}`, { headers: kopf, cache: "no-store" });
      if (!antwort.ok) {
        throw new Error(`Baserow antwortet mit ${antwort.status}`);
      }
      const daten = (await antwort.json()) as { results: Zeile[] };
      return daten.results.map((zeile) => zuWein(zeile, "nachsichtig"));
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

    async holen(kennung: string, o?: { herkunft?: HerkunftModus }) {
      const zeile = await zeileSuchen(kennung);
      if (!zeile) return null;
      // Die drei Inhaberspalten sind hier nicht Pflicht; erst das Schreiben meldet sie.
      spaltenPruefen(zeile, PFLICHTSPALTEN_HOLEN);
      return zuWein(zeile, o?.herkunft ?? "streng");
    },

    async aktualisieren(kennung, felder, herkunft) {
      const zeile = await zeileSuchen(kennung);
      if (!zeile) {
        throw new Error("Diese Karte gibt es nicht.");
      }

      // Nur die dreizehn Lesespalten; Stand und Fotos gelangen so nie in den Schreibvorgang.
      const daten: Record<string, string | null> = {};
      for (const feld of LESE_FELDER) {
        const wert = felder[feld];
        if (wert !== undefined) daten[feld] = wert;
      }
      daten[SPALTE_HERKUNFT] = JSON.stringify(herkunft);

      // Vorher prüfen, damit bei fehlender Spalte nichts halb geschrieben wird.
      const geschriebeneSpalten = Object.keys(daten);
      spaltenPruefen(zeile, geschriebeneSpalten);

      const antwort = await anfrage(`${tabellenAdresse}/${zeilenId(zeile)}/?user_field_names=true`, {
        method: "PATCH",
        headers: { ...kopf, "Content-Type": "application/json" },
        body: JSON.stringify(daten),
      });
      if (!antwort.ok) {
        throw new Error(`Baserow lehnt das Schreiben der Karte ab (Status ${antwort.status}).`);
      }

      const neueZeile: unknown = await antwort.json().catch(() => null);
      if (!istObjekt(neueZeile)) {
        throw new Error("Baserow liefert nach dem Schreiben eine unerwartete Antwort.");
      }
      spaltenPruefen(neueZeile, geschriebeneSpalten);
    },

    async speichern(kennung: string, aenderung: SpeicherAenderung) {
      const zeile = await zeileSuchen(kennung);
      if (!zeile) {
        throw new Error("Diese Karte gibt es nicht.");
      }

      // Nur Felder der Prüfkarte, Herkunft und Stand; Fotos, Kennung und andere Spalten nie.
      const daten: Record<string, string | null> = {};
      for (const feld of PRUEF_FELDER) {
        const wert = aenderung.felder[feld];
        if (wert !== undefined) daten[feld] = wert;
      }
      daten[SPALTE_HERKUNFT] = JSON.stringify(aenderung.herkunft);
      if (aenderung.stand !== undefined) {
        if (!KARTEN_STAENDE.includes(aenderung.stand)) {
          throw new Error("Der Stand der Karte ist ungültig. Es wurde nichts gespeichert.");
        }
        daten[SPALTE_STAND] = aenderung.stand;
      }

      // Baserow übergeht unbekannte Spalten still; deshalb vorher prüfen, damit nichts halb geschrieben wird.
      const geschriebeneSpalten = Object.keys(daten);
      spaltenPruefen(zeile, geschriebeneSpalten);

      const antwort = await anfrage(`${tabellenAdresse}/${zeilenId(zeile)}/?user_field_names=true`, {
        method: "PATCH",
        headers: { ...kopf, "Content-Type": "application/json" },
        body: JSON.stringify(daten),
      });
      if (!antwort.ok) {
        throw new Error(`Baserow lehnt das Schreiben der Karte ab (Status ${antwort.status}).`);
      }

      const neueZeile: unknown = await antwort.json().catch(() => null);
      if (!istObjekt(neueZeile)) {
        throw new Error("Baserow liefert nach dem Schreiben eine unerwartete Antwort.");
      }
      spaltenPruefen(neueZeile, [...geschriebeneSpalten, ...PFLICHTSPALTEN_HOLEN]);
      if (neueZeile[SPALTE_KENNUNG] !== kennung) {
        throw new Error("Baserow liefert nach dem Schreiben eine andere Karte zurück.");
      }
      // Die Karte, wie Baserow sie nach dem Schreiben meldet; ohne zweites Holen.
      return zuWein(neueZeile, "streng");
    },
  };
}
