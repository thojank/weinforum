import "server-only";

import type { LeseFeld, Modellantwort } from "./types";

// Lesen der Etiketten über OpenRouter. Die Fotos werden vom Speicher der Dateien geladen und
// als Daten-URL geschickt; zurück kommt eine strukturell geprüfte Antwort mit Spaltennamen.
// Ob die Werte selbst gültig sind, entscheidet erst `pruefen`.

/** Adresse für Chat Completions bei OpenRouter. */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
/** Zeitgrenze für den Aufruf des Modells; die Route hat insgesamt 60 Sekunden. */
const ZEITGRENZE_MODELL_MS = 45_000;
/** Zeitgrenze für das Laden eines Fotos. */
const ZEITGRENZE_FOTO_MS = 10_000;
/** Höchstzahl an Tokens für die Antwort. */
const MAX_TOKENS = 1500;
/** Medientyp, wenn der Antwortkopf des Speichers keinen Bildtyp nennt. */
const MEDIENTYP_ERSATZ = "image/jpeg";
/** Name der Antwortstruktur in der Anfrage. */
const SCHEMA_NAME = "etikett";

/** Die fünf Sätze für die Oberfläche. Die Route gibt `Error.message` unverändert weiter. */
export const LESE_FEHLER = {
  keineAntwort: "Das Sprachmodell hat nicht geantwortet.",
  zuLange: "Das Lesen hat zu lange gedauert.",
  nichtVerwertbar: "Die Antwort des Sprachmodells war nicht verwertbar.",
  strukturNichtLieferbar: "Das eingestellte Modell kann die feste Antwortstruktur nicht liefern.",
  foto: "Das Foto ließ sich nicht aus der Datenbank laden.",
} as const;

/** Schlüssel der Antwortstruktur (klein, ohne Umlaute) → Spaltenname in Baserow. */
const SCHLUESSEL_ZU_SPALTE = {
  name: "Name",
  erzeuger: "Erzeuger",
  art: "Art",
  rebsorten: "Rebsorten",
  jahrgang: "Jahrgang",
  land: "Land",
  region: "Region",
  qualitaetsstufe: "Qualitätsstufe",
  alkohol: "Alkohol",
  flaschengroesse: "Flaschengröße",
  geschmacksangabe: "Geschmacksangabe",
  allergene: "Allergene",
  ean: "EAN",
} as const satisfies Record<string, LeseFeld>;

type Schluessel = keyof typeof SCHLUESSEL_ZU_SPALTE;

/** Die dreizehn Schlüssel in der Reihenfolge der Spalten. */
const SCHLUESSEL = Object.keys(SCHLUESSEL_ZU_SPALTE) as Schluessel[];

/** Erlaubte Werte für `art`, genau wie die Texte der Spalte „Art“. */
const ART_WERTE = ["Schaumwein", "Weiß", "Rosé", "Rot", "Süßwein", "alkoholfrei", "Sonstiges", null];

