"use client";

import { useState } from "react";
import Link from "next/link";

type Zustand =
  | { art: "bereit" }
  | { art: "sendet" }
  | { art: "fertig"; kennung: string }
  | { art: "fehler"; text: string };

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

  async function senden() {
    if (!vorne) return;
    setZustand({ art: "sendet" });
    const formular = new FormData();
    try {
      formular.append("vorne", await verkleinern(vorne), "vorne.jpg");
      if (hinten) formular.append("hinten", await verkleinern(hinten), "hinten.jpg");
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
      setZustand({ art: "fertig", kennung: daten.kennung });
      setVorne(null);
      setHinten(null);
      setLauf((n) => n + 1);
    } catch {
      setZustand({ art: "fehler", text: "Keine Verbindung. Bitte noch einmal versuchen." });
    }
  }

  return (
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
          Gespeichert ({zustand.kennung}). Du kannst gleich den nächsten Wein aufnehmen.
        </p>
      ) : null}
      {zustand.art === "fehler" ? (
        <p className="fehler" role="alert">
          {zustand.text}
        </p>
      ) : null}

      <Link href="/weine">Alle Weine ansehen</Link>
    </div>
  );
}
