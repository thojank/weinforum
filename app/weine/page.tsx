import type { ReactNode } from "react";
import Link from "next/link";
import { kurzerGrund } from "@/lib/weinkartei/pruefen";
import { einordnen } from "@/lib/weinkartei/pruefkarte";
import { weinStore } from "@/lib/weinkartei/store";
import { KENNUNG_MUSTER, type Wein } from "@/lib/weinkartei/types";
import { NochmalLesen } from "./nochmal-lesen";
import { Zurueckholen } from "./zurueckholen";

export const dynamic = "force-dynamic";

/** Länge eines Grundes in der Liste; auf der Prüfkarte steht er ganz. */
const GRUND_LISTE_MAX = 70;

/** Anker der drei Stapel; zugleich die Klasse der Kachel, die die Farbe bestimmt. */
type Anker = "noch-zu-lesen" | "zu-pruefen" | "geprueft";

/**
 * Eine Kachel der Übersicht. Bei leerem Stapel gibt es kein Ziel zum Springen;
 * dann steht dieselbe Kachel ohne Link da und zeigt 0.
 */
function Kachel({ anker, zahl, text }: { anker: Anker; zahl: number; text: string }) {
  if (zahl === 0) {
    return (
      <span className={`${anker} leer`}>
        <b>0</b>
        {text}
      </span>
    );
  }
  return (
    <a className={anker} href={`#${anker}`}>
      <b>{zahl}</b>
      {text}
    </a>
  );
}

/**
 * Verweis auf die Prüfkarte. Nur Kennungen nach `KENNUNG_MUSTER` haben eine; andere Zeilen
 * (z. B. Beispielzeilen wie `bsp-0001`) stehen ohne Verweis da. Ohne Vorabladen: Jede
 * Prüfkarte fragt Baserow ab, und die Liste hat bis zu 200 Verweise.
 */
function Verweis({ wein, children }: { wein: Wein; children: ReactNode }) {
  if (!KENNUNG_MUSTER.test(wein.kennung)) {
    return <span className="verweis">{children}</span>;
  }
  return (
    <Link className="verweis" href={`/weine/${wein.kennung}`} prefetch={false}>
      {children}
    </Link>
  );
}

/**
 * Zeile in „Zu prüfen“, „Geprüft“ und „Ausgelistet“: Vorschau, Name, Jahrgang, Erzeuger;
 * darunter, falls da, Unsicheres mit gekürztem Grund. `aktion` steht neben dem Verweis.
 */
function Zeile({ wein, aktion }: { wein: Wein; aktion?: ReactNode }) {
  const unsicher = wein.herkunft?.unsicher ?? [];
  return (
    <li>
      <Verweis wein={wein}>
        {wein.fotoVorneVorschau ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wein.fotoVorneVorschau} alt="" width={48} height={48} />
        ) : (
          <span className="platzhalter" aria-hidden="true" />
        )}
        <span className="text">
          <strong>{wein.name}</strong> {wein.jahrgang ?? ""}
          {wein.erzeuger && (
            <>
              <br />
              <span className="hinweis">{wein.erzeuger}</span>
            </>
          )}
          {unsicher.length > 0 && (
            <span className="gruende">
              {unsicher.map((eintrag, i) => (
                <span key={`${eintrag.feld}-${i}`}>
                  <b>{eintrag.feld}</b> · {kurzerGrund(eintrag.grund, GRUND_LISTE_MAX)}
                </span>
              ))}
            </span>
          )}
        </span>
      </Verweis>
      {aktion}
    </li>
  );
}

/** Kästchen einer Karte, die noch keinen Namen hat; „Noch einmal lesen“ steht neben dem Verweis. */
function Offen({ wein }: { wein: Wein }) {
  const rueckenfoto = Boolean(wein.fotoHinten || wein.fotoHintenVorschau);
  return (
    <li>
      <Verweis wein={wein}>
        <span className="fotos">
          {wein.fotoVorneVorschau ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wein.fotoVorneVorschau} alt="Vorderetikett" width={40} height={64} />
          ) : (
            <span className="platzhalter" aria-hidden="true" />
          )}
          {wein.fotoHintenVorschau && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={wein.fotoHintenVorschau} alt="Rückenetikett" width={40} height={64} />
          )}
        </span>
        <span className="inhalt">
          <strong>{wein.name}</strong>
          <span className="hinweis">
            {wein.kennung} · {rueckenfoto ? "zwei Fotos" : "ein Foto"}
          </span>
        </span>
      </Verweis>
      <NochmalLesen kennung={wein.kennung} />
    </li>
  );
}

export default async function Weine() {
  const store = weinStore();
  if (!store) {
    return (
      <>
        <h1>Alle Weine</h1>
        <p>Die Datenbank ist noch nicht verbunden. Siehe docs/EINRICHTEN.md.</p>
        <Link href="/">← Start</Link>
      </>
    );
  }
  const weine = await store.liste();
  const stapel = einordnen(weine);
  return (
    <>
      <p>
        <Link href="/">← Start</Link>
      </p>
      <h1>Alle Weine</h1>
      <p className="hinweis">{weine.length} Einträge</p>

      <nav className="uebersicht" aria-label="Übersicht">
        <Kachel anker="noch-zu-lesen" zahl={stapel.nochZuLesen.length} text="Noch zu lesen" />
        <Kachel anker="zu-pruefen" zahl={stapel.zuPruefen.length} text="Zu prüfen" />
        <Kachel anker="geprueft" zahl={stapel.geprueft.length} text="Geprüft" />
      </nav>

      {stapel.nochZuLesen.length > 0 && (
        <section id="noch-zu-lesen" className="stapel-abschnitt">
          <h2>Noch zu lesen</h2>
          <ul className="stapel">
            {stapel.nochZuLesen.map((wein) => (
              <Offen key={wein.kennung} wein={wein} />
            ))}
          </ul>
        </section>
      )}

      {stapel.zuPruefen.length > 0 && (
        <section id="zu-pruefen" className="stapel-abschnitt">
          <h2>Zu prüfen</h2>
          <ul className="weinliste">
            {stapel.zuPruefen.map((wein) => (
              <Zeile key={wein.kennung} wein={wein} />
            ))}
          </ul>
        </section>
      )}

      {stapel.geprueft.length > 0 && (
        <section id="geprueft" className="stapel-abschnitt">
          <h2>Geprüft</h2>
          <ul className="weinliste">
            {stapel.geprueft.map((wein) => (
              <Zeile key={wein.kennung} wein={wein} />
            ))}
          </ul>
        </section>
      )}

      {stapel.ausgelistet.length > 0 && (
        <details className="ausgelistet stapel-abschnitt">
          <summary>Ausgelistet ({stapel.ausgelistet.length})</summary>
          <ul className="weinliste">
            {stapel.ausgelistet.map((wein) => (
              <Zeile key={wein.kennung} wein={wein} aktion={<Zurueckholen kennung={wein.kennung} />} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