/** Auftrag an das Modell (Systemnachricht). */
const AUFTRAG = [
  "Du bekommst ein oder zwei Fotos einer Weinflasche: zuerst das Vorderetikett, dann, falls vorhanden, das Rückenetikett. Übertrage in die vorgegebene Struktur ausschließlich, was auf den Etiketten gedruckt steht.",
  "",
  "Regeln:",
  "- Rate nichts. Ergänze nichts aus deinem Wissen über Wein, Erzeuger, Rebsorten oder Regionen.",
  "- Ist eine Angabe nicht lesbar oder nicht vorhanden, gib für Wert und Seite `null` zurück.",
  "- Ist auf einem Foto kein Etikett zu erkennen, gib für alle Felder `null` zurück.",
  "- Gib zu jedem Wert an, ob er vorne oder hinten stand. Steht er auf beiden Seiten, nimm die Seite, auf der er besser lesbar ist.",
  "- Schreibe Namen so, wie sie gedruckt sind, mit Akzenten. Der Name des Weins enthält weder Erzeuger noch Jahrgang.",
  "- Art: nur wenn ein Wort auf dem Etikett die Art nennt, zum Beispiel „Rotwein“, „Vin blanc“, „Sekt“, „alkoholfrei“. Schließe die Art nicht aus Rebsorte, Region oder Farbe der Flasche.",
  "- Land: nur wenn das Land selbst genannt ist. Schließe es nicht aus Region, Ort oder Sprache.",
  "- Jahrgang: vier Ziffern. „ohne“ nur, wenn das Etikett ausdrücklich sagt, dass es keinen Jahrgang gibt. Steht keiner da, `null`.",
  "- Alkohol: nur die Zahl in % vol mit Punkt, zum Beispiel 12.5. Flaschengröße: nur die Zahl in Millilitern, zum Beispiel 750.",
  "- Rebsorten: wie gedruckt, mit Komma getrennt.",
  "- Strichcode-Nummer: nur die Ziffern unter dem Strichcode, und nur, wenn jede Ziffer lesbar ist.",
  "- Nenne unter `unsicher` jedes Feld, bei dem du dir nicht sicher bist, mit einem kurzen Grund.",
].join("\n");

/** Hinweis statt der Teile zum Rückenetikett, wenn es kein Rückenfoto gibt. */
const HINWEIS_NUR_EIN_FOTO = "Es gibt nur dieses eine Foto. Gib für kein Feld die Seite ‚hinten‘ an.";

/**
 * Meldungen von OpenRouter, die bedeuten, dass kein Anbieter die Parameter bzw. die
 * Antwortstruktur liefern kann (etwa 404 „No endpoints found that can handle the requested
 * parameters“ oder 503 „no available model provider that meets your routing requirements“).
 */
const MUSTER_STRUKTUR_NICHT_LIEFERBAR =
  /requested parameters|routing requirements|response_format|json_schema|structured output/i;

/** Statuscodes, mit denen OpenRouter eine Zeitüberschreitung meldet. */
const STATUS_ZEITGRENZE = new Set([408, 504, 524]);

// ---------------------------------------------------------------------------
// Einstellungen

/**
 * Schlüssel und Modell aus der Umgebung. Leerer Text zählt als fehlend.
 * Gibt bei Fehlen nur den Namen der Variable zurück, nie einen Wert.
 */
export function leseEinstellungen():
  | { apiKey: string; modell: string }
  | { fehlt: "OPENROUTER_API_KEY" | "MODELL_ID" } {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (apiKey === "") return { fehlt: "OPENROUTER_API_KEY" };
  const modell = process.env.MODELL_ID?.trim() ?? "";
  if (modell === "") return { fehlt: "MODELL_ID" };
  return { apiKey, modell };
}

// ---------------------------------------------------------------------------
// Anfrage

/** Ein Teil der Nutzernachricht: Text oder Bild. */
type Inhaltsteil =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** Schema eines Feldes: Wert und Seite, beide Text oder `null`. */
function feldSchema(werte?: (string | null)[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["wert", "seite"],
    properties: {
      wert: werte ? { type: ["string", "null"], enum: werte } : { type: ["string", "null"] },
      seite: { type: ["string", "null"], enum: ["vorne", "hinten", null] },
    },
  };
}

/** Die feste Antwortstruktur wie in der technischen Spezifikation. */
export function antwortSchema() {
  const properties: Record<string, unknown> = {};
  for (const schluessel of SCHLUESSEL) {
    properties[schluessel] = schluessel === "art" ? feldSchema(ART_WERTE) : feldSchema();
  }
  properties.unsicher = {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      required: ["feld", "grund"],
      properties: {
        feld: { type: "string", enum: SCHLUESSEL },
        grund: { type: "string" },
      },
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: [...SCHLUESSEL, "unsicher"],
    properties,
  };
}

