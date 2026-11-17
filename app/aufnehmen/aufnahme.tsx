"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LESE_FELDER, NAME_UNGELESEN, type LeseFeld, type Unsicher } from "@/lib/weinkartei/types";
import { lesenAnstossen, type LeseErgebnis } from "@/lib/weinkartei/lesen-anstossen";

type Zustand =
  | { art: "bereit" }
  | { art: "sendet" }
  | { art: "fertig" }
  | { art: "fehler"; text: string };

/** Wie weit das Lesen einer Karteikarte ist. `gelesen` gilt mit und ohne Name. */
type Lesestand =
  | { art: "liest" }
  | {
      art: "gelesen";
      werte: Partial<Record<LeseFeld, string>>;
      unsicher: Unsicher[];
      /** Zahl der Felder, die dieser Lauf gefüllt hat. */
      anzahl: number;
      rueckenfoto: boolean;
    }
  /** Nichts gelesen; `unsicher` nennt verworfene Werte samt Grund. */
  | { art: "leer"; unsicher: Unsicher[] }
  | { art: "fehler"; text: string };

/** Eine Aufnahme dieser Sitzung unter „Gerade aufgenommen“. */
interface Karteikarte {
  kennung: string;
  /** Objekt-URLs der verkleinerten Fotos, nur für die Vorschau. */
  vorne: string;
  hinten?: string;
  /** Nummer des letzten Anstoßes; ältere Ergebnisse werden verworfen. */
  lauf: number;
  stand: Lesestand;
}

/** Felder, die in der Überschrift oder darunter stehen statt als kleines Feld. */
const KOPF_FELDER: readonly LeseFeld[] = ["Name", "Jahrgang", "Erzeuger"];

function zuLesestand(ergebnis: LeseErgebnis): Lesestand {
  if (ergebnis.art === "fehler") return { art: "fehler", text: ergebnis.text };
  const { antwort } = ergebnis;
  if (antwort.gelesen.length === 0) return { art: "leer", unsicher: antwort.unsicher };
  return {
    art: "gelesen",
    werte: antwort.werte,
    unsicher: antwort.unsicher,
    anzahl: antwort.gelesen.length,
    rueckenfoto: antwort.rueckenfoto,
  };
}

/** „3 gelesen · 1 läuft · 1 offen“; Teile mit null entfallen, außer „gelesen“. */
function zaehlerText(karten: Karteikarte[]): string {
  let gelesen = 0;
  let laeuft = 0;
  let offen = 0;
  for (const karte of karten) {
    if (karte.stand.art === "gelesen") gelesen += 1;
    else if (karte.stand.art === "liest") laeuft += 1;
    else offen += 1;
  }
  const teile = [`${gelesen} gelesen`];
  if (laeuft > 0) teile.push(`${laeuft} ${laeuft === 1 ? "läuft" : "laufen"}`);
  if (offen > 0) teile.push(`${offen} offen`);
  return teile.join(" · ");
}

function NochmalKnopf({ onLesen }: { onLesen: () => void }) {
  return (
    <button type="button" className="nochmal" onClick={onLesen}>
      Noch einmal lesen
    </button>
  );
}

/** „unsicher: {Feld} – {Grund}“, eine Zeile je Eintrag; ohne Einträge nichts. */
function UnsicherZeilen({ unsicher }: { unsicher: Unsicher[] }) {
  if (unsicher.length === 0) return null;
  return (
    <ul className="unsicher-zeilen">
      {unsicher.map((eintrag, i) => (
        <li key={`${eintrag.feld}-${i}`}>
          unsicher: {eintrag.feld} – {eintrag.grund}
        </li>
      ))}
    </ul>
  );
}

function Gelesen({ stand, onLesen }: { stand: Extract<Lesestand, { art: "gelesen" }>; onLesen: () => void }) {
  const { werte, unsicher } = stand;
  const istUnsicher = (feld: LeseFeld) => unsicher.some((eintrag) => eintrag.feld === feld);
  const fragezeichen = (feld: LeseFeld) => (istUnsicher(feld) ? " ?" : "");
  const klasse = (grund: string, feld: LeseFeld) => (istUnsicher(feld) ? `${grund} unsicher` : grund);

  const name = werte.Name && werte.Name !== NAME_UNGELESEN ? werte.Name : undefined;
  const jahrgang = werte.Jahrgang;
  const erzeuger = werte.Erzeuger;
  // Ohne Name steht der Jahrgang bei den kleinen Feldern statt in der Überschrift.
  const kopf: readonly LeseFeld[] = name ? KOPF_FELDER : ["Name", "Erzeuger"];
  const angaben = LESE_FELDER.filter((feld) => !kopf.includes(feld) && werte[feld] !== undefined);

  return (
    <>
      {name ? (
        <div className="titel">
          <h3 className={klasse("name", "Name")}>
            {name}
            {fragezeichen("Name")}
          </h3>
          {jahrgang ? (
            <span className={klasse("jahr", "Jahrgang")}>
              {jahrgang === "ohne" ? "ohne Jahrgang" : jahrgang}
              {fragezeichen("Jahrgang")}
            </span>
          ) : null}
        </div>
      ) : (
        <h3>Gelesen, aber kein Name gefunden.</h3>
      )}
      {erzeuger ? (
        <p className={klasse("hinweis erzeuger", "Erzeuger")}>
          {erzeuger}
          {fragezeichen("Erzeuger")}
        </p>
      ) : null}
      {angaben.length > 0 ? (
        <ul className="angaben">
          {angaben.map((feld) => (
            <li key={feld} className={istUnsicher(feld) ? "unsicher" : undefined}>
              <span className="feld">
                {feld}
                {fragezeichen(feld)}
              </span>
              {werte[feld]}
            </li>
          ))}
        </ul>
      ) : null}
      <UnsicherZeilen unsicher={unsicher} />
      <p className="hinweis fuss">
        {stand.anzahl} {stand.anzahl === 1 ? "Angabe" : "Angaben"} vom Etikett
        {stand.rueckenfoto ? "" : " · nur Vorderetikett"}
      </p>
      {name ? null : <NochmalKnopf onLesen={onLesen} />}
    </>
  );
}

