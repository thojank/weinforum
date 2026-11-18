"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { zeichenzahl } from "@/lib/weinkartei/pruefen";
import {
  ARTEN,
  KURZTEXT_MAX,
  anzeigeForm,
  eingabeart,
  feldIds,
  herkunftWort,
  standWort,
  ungueltigHinweis,
  type FeldInfo,
  type Fotos,
  type Seite,
} from "./felder";
import { FotoZugriff } from "./fotos";
import type { Aktion, PruefFeld } from "@/lib/weinkartei/types";

/** Ein Schritt, der sich wiederholen lässt („Noch einmal versuchen“). */
export interface Wiederholung {
  aktion: Aktion;
  felder: PruefFeld[];
  global?: GlobalSchritt;
}

export type GlobalSchritt = "alles" | "abschliessen" | "auslisten" | "zurueckholen";

/** Rückmeldung an einem Feld. Was nicht gespeichert ist, sieht nie bestätigt aus. */
export type FeldMeldung =
  | { art: "hinweis"; text: string }
  /** `entwurf`: nicht gespeicherte Eingabe; sie steht beim nächsten Öffnen wieder im Feld. */
  | { art: "fehler"; text: string; wiederholung?: Wiederholung; entwurf?: string };

/** Ein Schritt dieses Feldes wartet in der Schlange (`unterwegs: false`) oder läuft. */
export interface Laeuft {
  id: number;
  unterwegs: boolean;
}

/** Das Feld im Bearbeiten; immer nur eines zur Zeit. */
export interface Offen {
  feld: PruefFeld;
  entwurf: string;
  /** Meldung der Prüfung (Browser oder 400 vom Server); macht die Eingabe `aria-invalid`. */
  meldung?: string;
}

export interface FeldAktionen {
  oeffnen: (feld: PruefFeld) => void;
  stimmtSo: (feld: PruefFeld) => void;
  bleibtLeer: (feld: PruefFeld) => void;
  wiederholen: (w: Wiederholung) => void;
  entwurfAendern: (wert: string) => void;
  uebernehmen: (wert?: string) => void;
  abbrechen: () => void;
  leeren: () => void;
  fotoOeffnen: (seite: Seite, von: HTMLElement) => void;
  fotoOffen: () => boolean;
}

interface Props {
  info: FeldInfo;
  /** Ausgelistet: nur ansehen. */
  gesperrt: boolean;
  laeuft?: Laeuft;
  liest: boolean;
  meldung?: FeldMeldung;
  offen: Offen | null;
  fotos: Fotos;
  aktionen: FeldAktionen;
}

function Pflicht({ pflicht }: { pflicht: boolean }) {
  return pflicht ? <span className="pflicht">Pflicht</span> : null;
}

function Gruende({ gruende }: { gruende: string[] }) {
  return (
    <>
      {gruende.map((grund, i) => (
        <p className="grund" key={i}>
          <b>unsicher:</b> {grund}
        </p>
      ))}
    </>
  );
}

function Rueckmeldung({
  meldung,
  id,
  wiederholen,
  wartet,
}: {
  meldung?: FeldMeldung;
  id: string;
  wiederholen: (w: Wiederholung) => void;
  wartet: boolean;
}) {
  if (!meldung) return null;
  if (meldung.art === "hinweis") {
    return (
      <p className="rueckmeldung hinweis-satz" id={id} role="status">
        {meldung.text}
      </p>
    );
  }
  const { wiederholung } = meldung;
  return (
    <div className="rueckmeldung fehler-satz" id={id} role="alert">
      <p>{meldung.text}</p>
      {meldung.entwurf !== undefined && meldung.entwurf !== "" ? (
        <p className="entwurf">Deine Eingabe: „{meldung.entwurf}“</p>
      ) : null}
      {wiederholung ? (
        <button
          type="button"
          className="knopf"
          aria-disabled={wartet || undefined}
          onClick={() => {
            if (!wartet) wiederholen(wiederholung);
          }}
        >
          Noch einmal versuchen
        </button>
      ) : null}
    </div>
  );
}

