import Link from "next/link";
import { weinStore } from "@/lib/weinkartei/store";
import { NAME_UNGELESEN, type Wein } from "@/lib/weinkartei/types";
import { NochmalLesen } from "./nochmal-lesen";

export const dynamic = "force-dynamic";

interface Stapel {
  offen: Wein[];
  unsicher: Wein[];
  gelesen: Wein[];
}

/** Ordnet jede Karte genau einem Stapel zu; die Reihenfolge von `liste()` bleibt erhalten. */
function einordnen(weine: Wein[]): Stapel {
  const stapel: Stapel = { offen: [], unsicher: [], gelesen: [] };
  for (const wein of weine) {
    if (wein.name === NAME_UNGELESEN) stapel.offen.push(wein);
    else if ((wein.herkunft?.unsicher.length ?? 0) > 0) stapel.unsicher.push(wein);
    else stapel.gelesen.push(wein);
  }
  return stapel;
}

/**
 * Eine Kachel der Übersicht. Bei leerem Stapel gibt es kein Ziel zum Springen;
 * dann steht dieselbe Kachel ohne Link da und zeigt 0.
 */
function Kachel({ anker, zahl, text }: { anker: keyof Stapel; zahl: number; text: string }) {
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

/** Zeile wie bisher: Vorschau, Name, Jahrgang, Erzeuger und Stand; darunter, falls da, Unsicheres. */
function Zeile({ wein }: { wein: Wein }) {
  const unsicher = wein.herkunft?.unsicher ?? [];
  return (
    <li>
      {wein.fotoVorneVorschau ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wein.fotoVorneVorschau} alt="" width={48} height={48} />
      ) : (
        <span className="platzhalter" aria-hidden="true" />
      )}
      <span className="text">
        <strong>{wein.name}</strong> {wein.jahrgang ?? ""}
        <br />
        <span className="hinweis">
          {wein.erzeuger ? `${wein.erzeuger} · ` : ""}
          {wein.stand}
        </span>
        {unsicher.length > 0 && (
          <span className="gruende">
            {unsicher.map((eintrag, i) => (
              <span key={`${eintrag.feld}-${i}`}>
                <b>{eintrag.feld}</b> · {eintrag.grund}
              </span>
            ))}
          </span>
        )}
      </span>
    </li>
  );
}

/** Kästchen einer Karte, die noch keinen Namen hat. */
function Offen({ wein }: { wein: Wein }) {
  const rueckenfoto = Boolean(wein.fotoHinten || wein.fotoHintenVorschau);
  return (
    <li>
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
          {wein.kennung} · {rueckenfoto ? "zwei Fotos" : "ein Foto"} · {wein.stand}
        </span>
      </span>
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
        <Kachel anker="offen" zahl={stapel.offen.length} text="noch zu lesen" />
        <Kachel anker="unsicher" zahl={stapel.unsicher.length} text="mit Unsicherem" />
        <Kachel anker="gelesen" zahl={stapel.gelesen.length} text="gelesen" />
      </nav>

      {stapel.offen.length > 0 && (
        <section id="offen" className="stapel-abschnitt">
          <h2>Noch zu lesen</h2>
          <ul className="stapel">
            {stapel.offen.map((wein) => (
              <Offen key={wein.kennung} wein={wein} />
            ))}
          </ul>
        </section>
      )}

      {stapel.unsicher.length > 0 && (
        <section id="unsicher" className="stapel-abschnitt">
          <h2>Mit Unsicherem</h2>
          <ul className="weinliste">
            {stapel.unsicher.map((wein) => (
              <Zeile key={wein.kennung} wein={wein} />
            ))}
          </ul>
        </section>
      )}

      {stapel.gelesen.length > 0 && (
        <section id="gelesen" className="stapel-abschnitt">
          <h2>Gelesen</h2>
          <ul className="weinliste">
            {stapel.gelesen.map((wein) => (
              <Zeile key={wein.kennung} wein={wein} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