/** Körper der Anfrage an OpenRouter; `vorne`/`hinten` sind Daten-URLs. */
export function anfrageKoerper(modell: string, bilder: { vorne: string; hinten?: string }) {
  const teile: Inhaltsteil[] = [
    { type: "text", text: "Foto 1: Vorderetikett" },
    { type: "image_url", image_url: { url: bilder.vorne } },
  ];
  if (bilder.hinten) {
    teile.push(
      { type: "text", text: "Foto 2: Rückenetikett" },
      { type: "image_url", image_url: { url: bilder.hinten } },
    );
  } else {
    teile.push({ type: "text", text: HINWEIS_NUR_EIN_FOTO });
  }
  return {
    model: modell,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: AUFTRAG },
      { role: "user", content: teile },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: SCHEMA_NAME, strict: true, schema: antwortSchema() },
    },
    provider: { require_parameters: true },
  };
}

// ---------------------------------------------------------------------------
// Fehler und Protokoll

/** Art des Fehlers fürs Protokoll; nie Inhalte. */
type FehlerArt =
  | "foto"
  | "netz"
  | "zeitgrenze"
  | "status"
  | "fehler-in-antwort"
  | "struktur-nicht-lieferbar"
  | "kein-inhalt"
  | "laenge"
  | "kein-json"
  | "struktur";

/** Fehler mit Satz für die Oberfläche und Angaben fürs Protokoll. */
class LeseFehler extends Error {
  readonly art: FehlerArt;
  readonly status?: number;
  readonly fehlerTyp?: string;

  constructor(satz: string, art: FehlerArt, status?: number, fehlerTyp?: string) {
    super(satz);
    this.name = "LeseFehler";
    this.art = art;
    this.status = status;
    this.fehlerTyp = fehlerTyp;
  }
}

/** Eine Zeile ins Protokoll: Kennung, Modell, Dauer, Statuscode, Art des Fehlers. */
function protokolliere(
  angaben: { kennung: string; modell: string; dauerMs: number; status?: number; art?: FehlerArt; fehlerTyp?: string },
) {
  const teile = [
    `kennung=${angaben.kennung}`,
    `modell=${angaben.modell}`,
    `dauerMs=${angaben.dauerMs}`,
    `status=${angaben.status ?? "-"}`,
  ];
  if (angaben.art) {
    teile.push(`fehler=${angaben.art}`);
    if (angaben.fehlerTyp) teile.push(`typ=${angaben.fehlerTyp}`);
    console.warn(`[lesen] ${teile.join(" ")}`);
  } else {
    console.info(`[lesen] ${teile.join(" ")}`);
  }
}

function istZeitgrenze(fehler: unknown): boolean {
  return fehler instanceof Error && (fehler.name === "TimeoutError" || fehler.name === "AbortError");
}

function istObjekt(wert: unknown): wert is Record<string, unknown> {
  return typeof wert === "object" && wert !== null && !Array.isArray(wert);
}

/** Liest `error.message` und `error.metadata.error_type` aus einem Fehlerobjekt von OpenRouter. */
function fehlerAngaben(fehler: unknown): { code?: number; meldung: string; fehlerTyp?: string } {
  if (!istObjekt(fehler)) return { meldung: "" };
  const meldung = typeof fehler.message === "string" ? fehler.message : "";
  const code = typeof fehler.code === "number" ? fehler.code : undefined;
  const metadaten = istObjekt(fehler.metadata) ? fehler.metadata : undefined;
  const typ = metadaten && typeof metadaten.error_type === "string" ? metadaten.error_type : undefined;
  // Nur kurze, feste Bezeichner ins Protokoll, nie freien Text.
  const fehlerTyp = typ && /^[a-z_]{1,40}$/.test(typ) ? typ : undefined;
  return { code, meldung, fehlerTyp };
}

