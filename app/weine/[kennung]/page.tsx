import type { ReactNode } from "react";
import Link from "next/link";
import { einordnen } from "@/lib/weinkartei/pruefkarte";
import { weinStore, type WeinStore } from "@/lib/weinkartei/store";
import { KENNUNG_MUSTER, type Wein } from "@/lib/weinkartei/types";
import { kopfWerte, TEXT_HERKUNFT_UNLESBAR, type Fotos } from "./felder";
import { NurFotos } from "./fotos";
import { PruefkarteInhalt, type Naechste } from "./pruefkarte";

export const dynamic = "force-dynamic";

/** Satz, wenn das Holen mit etwas Unerwartetem scheitert (wie in der Leseroute). */
const TEXT_HOLEN = "Die Karte ließ sich nicht aus der Datenbank holen.";
const TEXT_GIBT_ES_NICHT = "Diese Karte gibt es nicht.";

/** Fehlerseiten: Rück-Link, Überschrift, ein Satz. */
function Rahmen({ titel, children }: { titel: string; children?: ReactNode }) {
  return (
    <div className="pruefkarte">
      <p className="zurueck">
        <Link href="/weine" prefetch={false}>
          ← Alle Weine
        </Link>
      </p>
      <h1>{titel}</h1>
      {children}
    </div>
  );
}

/** Eigene Seite statt `notFound()`: Die eingebaute 404-Seite von Next ist englisch (D8). */
function KarteFehlt() {
  return (
    <Rahmen titel={TEXT_GIBT_ES_NICHT}>
      <p>
        Vielleicht hat sich die Adresse verändert. <Link href="/weine" prefetch={false}>Zur Liste aller Weine</Link>
      </p>
    </Rahmen>
  );
}

/** Erste Karte aus „Zu prüfen“ außer dieser; nur Karten mit eigener Prüfkarte. Wirft nie. */
async function naechsteKarte(store: WeinStore, kennung: string): Promise<Naechste> {
  try {
    const stapel = einordnen(await store.liste());
    const karte = stapel.zuPruefen.find((wein) => wein.kennung !== kennung && KENNUNG_MUSTER.test(wein.kennung));
    return karte ? { art: "karte", kennung: karte.kennung } : { art: "keine" };
  } catch {
    return { art: "unbekannt" };
  }
}

function fotosVon(wein: Wein): Fotos {
  return {
    vorne: wein.fotoVorne,
    vorneVorschau: wein.fotoVorneVorschau,
    hinten: wein.fotoHinten,
    hintenVorschau: wein.fotoHintenVorschau,
  };
}

export default async function Pruefkarte({ params }: { params: Promise<{ kennung: string }> }) {
  const store = weinStore();
  if (!store) {
    return (
      <Rahmen titel="Prüfkarte">
        <p>Die Datenbank ist noch nicht verbunden. Siehe docs/EINRICHTEN.md.</p>
      </Rahmen>
    );
  }

  const { kennung } = await params;
  if (!KENNUNG_MUSTER.test(kennung)) return <KarteFehlt />;

  // Die Liste für „Nächste Karte prüfen“ lädt gleichzeitig; scheitert sie, fehlt nur der Verweis.
  const naechste = naechsteKarte(store, kennung);

  let wein: Wein | null;
  try {
    wein = await store.holen(kennung, { herkunft: "nachsichtig" });
  } catch (fehler) {
    const eigen = fehler instanceof Error && fehler.name === "Error" && fehler.message.trim() !== "";
    return (
      <Rahmen titel="Prüfkarte">
        <p className="fehler" role="alert">
          {eigen ? fehler.message : TEXT_HOLEN}
        </p>
      </Rahmen>
    );
  }
  if (!wein) return <KarteFehlt />;

  const fotos = fotosVon(wein);
  const werte = wein.pruefwerte ?? {};

  if (!wein.herkunft) {
    // Nichts darf überschrieben werden: nur Fotos und die Meldung, Bearbeiten ist gesperrt.
    const { name, jahrgang } = kopfWerte(werte);
    return (
      <div className="pruefkarte">
        <p className="zurueck">
          <Link href="/weine" prefetch={false}>
            ← Alle Weine
          </Link>
        </p>
        <header className="kopf">
          <h1>
            {name ?? "Noch nicht gelesen"}
            {name && jahrgang ? <span className="jahr">{jahrgang}</span> : null}
          </h1>
        </header>
        <p className="band fehler" role="alert">
          {TEXT_HERKUNFT_UNLESBAR}
        </p>
        <NurFotos fotos={fotos} />
      </div>
    );
  }

  return (
    <PruefkarteInhalt
      key={wein.kennung}
      kennung={wein.kennung}
      anfang={{ stand: wein.stand, werte, herkunft: wein.herkunft }}
      fotos={fotos}
      naechste={await naechste}
      jahr={new Date().getUTCFullYear()}
    />
  );
}