/** Eine Feldzeile: Name, Wert, Herkunft und Stand; rechts „Stimmt so“ oder der Stand. */
export function Feld(props: Props) {
  const { info, offen } = props;
  if (offen && offen.feld === info.feld && !props.gesperrt) return <Bearbeiten {...props} offen={offen} />;
  return <Zeile {...props} />;
}

function Zeile({ info, gesperrt, laeuft, liest, meldung, aktionen }: Props) {
  const ids = feldIds(info.feld);
  const { feld, gefuellt, bestaetigt } = info;
  const unsicher = info.unsicher.length > 0 && !bestaetigt;
  const klassen = [
    "feld",
    !gefuellt ? "leer" : bestaetigt ? "bestaetigt" : "gelesen",
    unsicher ? "unsicher" : "",
    info.ungueltig ? "ungueltig" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const anzeige = gefuellt ? anzeigeForm(info) : "";

  let rechts = null;
  if (laeuft) {
    rechts = (
      <span className="speichert" role="status">
        {!laeuft.unterwegs && liest ? "wartet auf das Lesen …" : "Speichert …"}
      </span>
    );
  } else if (bestaetigt) {
    rechts = <span className="stand-ok">✓ bestätigt</span>;
  } else if (gesperrt) {
    rechts = null;
  } else if (info.bestaetigbar) {
    rechts = (
      <button type="button" className="stimmt" aria-label={`${feld}: stimmt so`} onClick={() => aktionen.stimmtSo(feld)}>
        Stimmt so
      </button>
    );
  } else if (!gefuellt && info.unsicher.length > 0) {
    rechts = (
      <button type="button" className="stimmt" aria-label={`${feld}: bleibt leer`} onClick={() => aktionen.bleibtLeer(feld)}>
        Bleibt leer
      </button>
    );
  }

  const beschriftung = gefuellt ? `${feld} ändern, jetzt: ${anzeige}` : `${feld} eintragen, jetzt leer`;

  return (
    <li className={klassen} id={ids.zeile}>
      <div className="inhalt">
        <div className="name">
          <span>{feld}</span>
          <Pflicht pflicht={info.pflicht} />
        </div>
        {gesperrt ? (
          <p className={`wert${gefuellt ? "" : " fehlt"}`} id={ids.wert}>
            {gefuellt ? anzeige : "leer"}
          </p>
        ) : (
          <button
            type="button"
            className={`wert${gefuellt ? "" : " fehlt"}`}
            id={ids.wert}
            aria-label={beschriftung}
            aria-disabled={laeuft ? true : undefined}
            onClick={() => {
              if (!laeuft) aktionen.oeffnen(feld);
            }}
          >
            <span>{gefuellt ? anzeige : "leer"}</span>
            {laeuft ? null : (
              <span className="stift" aria-hidden="true">
                {gefuellt ? "Ändern" : "Eintragen"}
              </span>
            )}
          </button>
        )}
        {gefuellt ? (
          <p className="marke">
            {herkunftWort(info.eintrag)} · {standWort(info.eintrag)}
          </p>
        ) : null}
      </div>
      <div className="rechts">{rechts}</div>
      {info.ungueltig ? <p className="ungueltig-hinweis">{ungueltigHinweis(info)}</p> : null}
      {unsicher ? <Gruende gruende={info.unsicher} /> : null}
      <Rueckmeldung meldung={meldung} id={ids.meldung} wiederholen={aktionen.wiederholen} wartet={Boolean(laeuft)} />
    </li>
  );
}

function Bearbeiten({ info, meldung, fotos, aktionen, offen }: Props & { offen: Offen }) {
  const ids = feldIds(info.feld);
  const art = eingabeart(info.feld);
  const beschrieben =
    [offen.meldung ? ids.fehler : "", art.einheit ? ids.einheit : "", art.art === "lang" ? ids.zaehler : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  const ungueltig = offen.meldung ? true : undefined;
  const zeichen = zeichenzahl(offen.entwurf);

  function absenden(e: FormEvent) {
    e.preventDefault();
    aktionen.uebernehmen();
  }

  function taste(e: KeyboardEvent) {
    // Escape bricht ab, aber nicht, solange ein Dialog offen ist; der schließt sich selbst.
    if (e.key === "Escape" && !aktionen.fotoOffen()) {
      e.preventDefault();
      aktionen.abbrechen();
    }
  }

  let eingabe;
  if (art.art === "art") {
    eingabe = (
      <div className="tipps" role="group" aria-labelledby={ids.name}>
        {ARTEN.map((wert, i) => (
          <button
            key={wert}
            type="button"
            id={i === 0 ? ids.eingabe : undefined}
            className={`tipp${info.wert === wert ? " gewaehlt" : ""}`}
            aria-pressed={info.wert === wert}
            onClick={() => aktionen.uebernehmen(wert)}
          >
            {wert}
          </button>
        ))}
      </div>
    );
  } else if (art.art === "lang") {
    eingabe = (
      <>
        <div className="eingabe">
          <textarea
            id={ids.eingabe}
            rows={4}
            value={offen.entwurf}
            onChange={(e) => aktionen.entwurfAendern(e.target.value)}
            aria-invalid={ungueltig}
            aria-describedby={beschrieben}
          />
        </div>
        <p className={`zaehler${zeichen > KURZTEXT_MAX ? " zuviel" : ""}`} id={ids.zaehler}>
          {zeichen} / {KURZTEXT_MAX}
        </p>
      </>
    );
  } else {
    eingabe = (
      <>
        <div className="eingabe">
          <input
            id={ids.eingabe}
            type="text"
            autoComplete="off"
            inputMode={art.modus ?? "text"}
            enterKeyHint="done"
            value={offen.entwurf}
            onChange={(e) => aktionen.entwurfAendern(e.target.value)}
            aria-invalid={ungueltig}
            aria-describedby={beschrieben}
          />
          {art.einheit ? (
            <span className="einheit" id={ids.einheit}>
              {art.einheit}
            </span>
          ) : null}
        </div>
        {art.tipp ? (
          <div className="tipps">
            <button type="button" className="tipp" onClick={() => aktionen.uebernehmen(art.tipp)}>
              {art.tipp}
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <li className="feld bearbeiten" id={ids.zeile}>
      <form noValidate onSubmit={absenden} onKeyDown={taste}>
        {art.art === "art" ? (
          <div className="beschriftung">
            <span id={ids.name}>{info.feld}</span>
            <Pflicht pflicht={info.pflicht} />
            <span className="format">Ein Tipp übernimmt die Art.</span>
          </div>
        ) : (
          <div className="beschriftung">
            <label htmlFor={ids.eingabe}>{info.feld}</label>
            <Pflicht pflicht={info.pflicht} />
            {art.format ? <span className="format">{art.format}</span> : null}
          </div>
        )}
        {eingabe}
        {offen.meldung ? (
          <p className="feldfehler" id={ids.fehler} role="alert">
            {offen.meldung}
          </p>
        ) : null}
        {info.ungueltig ? <p className="ungueltig-hinweis">{ungueltigHinweis(info)}</p> : null}
        {!info.bestaetigt ? <Gruende gruende={info.unsicher} /> : null}
        {meldung?.art === "hinweis" ? (
          <p className="rueckmeldung hinweis-satz" role="status">
            {meldung.text}
          </p>
        ) : null}
        <div className="knoepfe">
          {art.art === "art" ? null : (
            <button type="submit" className="knopf haupt">
              Übernehmen
            </button>
          )}
          <button type="button" className="knopf leise" onClick={aktionen.abbrechen}>
            Abbrechen
          </button>
          {info.gefuellt ? (
            <button type="button" className="knopf leise" onClick={aktionen.leeren}>
              Leeren
            </button>
          ) : null}
        </div>
        <FotoZugriff fotos={fotos} onOeffnen={aktionen.fotoOeffnen} />
      </form>
    </li>
  );
}
