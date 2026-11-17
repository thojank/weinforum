"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lesenAnstossen } from "@/lib/weinkartei/lesen-anstossen";
import type { Unsicher } from "@/lib/weinkartei/types";

type Zustand =
  | { art: "bereit" }
  | { art: "liest" }
  /** `unsicher` nennt Unsicheres und verworfene Werte samt Grund. */
  | { art: "hinweis"; text: string; unsicher: Unsicher[] }
  | { art: "fehler"; text: string };

const TEXT_KEIN_NAME = "Gelesen, aber kein Name gefunden.";
const TEXT_NICHTS_GELESEN = "Auf den Fotos war nichts zu lesen.";
const TEXT_GESCHEITERT = "Lesen hat nicht geklappt.";

/**
 * Knopf „Noch einmal lesen“ für eine Karte im Stapel „Noch zu lesen“.
 * Steht im Kästchen der Karte neben dem Verweis auf die Prüfkarte, nie darin;
 * Satz und Knopf belegen dort je eine volle Zeile.
 */
export function NochmalLesen({ kennung }: { kennung: string }) {
  const router = useRouter();
  const [zustand, setZustand] = useState<Zustand>({ art: "bereit" });
  // Läuft, bis die neu geladene Liste da ist. So bleibt der Knopf zwischen Antwort
  // und neuer Seite gesperrt und lädt nicht zu einem zweiten Tipp ein.
  const [laedtNeu, neuLaden] = useTransition();

  async function lesen() {
    setZustand({ art: "liest" });
    const ergebnis = await lesenAnstossen(kennung);
    if (ergebnis.art === "fehler") {
      setZustand({ art: "fehler", text: `${TEXT_GESCHEITERT} ${ergebnis.text}` });
      return;
    }
    const { antwort } = ergebnis;
    if (antwort.name) {
      // Die Seite ordnet die Karte neu ein; das Kästchen verschwindet dann aus diesem Stapel.
      // Der Zustand wechselt erst zusammen mit der neuen Seite zurück.
      neuLaden(() => {
        setZustand({ art: "bereit" });
        router.refresh();
      });
      return;
    }
    setZustand({
      art: "hinweis",
      text: antwort.gelesen.length === 0 ? TEXT_NICHTS_GELESEN : TEXT_KEIN_NAME,
      unsicher: antwort.unsicher,
    });
  }

  const beschaeftigt = zustand.art === "liest" || laedtNeu;

  return (
    <>
      {zustand.art === "hinweis" && (
        <div className="meldung" role="status">
          <p>{zustand.text}</p>
          {zustand.unsicher.length > 0 && (
            <ul className="unsicher-zeilen">
              {zustand.unsicher.map((eintrag, i) => (
                <li key={`${eintrag.feld}-${i}`}>
                  unsicher: {eintrag.feld} – {eintrag.grund}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {zustand.art === "fehler" && (
        <p className="meldung fehler" role="alert">
          {zustand.text}
        </p>
      )}
      <button type="button" className="nochmal" disabled={beschaeftigt} onClick={lesen}>
        {beschaeftigt ? "Liest …" : "Noch einmal lesen"}
      </button>
    </>
  );
}