function Inhalt({ stand, onLesen }: { stand: Lesestand; onLesen: () => void }) {
  switch (stand.art) {
    case "liest":
      return (
        <>
          <h3>Wird gelesen …</h3>
          <div className="gerippe" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </>
      );
    case "gelesen":
      return <Gelesen stand={stand} onLesen={onLesen} />;
    case "leer":
      return (
        <>
          <h3>Auf den Fotos war nichts zu lesen.</h3>
          <p className="hinweis erzeuger">Die Karte heißt weiter „{NAME_UNGELESEN}“.</p>
          <UnsicherZeilen unsicher={stand.unsicher} />
          <NochmalKnopf onLesen={onLesen} />
        </>
      );
    case "fehler":
      return (
        <>
          <div role="alert">
            <h3 className="fehler">Lesen hat nicht geklappt.</h3>
            <p className="hinweis erzeuger">{stand.text}</p>
          </div>
          <NochmalKnopf onLesen={onLesen} />
        </>
      );
  }
}

function Karte({ karte, onLesen }: { karte: Karteikarte; onLesen: () => void }) {
  const art = karte.stand.art === "fehler" ? "fehler-karte" : karte.stand.art;
  // Neuer Schlüssel je Lauf und Stand: Das Ergebnis blendet weich über, eine neue Karte nicht.
  const wechsel = karte.stand.art === "liest" ? "inhalt" : "inhalt wechsel";
  return (
    <li className={`karte ${art}`}>
      <div className="fotos">
        <img src={karte.vorne} alt="" width={40} height={64} />
        {karte.hinten ? <img src={karte.hinten} alt="" width={40} height={64} /> : null}
      </div>
      <div className={wechsel} key={`${karte.lauf}-${karte.stand.art}`}>
        <Inhalt stand={karte.stand} onLesen={onLesen} />
      </div>
    </li>
  );
}

const LANGE_KANTE = 1600;

/** iPhone-Fotos kommen am Rechner als HEIC an; die meisten Browser können das nicht anzeigen. */
function istHeic(datei: File): boolean {
  return /image\/hei[cf]/i.test(datei.type) || /\.hei[cf]$/i.test(datei.name);
}

async function heicZuJpeg(datei: File): Promise<Blob> {
  // Wird nur geladen, wenn wirklich ein HEIC-Foto kommt.
  // @ts-ignore – das Paket bringt je nach Version keine Typen mit.
  const paket = (await import("heic-to")) as {
    heicTo: (auftrag: { blob: Blob; type: string; quality?: number }) => Promise<Blob>;
  };
  return paket.heicTo({ blob: datei, type: "image/jpeg", quality: 0.9 });
}

async function zeichnen(quelle: Blob): Promise<Blob> {
  const bild = await createImageBitmap(quelle);
  const faktor = Math.min(1, LANGE_KANTE / Math.max(bild.width, bild.height));
  const leinwand = document.createElement("canvas");
  leinwand.width = Math.round(bild.width * faktor);
  leinwand.height = Math.round(bild.height * faktor);
  leinwand.getContext("2d")?.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
  bild.close();
  const blob = await new Promise<Blob | null>((fertig) => leinwand.toBlob(fertig, "image/jpeg", 0.82));
  if (!blob) throw new Error("Das Foto ließ sich nicht umwandeln.");
  return blob;
}

/**
 * Macht aus jedem Foto ein verkleinertes JPEG, damit es schnell hochlädt
 * und überall angezeigt werden kann. HEIC wird vorher umgewandelt.
 */
async function verkleinern(datei: File): Promise<Blob> {
  try {
    return await zeichnen(datei);
  } catch {
    if (istHeic(datei)) {
      return zeichnen(await heicZuJpeg(datei));
    }
    throw new Error(`„${datei.name}“ ist kein Foto, das dieser Browser lesen kann. Bitte als JPEG oder PNG wählen.`);
  }
}

