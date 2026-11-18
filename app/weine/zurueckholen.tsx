"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { karteBearbeiten } from "@/lib/weinkartei/karte-bearbeiten";

type Zustand = { art: "bereit" } | { art: "holt" } | { art: "fehler"; text: string };

const TEXT_GESCHEITERT = "Zurückholen hat nicht geklappt.";

/**
 * Knopf „Zurückholen“ für eine Zeile im Abschnitt „Ausgelistet“. Setzt die Karte wieder auf
 * `aufgenommen`; danach ordnet die neu geladene Seite sie in ihren Stapel ein.
 */
export function Zurueckholen({ kennung }: { kennung: string }) {
  const router = useRouter();
  const [zustand, setZustand] = useState<Zustand>({ art: "bereit" });
  // Läuft, bis die neu geladene Liste da ist; so bleibt der Knopf bis dahin gesperrt.
  const [laedtNeu, neuLaden] = useTransition();

  async function zurueckholen() {
    setZustand({ art: "holt" });
    const ergebnis = await karteBearbeiten(kennung, { aktion: "zurueckholen" });
    if (ergebnis.art === "fehler") {
      setZustand({ art: "fehler", text: `${TEXT_GESCHEITERT} ${ergebnis.text}` });
      return;
    }
    neuLaden(() => {
      setZustand({ art: "bereit" });
      router.refresh();
    });
  }

  const beschaeftigt = zustand.art === "holt" || laedtNeu;

  return (
    <>
      <button type="button" className="nochmal" disabled={beschaeftigt} onClick={zurueckholen}>
        {beschaeftigt ? "Holt zurück …" : "Zurückholen"}
      </button>
      {zustand.art === "fehler" && (
        <p className="meldung fehler" role="alert">
          {zustand.text}
        </p>
      )}
    </>
  );
}