/** Ordnet einen Fehler von OpenRouter (Status oder `error`-Objekt) einem der Sätze zu. */
function fehlerVonOpenRouter(
  status: number | undefined,
  fehler: unknown,
  art: "status" | "fehler-in-antwort",
): LeseFehler {
  const { code, meldung, fehlerTyp } = fehlerAngaben(fehler);
  const wirksamerCode = art === "status" ? status : (code ?? status);
  if (fehlerTyp !== "provider_overloaded" && MUSTER_STRUKTUR_NICHT_LIEFERBAR.test(meldung)) {
    return new LeseFehler(LESE_FEHLER.strukturNichtLieferbar, "struktur-nicht-lieferbar", wirksamerCode, fehlerTyp);
  }
  if ((wirksamerCode !== undefined && STATUS_ZEITGRENZE.has(wirksamerCode)) || fehlerTyp === "timeout") {
    return new LeseFehler(LESE_FEHLER.zuLange, "zeitgrenze", wirksamerCode, fehlerTyp);
  }
  return new LeseFehler(LESE_FEHLER.keineAntwort, art, wirksamerCode, fehlerTyp);
}

// ---------------------------------------------------------------------------
// Fotos

/**
 * Lädt die volle Datei von der Adresse aus Baserow und gibt sie als Daten-URL zurück.
 * Ohne `Authorization`-Kopf: Der Baserow-Token geht nicht an den Speicher der Dateien.
 */
async function fotoAlsDatenUrl(adresse: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    throw new LeseFehler(LESE_FEHLER.foto, "foto");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new LeseFehler(LESE_FEHLER.foto, "foto");
  }

  let antwort: Response;
  let daten: ArrayBuffer;
  try {
    antwort = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ZEITGRENZE_FOTO_MS) });
    if (!antwort.ok) throw new LeseFehler(LESE_FEHLER.foto, "foto", antwort.status);
    daten = await antwort.arrayBuffer();
  } catch (fehler) {
    if (fehler instanceof LeseFehler) throw fehler;
    throw new LeseFehler(LESE_FEHLER.foto, "foto");
  }
  if (daten.byteLength === 0) throw new LeseFehler(LESE_FEHLER.foto, "foto", antwort.status);

  const kopf = antwort.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  const medientyp = kopf.startsWith("image/") ? kopf : MEDIENTYP_ERSATZ;
  return `data:${medientyp};base64,${Buffer.from(daten).toString("base64")}`;
}

// ---------------------------------------------------------------------------
// Antwort prüfen

function istTextOderNull(wert: unknown): wert is string | null {
  return wert === null || typeof wert === "string";
}

/**
 * Prüft nur die Struktur und bildet die Schlüssel auf Spaltennamen ab.
 * Gibt `null` zurück, wenn die Struktur nicht passt.
 */
export function strukturPruefen(roh: unknown): Modellantwort | null {
  if (!istObjekt(roh)) return null;

  const felder = {} as Modellantwort["felder"];
  for (const schluessel of SCHLUESSEL) {
    const feld = roh[schluessel];
    if (!istObjekt(feld)) return null;
    if (!("wert" in feld) || !("seite" in feld)) return null;
    if (!istTextOderNull(feld.wert) || !istTextOderNull(feld.seite)) return null;
    felder[SCHLUESSEL_ZU_SPALTE[schluessel]] = { wert: feld.wert, seite: feld.seite };
  }

  if (!Array.isArray(roh.unsicher)) return null;
  const unsicher: Modellantwort["unsicher"] = [];
  for (const eintrag of roh.unsicher) {
    // Unvollständige Einträge werden still übergangen; die Liste selbst ist Pflicht.
    if (!istObjekt(eintrag) || typeof eintrag.feld !== "string" || typeof eintrag.grund !== "string") continue;
    const spalte = (SCHLUESSEL_ZU_SPALTE as Record<string, LeseFeld>)[eintrag.feld];
    unsicher.push({ feld: spalte ?? eintrag.feld, grund: eintrag.grund });
  }

  return { felder, unsicher };
}