export function Aufnahme() {
  const [vorne, setVorne] = useState<File | null>(null);
  const [hinten, setHinten] = useState<File | null>(null);
  const [zustand, setZustand] = useState<Zustand>({ art: "bereit" });
  const [lauf, setLauf] = useState(0); // setzt die Dateifelder nach jeder Aufnahme zurück
  const [karten, setKarten] = useState<Karteikarte[]>([]); // neueste zuerst
  const leseZaehler = useRef(0); // nummeriert jeden Anstoß zum Lesen
  const vorschauen = useRef<string[]>([]); // alle Objekt-URLs, zum Freigeben

  // Beim Verlassen der Seite alle Vorschauen freigeben.
  useEffect(() => {
    const urls = vorschauen.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.length = 0;
    };
  }, []);

  function vorschau(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    vorschauen.current.push(url);
    return url;
  }

  /**
   * Stößt das Lesen an, ohne dass jemand darauf wartet. Das Ergebnis landet nur bei der Karteikarte
   * mit dieser Kennung und nur, wenn sie inzwischen nicht neu angestoßen wurde.
   */
  function anstossen(kennung: string, leseLauf: number) {
    void lesenAnstossen(kennung).then((ergebnis) => {
      const stand = zuLesestand(ergebnis);
      setKarten((alle) =>
        alle.map((karte) => (karte.kennung === kennung && karte.lauf === leseLauf ? { ...karte, stand } : karte)),
      );
    });
  }

  function nochmalLesen(kennung: string) {
    const leseLauf = ++leseZaehler.current;
    setKarten((alle) =>
      alle.map((karte) => (karte.kennung === kennung ? { ...karte, lauf: leseLauf, stand: { art: "liest" } } : karte)),
    );
    anstossen(kennung, leseLauf);
  }

  async function senden() {
    if (!vorne) return;
    setZustand({ art: "sendet" });
    const formular = new FormData();
    let vorneKlein: Blob;
    let hintenKlein: Blob | undefined;
    try {
      vorneKlein = await verkleinern(vorne);
      formular.append("vorne", vorneKlein, "vorne.jpg");
      if (hinten) {
        hintenKlein = await verkleinern(hinten);
        formular.append("hinten", hintenKlein, "hinten.jpg");
      }
    } catch (fehler) {
      const text = fehler instanceof Error && fehler.message ? fehler.message : "Das Foto ließ sich nicht lesen.";
      setZustand({ art: "fehler", text });
      return;
    }
    try {
      const antwort = await fetch("/api/weine", { method: "POST", body: formular });
      const daten = (await antwort.json()) as { kennung?: string; fehler?: string };
      if (!antwort.ok || !daten.kennung) {
        setZustand({ art: "fehler", text: daten.fehler ?? `Fehler ${antwort.status}` });
        return;
      }
      const kennung = daten.kennung;
      const leseLauf = ++leseZaehler.current;
      const neu: Karteikarte = {
        kennung,
        vorne: vorschau(vorneKlein),
        hinten: hintenKlein ? vorschau(hintenKlein) : undefined,
        lauf: leseLauf,
        stand: { art: "liest" },
      };
      setKarten((alle) => [neu, ...alle]);
      setZustand({ art: "fertig" });
      setVorne(null);
      setHinten(null);
      setLauf((n) => n + 1);
      anstossen(kennung, leseLauf);
    } catch {
      setZustand({ art: "fehler", text: "Keine Verbindung. Bitte noch einmal versuchen." });
    }
  }

  return (
    <>
      <div className="formular" key={lauf}>
        <label htmlFor="vorne">1. Vorderetikett</label>
        <input
          id="vorne"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setVorne(e.target.files?.[0] ?? null)}
        />

        <label htmlFor="hinten">2. Rückenetikett</label>
        <input
          id="hinten"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setHinten(e.target.files?.[0] ?? null)}
        />
        <p className="hinweis">Auf dem Rückenetikett stehen Erzeuger, Herkunft und Alkohol.</p>

        <button type="button" onClick={senden} disabled={!vorne || zustand.art === "sendet"}>
          {zustand.art === "sendet" ? "Wird gespeichert …" : "Wein speichern"}
        </button>

        {zustand.art === "fertig" ? (
          <p className="erfolg" role="status">
            Gespeichert. Du kannst gleich den nächsten Wein aufnehmen.
          </p>
        ) : null}
        {zustand.art === "fehler" ? (
          <p className="fehler" role="alert">
            {zustand.text}
          </p>
        ) : null}
      </div>

      {karten.length > 0 ? (
        <section className="gerade" aria-live="polite">
          <div className="kopfzeile">
            <h2>Gerade aufgenommen</h2>
            <span className="hinweis">{zaehlerText(karten)}</span>
          </div>
          <ul className="karten">
            {karten.map((karte) => (
              <Karte key={karte.kennung} karte={karte} onLesen={() => nochmalLesen(karte.kennung)} />
            ))}
          </ul>
        </section>
      ) : null}

      <p>
        <Link href="/weine">Alle Weine ansehen</Link>
      </p>
    </>
  );
}