/** Liest Inhalt und `finish_reason` der ersten Wahl aus einer Antwort mit Status 2xx. */
function antwortAuswerten(koerper: unknown, status: number | undefined): Modellantwort {
  if (!istObjekt(koerper)) {
    throw new LeseFehler(LESE_FEHLER.nichtVerwertbar, "kein-json", status);
  }
  if (koerper.error !== undefined && koerper.error !== null) {
    throw fehlerVonOpenRouter(status, koerper.error, "fehler-in-antwort");
  }

  const wahl = Array.isArray(koerper.choices) ? koerper.choices[0] : undefined;
  if (!istObjekt(wahl)) throw new LeseFehler(LESE_FEHLER.nichtVerwertbar, "kein-inhalt", status);
  if (wahl.finish_reason === "length") {
    throw new LeseFehler(LESE_FEHLER.nichtVerwertbar, "laenge", status);
  }
  const nachricht = istObjekt(wahl.message) ? wahl.message : undefined;
  const inhalt = nachricht?.content;
  if (typeof inhalt !== "string" || inhalt.trim() === "") {
    throw new LeseFehler(LESE_FEHLER.nichtVerwertbar, "kein-inhalt", status);
  }

  let roh: unknown;
  try {
    roh = JSON.parse(inhalt);
  } catch {
    throw new LeseFehler(LESE_FEHLER.nichtVerwertbar, "kein-json", status);
  }
  const antwort = strukturPruefen(roh);
  if (!antwort) throw new LeseFehler(LESE_FEHLER.nichtVerwertbar, "struktur", status);
  return antwort;
}

// ---------------------------------------------------------------------------
// Aufruf

/**
 * Lässt die Etiketten vom Modell aus `MODELL_ID` lesen. Kein automatisches Wiederholen.
 * Wirft `Error` mit einem der Sätze aus `LESE_FEHLER`.
 */
export async function lesen(
  fotos: { vorne: string; hinten?: string },
  einst: { apiKey: string; modell: string },
  kennung: string,
): Promise<Modellantwort> {
  const beginn = Date.now();
  let status: number | undefined;
  try {
    const [vorne, hinten] = await Promise.all([
      fotoAlsDatenUrl(fotos.vorne),
      fotos.hinten ? fotoAlsDatenUrl(fotos.hinten) : Promise.resolve(undefined),
    ]);

    let koerper: unknown;
    try {
      const antwort = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${einst.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(anfrageKoerper(einst.modell, { vorne, hinten })),
        cache: "no-store",
        signal: AbortSignal.timeout(ZEITGRENZE_MODELL_MS),
      });
      status = antwort.status;
      const text = await antwort.text();
      try {
        koerper = JSON.parse(text);
      } catch {
        koerper = undefined;
      }
      if (!antwort.ok) {
        throw fehlerVonOpenRouter(antwort.status, istObjekt(koerper) ? koerper.error : undefined, "status");
      }
    } catch (fehler) {
      if (fehler instanceof LeseFehler) throw fehler;
      if (istZeitgrenze(fehler)) throw new LeseFehler(LESE_FEHLER.zuLange, "zeitgrenze", status);
      throw new LeseFehler(LESE_FEHLER.keineAntwort, "netz", status);
    }

    const ergebnis = antwortAuswerten(koerper, status);
    protokolliere({ kennung, modell: einst.modell, dauerMs: Date.now() - beginn, status });
    return ergebnis;
  } catch (fehler) {
    const lesefehler =
      fehler instanceof LeseFehler ? fehler : new LeseFehler(LESE_FEHLER.nichtVerwertbar, "struktur", status);
    protokolliere({
      kennung,
      modell: einst.modell,
      dauerMs: Date.now() - beginn,
      status: lesefehler.status ?? status,
      art: lesefehler.art,
      fehlerTyp: lesefehler.fehlerTyp,
    });
    throw lesefehler;
  }
}
