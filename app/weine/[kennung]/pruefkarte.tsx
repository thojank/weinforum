"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { karteAbrufen, type BearbeitenErgebnis } from "@/lib/weinkartei/karte-bearbeiten";
import { lesenAnstossen, TEXT_UNBEKANNTER_FEHLER } from "@/lib/weinkartei/lesen-anstossen";
import { hatWert } from "@/lib/weinkartei/pruefen";
import { eingabePruefen, MELDUNGEN, offenePflichtfelder } from "@/lib/weinkartei/pruefkarte";
import { schlangeErstellen, type Schlange } from "@/lib/weinkartei/schlange";
import {
  INHABER_FELDER,
  LESE_FELDER,
  PRUEF_FELDER,
  type BearbeitenAntwort,
  type KartenAnsicht,
  type PruefFeld,
} from "@/lib/weinkartei/types";
import { Feld, type FeldAktionen, type FeldMeldung, type GlobalSchritt, type Laeuft, type Offen, type Wiederholung } from "./feld";
import {
  alleInfos,
  eingabeForm,
  feldIds,
  kopfWerte,
  mehrzahl,
  stapelWort,
  ungueltigHinweis,
  type FeldInfo,
  type Fotos,
  type KartenStandAnsicht,
} from "./felder";
import { FotoReihe, useFotoDialog } from "./fotos";

/** Nächste Karte aus „Zu prüfen“; `unbekannt`, wenn die Liste sich nicht laden ließ. */
export type Naechste = { art: "karte"; kennung: string } | { art: "keine" } | { art: "unbekannt" };

type LeistenMeldung =
  | { art: "fehler"; text: string; wiederholung?: Wiederholung }
  /** Stand ist zurückgefallen (D6); wichtig, deshalb als Alarm. */
  | { art: "zurueck"; text: string }
  | { art: "erfolg"; titel: string; text: string };

type Lesen =
  | { art: "bereit" }
  | { art: "liest" }
  | { art: "fertig"; text: string }
  | { art: "fehler"; text: string };

/** Bitte, nach dem nächsten Rendern ein Element zu fokussieren; `n` macht jede Bitte neu. */
interface Fokus {
  id: string;
  scrollen: boolean;
  auswaehlen: boolean;
  n: number;
}

const TEXT_NICHT_GESPEICHERT = "Nicht gespeichert.";
const TEXT_KEINE_VERBINDUNG = "Nicht gespeichert. Keine Verbindung.";
const TEXT_LESEN_GESCHEITERT = "Lesen hat nicht geklappt.";
const TEXT_NEU_LADEN = "Gelesen, aber der neue Stand ließ sich nicht laden. Bitte die Seite neu laden.";

const ID_ALLES = "alles-knopf";
const ID_ABSCHLIESSEN = "abschliessen-knopf";
const ID_NAECHSTE = "naechste-karte";
const ID_ZURUECKHOLEN = "zurueckholen-knopf";

function ansicht(karte: KartenAnsicht): KartenStandAnsicht {
  return { stand: karte.stand, werte: karte.werte, herkunft: karte.herkunft };
}

function ohne<T>(alt: Partial<Record<PruefFeld, T>>, felder: PruefFeld[]): Partial<Record<PruefFeld, T>> {
  if (!felder.some((feld) => feld in alt)) return alt;
  const neu = { ...alt };
  for (const feld of felder) delete neu[feld];
  return neu;
}

function bestaetigteZahl(karte: KartenStandAnsicht): number {
  return PRUEF_FELDER.filter((feld) => hatWert(feld, karte.werte[feld]) && karte.herkunft.felder[feld]?.stand === "bestaetigt")
    .length;
}

function neuGelesenSatz(gelesen: number, bestaetigt: number): string {
  const teil = bestaetigt === 1 ? "1 bestätigte Angabe ist unverändert." : `${bestaetigt} bestätigte Angaben sind unverändert.`;
  return `Neu gelesen: ${mehrzahl(gelesen, "Angabe", "Angaben")}. ${teil}`;
}

/** „Die Karte gilt wieder als zu prüfen, weil {Feld} leer ist.“ (D6: sonst „nicht bestätigt ist“). */
function zurueckSatz(antwort: BearbeitenAntwort, feld: PruefFeld): string {
  const grund = hatWert(feld, antwort.werte[feld]) ? "nicht bestätigt ist" : "leer ist";
  return `Die Karte gilt wieder als zu prüfen, weil ${feld} ${grund}.`;
}

interface Props {
  kennung: string;
  anfang: KartenStandAnsicht;
  fotos: Fotos;
  naechste: Naechste;
  /** Laufendes Jahr (UTC), auf dem Server bestimmt. */
  jahr: number;
}

/**
 * Client-Teil der Prüfkarte. Alle Schritte gehen über eine Schlange je Karte (eine Anfrage zur
 * Zeit); der Zustand ändert sich nur durch Antworten der eigenen Routen, nie durch `router.refresh()`.
 */
export function PruefkarteInhalt({ kennung, anfang, fotos, naechste, jahr }: Props) {
  const [karte, setKarte] = useState<KartenStandAnsicht>(anfang);
  const [offen, setOffen] = useState<Offen | null>(null);
  const [laeuft, setLaeuft] = useState<Partial<Record<PruefFeld, Laeuft>>>({});
  const [global, setGlobal] = useState<Partial<Record<GlobalSchritt, number>>>({});
  const [feldMeldungen, setFeldMeldungen] = useState<Partial<Record<PruefFeld, FeldMeldung>>>({});
  const [meldung, setMeldung] = useState<LeistenMeldung | null>(null);
  const [lesen, setLesen] = useState<Lesen>({ art: "bereit" });
  const [fokus, setFokus] = useState<Fokus | null>(null);

  const schlange = useRef<Schlange | null>(null);
  const aktiv = useRef(true);
  const zaehler = useRef(0);
  const karteJetzt = useRef(karte);
  const offenJetzt = useRef(offen);
  const auslistenDialog = useRef<HTMLDialogElement>(null);
  const foto = useFotoDialog(fotos);

  useEffect(() => {
    karteJetzt.current = karte;
    offenJetzt.current = offen;
  });

  function holeSchlange(): Schlange {
    if (schlange.current === null) schlange.current = schlangeErstellen(kennung);
    return schlange.current;
  }

  // Verlassen (D4): bei `pagehide` und beim Abhängen gehen wartende Schritte sofort hinaus.
  useEffect(() => {
    aktiv.current = true;
    const verlassen = () => holeSchlange().allesSofortAbschicken();
    window.addEventListener("pagehide", verlassen);
    return () => {
      aktiv.current = false;
      window.removeEventListener("pagehide", verlassen);
      verlassen();
    };
    // Die Schlange lebt so lange wie die Komponente; `key={kennung}` sorgt für eine neue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fokus) return;
    const ziel = document.getElementById(fokus.id);
    if (!ziel) return;
    if (fokus.scrollen) {
      const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      (ziel.closest(".feld") ?? ziel).scrollIntoView({ block: "center", behavior: ruhig ? "auto" : "smooth" });
    }
    ziel.focus({ preventScroll: fokus.scrollen });
    if (fokus.auswaehlen && (ziel instanceof HTMLInputElement || ziel instanceof HTMLTextAreaElement)) ziel.select();
  }, [fokus]);

  function fokussieren(id: string, o?: { scrollen?: boolean; auswaehlen?: boolean }) {
    setFokus({ id, scrollen: o?.scrollen ?? false, auswaehlen: o?.auswaehlen ?? false, n: ++zaehler.current });
  }

  const infos = alleInfos(karte, jahr);
  const gesperrt = karte.stand === "ausgelistet";
  const liest = lesen.art === "liest";

  // ---------------------------------------------------------------------------------------------
  // Schritte

  /** Holt den Stand frisch (D7, ausgelistete Karte), in der Schlange, damit nichts dazwischenfährt. */
  function frischHolen() {
    holeSchlange()
      .exklusiv(async () => {
        const abruf = await karteAbrufen(kennung);
        if (abruf.art === "ok" && aktiv.current) setKarte(ansicht(abruf.karte));
      })
      .catch(() => undefined);
  }

  /** Springt zum Feld (AK 3). Ein leeres Feld öffnet sich gleich, wenn kein anderes offen ist. */
  function springen(feld: PruefFeld) {
    const ids = feldIds(feld);
    const offenes = offenJetzt.current;
    if (offenes?.feld === feld) {
      fokussieren(ids.eingabe, { scrollen: true });
      return;
    }
    if (offenes === null && !hatWert(feld, karteJetzt.current.werte[feld])) {
      setOffen({ feld, entwurf: "" });
      fokussieren(ids.eingabe, { scrollen: true });
      return;
    }
    fokussieren(ids.wert, { scrollen: true });
  }

  function nachAntwort(antwort: BearbeitenAntwort, w: Wiederholung) {
    setKarte(ansicht(antwort));
    if (antwort.nichtBestaetigt.length > 0) {
      setFeldMeldungen((alt) => {
        const neu = { ...alt };
        for (const { feld, meldung: text } of antwort.nichtBestaetigt) neu[feld] = { art: "hinweis", text };
        return neu;
      });
    }
    const aktion = w.aktion.aktion;
    if (antwort.zurueckgefallen) {
      setMeldung({ art: "zurueck", text: zurueckSatz(antwort, antwort.zurueckgefallen.feld) });
    } else if (aktion === "zurueckholen") {
      setMeldung({ art: "erfolg", titel: "Zurückgeholt", text: "Die Karte steht wieder in ihrem Stapel." });
    } else {
      setMeldung((alt) => (alt?.art === "erfolg" && aktion !== "auslisten" ? alt : null));
    }

    if (aktion === "auslisten") {
      setOffen(null);
      const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: ruhig ? "auto" : "smooth" });
      fokussieren(ID_ZURUECKHOLEN);
    } else if (aktion === "abschliessen" && antwort.stand === "geprueft") {
      fokussieren(ID_NAECHSTE);
    } else if (aktion === "bestaetigen" && w.global === "alles" && document.activeElement?.id === ID_ALLES) {
      fokussieren(ID_ABSCHLIESSEN);
    }
  }

  function nachFehler(ergebnis: Extract<BearbeitenErgebnis, { art: "fehler" }>, w: Wiederholung) {
    const { aktion } = w;
    // Der Server kennt einen anderen Stand der Karte: frisch holen statt raten (D7).
    if (
      (aktion.aktion === "abschliessen" && ergebnis.fehlend && karteJetzt.current.stand === "geprueft") ||
      ergebnis.text === MELDUNGEN.ausgelistet
    ) {
      frischHolen();
    }

    // 400 vom Server bei einer Eingabe: wie die Prüfung im Browser, die Eingabe bleibt stehen.
    if (aktion.aktion === "aendern" && ergebnis.feld && !ergebnis.netz) {
      const offenes = offenJetzt.current;
      if (offenes === null || offenes.feld === aktion.feld) {
        setOffen({ feld: aktion.feld, entwurf: aktion.wert, meldung: ergebnis.text });
        fokussieren(feldIds(aktion.feld).eingabe);
      } else {
        setFeldMeldungen((alt) => ({
          ...alt,
          [aktion.feld]: { art: "fehler", text: `${TEXT_NICHT_GESPEICHERT} ${ergebnis.text}`, entwurf: aktion.wert },
        }));
      }
      return;
    }

    if (aktion.aktion === "abschliessen" && ergebnis.fehlend && ergebnis.fehlend.length > 0) {
      setMeldung({ art: "fehler", text: ergebnis.text });
      springen(ergebnis.fehlend[0]);
      return;
    }

    const text = ergebnis.netz ? TEXT_KEINE_VERBINDUNG : `${TEXT_NICHT_GESPEICHERT} ${ergebnis.text}`;
    const wiederholung = ergebnis.netz ? w : undefined;
    if (!w.global && w.felder.length === 1) {
      const entwurf = aktion.aktion === "aendern" ? aktion.wert : undefined;
      setFeldMeldungen((alt) => ({ ...alt, [w.felder[0]]: { art: "fehler", text, wiederholung, entwurf } }));
      return;
    }
    setMeldung({ art: "fehler", text, wiederholung });
  }

  /** Reiht einen Schritt in die Schlange ein und zeigt, solange er wartet oder läuft, den Zustand. */
  async function schicken(w: Wiederholung) {
    const { felder, global: g } = w;
    const id = ++zaehler.current;
    setLaeuft((alt) => {
      const neu = { ...alt };
      for (const feld of felder) neu[feld] = { id, unterwegs: false };
      return neu;
    });
    if (g) {
      setGlobal((alt) => ({ ...alt, [g]: id }));
      setMeldung((alt) => (alt?.art === "fehler" ? null : alt));
    }
    setFeldMeldungen((alt) => ohne(alt, felder));

    const ergebnis = await holeSchlange().einreihen(w.aktion, {
      beimStart: () => {
        if (!aktiv.current) return;
        setLaeuft((alt) => {
          const neu = { ...alt };
          for (const feld of felder) if (neu[feld]?.id === id) neu[feld] = { id, unterwegs: true };
          return neu;
        });
      },
    });
    if (!aktiv.current) return;

    setLaeuft((alt) => ohne(alt, felder.filter((feld) => alt[feld]?.id === id)));
    if (g) {
      setGlobal((alt) => {
        if (alt[g] !== id) return alt;
        const neu = { ...alt };
        delete neu[g];
        return neu;
      });
    }
    if (ergebnis.art === "ok") nachAntwort(ergebnis.antwort, w);
    else nachFehler(ergebnis, w);
  }

  function stimmtSo(feld: PruefFeld) {
    const wert = karte.werte[feld];
    if (wert === undefined || laeuft[feld]) return;
    // Gesehener Wert: genau der Rohtext aus dem letzten Stand, nie die Anzeigeform.
    void schicken({ aktion: { aktion: "bestaetigen", felder: [{ feld, wert }] }, felder: [feld] });
    fokussieren(feldIds(feld).wert);
  }

  function bleibtLeer(feld: PruefFeld) {
    if (laeuft[feld]) return;
    void schicken({ aktion: { aktion: "leeren", feld }, felder: [feld] });
    fokussieren(feldIds(feld).wert);
  }

  function oeffnen(feld: PruefFeld) {
    if (gesperrt || laeuft[feld]) return;
    const vorher = feldMeldungen[feld];
    const entwurf = vorher?.art === "fehler" && vorher.entwurf !== undefined ? vorher.entwurf : eingabeForm(infos[feld]);
    setOffen({ feld, entwurf });
    fokussieren(feldIds(feld).eingabe, { auswaehlen: true });
  }

  function abbrechen() {
    if (!offen) return;
    const feld = offen.feld;
    setOffen(null);
    fokussieren(feldIds(feld).wert);
  }

  function uebernehmen(wert?: string) {
    if (!offen) return;
    const { feld } = offen;
    const roh = wert ?? offen.entwurf;
    const ergebnis = eingabePruefen(feld, roh, { jahr });
    if (ergebnis.art === "ungueltig") {
      // Keine Anfrage; Meldung am Feld, Eingabe bleibt, Fokus zurück ins Feld.
      setOffen({ feld, entwurf: roh, meldung: ergebnis.meldung });
      fokussieren(feldIds(feld).eingabe);
      return;
    }
    setOffen(null);
    // Unverändert gilt als „Stimmt so“, leer als Leeren; das entscheidet der Server.
    void schicken({ aktion: { aktion: "aendern", feld, wert: roh }, felder: [feld] });
    fokussieren(feldIds(feld).wert);
  }

  function leeren() {
    if (!offen) return;
    const { feld } = offen;
    setOffen(null);
    void schicken({ aktion: { aktion: "leeren", feld }, felder: [feld] });
    fokussieren(feldIds(feld).wert);
  }

  const bestaetigbar = PRUEF_FELDER.filter((feld) => infos[feld].bestaetigbar && !laeuft[feld]);

  function allesStimmt() {
    if (global.alles !== undefined || bestaetigbar.length === 0) return;
    const felder = bestaetigbar.map((feld) => ({ feld, wert: karte.werte[feld] ?? "" }));
    void schicken({ aktion: { aktion: "bestaetigen", felder }, felder: bestaetigbar, global: "alles" });
  }

  function abschliessen() {
    if (global.abschliessen !== undefined) return;
    // Immer an den Server, ohne Vorentscheidung im Browser.
    void schicken({ aktion: { aktion: "abschliessen" }, felder: [], global: "abschliessen" });
  }

  function auslistenFragen() {
    const dialog = auslistenDialog.current;
    if (!dialog || global.auslisten !== undefined) return;
    dialog.showModal();
    document.getElementById("auslisten-abbrechen")?.focus();
  }

  function auslisten() {
    auslistenDialog.current?.close();
    void schicken({ aktion: { aktion: "auslisten" }, felder: [], global: "auslisten" });
  }

  function zurueckholen() {
    if (global.zurueckholen !== undefined) return;
    void schicken({ aktion: { aktion: "zurueckholen" }, felder: [], global: "zurueckholen" });
  }

  /** „Noch einmal lesen“: hält die Schlange an, bis der frische Stand übernommen ist (Regel 2). */
  async function nochmalLesen() {
    if (liest) return;
    setLesen({ art: "liest" });
    try {
      await holeSchlange().exklusiv(async () => {
        const ergebnis = await lesenAnstossen(kennung);
        if (!aktiv.current) return;
        if (ergebnis.art === "fehler") {
          setLesen({ art: "fehler", text: `${TEXT_LESEN_GESCHEITERT} ${ergebnis.text}` });
          return;
        }
        const abruf = await karteAbrufen(kennung);
        if (!aktiv.current) return;
        if (abruf.art === "fehler") {
          setLesen({ art: "fehler", text: `${TEXT_NEU_LADEN} ${abruf.text}` });
          return;
        }
        // Innerhalb der Arbeit übernehmen: Danach gehen die wartenden Schritte hinaus.
        const frisch = ansicht(abruf.karte);
        setKarte(frisch);
        setLesen({ art: "fertig", text: neuGelesenSatz(ergebnis.antwort.gelesen.length, bestaetigteZahl(frisch)) });
      });
    } catch {
      if (aktiv.current) setLesen({ art: "fehler", text: `${TEXT_LESEN_GESCHEITERT} ${TEXT_UNBEKANNTER_FEHLER}` });
    }
  }

  const aktionen: FeldAktionen = {
    oeffnen,
    stimmtSo,
    bleibtLeer,
    wiederholen: (w) => void schicken(w),
    entwurfAendern: (wert) => setOffen((alt) => (alt ? { ...alt, entwurf: wert } : alt)),
    uebernehmen,
    abbrechen,
    leeren,
    fotoOeffnen: foto.oeffnen,
    fotoOffen: foto.istOffen,
  };

  // ---------------------------------------------------------------------------------------------
  // Darstellung

  const alle: FeldInfo[] = PRUEF_FELDER.map((feld) => infos[feld]);
  const gefuellt = alle.filter((info) => info.gefuellt).length;
  const bestaetigt = alle.filter((info) => info.bestaetigt).length;
  const unsicher = alle.filter((info) => info.unsicher.length > 0 && !info.bestaetigt).length;
  const ueberblick =
    `${stapelWort(kennung, karte)} · ${bestaetigt} von ${gefuellt} Angaben bestätigt` +
    (unsicher > 0 ? ` · ${unsicher} unsicher` : "");
  const { name, jahrgang } = kopfWerte(karte.werte);

  const pflichtOffen = offenePflichtfelder({ pruefwerte: karte.werte, herkunft: karte.herkunft });
  const allePflichtErfuellt = pflichtOffen.fehlend.length === 0 && pflichtOffen.unbestaetigt.length === 0;
  const fertigGeprueft = karte.stand === "geprueft" && allePflichtErfuellt;
  const nichtDabei = alle.filter((info) => info.ungueltig && !info.bestaetigt);
  const unsicherDabei = bestaetigbar.filter((feld) => infos[feld].unsicher.length > 0);
  const allesLaeuft = global.alles !== undefined;
  const zeigeAlles = allesLaeuft || bestaetigbar.length > 0;

  const feld = (f: PruefFeld) => (
    <Feld
      key={f}
      info={infos[f]}
      gesperrt={gesperrt}
      laeuft={laeuft[f]}
      liest={liest}
      meldung={feldMeldungen[f]}
      offen={offen}
      fotos={fotos}
      aktionen={aktionen}
    />
  );

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
        <p className="hinweis">{ueberblick}</p>
      </header>

      {gesperrt ? (
        <div className="band" role="status">
          <strong>Ausgelistet</strong>
          Diese Karte steht in keinem Stapel mehr. Du kannst sie nur ansehen oder zurückholen.
        </div>
      ) : null}

      <FotoReihe fotos={fotos} onOeffnen={foto.oeffnen} />

      <section className="gruppe" aria-labelledby="gruppe-etikett">
        <h2 id="gruppe-etikett">Vom Etikett</h2>
        <ul className="felder">{LESE_FELDER.map(feld)}</ul>
      </section>

      <section className="gruppe" aria-labelledby="gruppe-inhaber">
        <h2 id="gruppe-inhaber">Von Torsten</h2>
        <p className="hinweis zusatz">Preis und Kurztext brauchst du erst für das Monatsplakat.</p>
        <ul className="felder">{INHABER_FELDER.map(feld)}</ul>
      </section>

      {gesperrt ? null : (
        <section className="neben" aria-label="Weitere Schritte">
          {lesen.art === "fertig" ? (
            <p className="lesemeldung" role="status">
              {lesen.text}
            </p>
          ) : null}
          {lesen.art === "fehler" ? (
            <p className="lesemeldung fehler" role="alert">
              {lesen.text}
            </p>
          ) : null}
          <button
            type="button"
            className="knopf"
            aria-disabled={liest || undefined}
            onClick={() => void nochmalLesen()}
          >
            {liest ? "Liest …" : "Noch einmal lesen"}
          </button>
          <button
            type="button"
            className="knopf leise"
            aria-disabled={global.auslisten !== undefined || undefined}
            onClick={auslistenFragen}
          >
            {global.auslisten !== undefined ? "Listet aus …" : "Auslisten"}
          </button>
        </section>
      )}

      <div className="leiste">
        {meldung ? <Leistenmeldung meldung={meldung} wiederholen={(w) => void schicken(w)} /> : null}
        {gesperrt ? (
          <button
            type="button"
            id={ID_ZURUECKHOLEN}
            className="gross"
            aria-disabled={global.zurueckholen !== undefined || undefined}
            onClick={zurueckholen}
          >
            {global.zurueckholen !== undefined ? "Holt zurück …" : "Zurückholen"}
          </button>
        ) : (
          <>
            {karte.stand === "geprueft" ? (
              fertigGeprueft ? (
                <p className="meldung erfolg" role="status">
                  <strong>✓ Geprüft</strong>
                  <span>Alle Pflichtangaben sind bestätigt. Die Karte bleibt bearbeitbar.</span>
                </p>
              ) : (
                <p className="meldung hinweis">
                  Die Karte gilt als geprüft, aber nicht alle Pflichtangaben sind bestätigt. Mit dem nächsten Schritt
                  fällt sie auf „Zu prüfen“ zurück.
                </p>
              )
            ) : null}
            {zeigeAlles && nichtDabei.length > 0 ? (
              <p className="hinweis">
                Nicht dabei: {nichtDabei.map((info) => `${info.feld} – ${ungueltigHinweis(info)}`).join("; ")}
              </p>
            ) : null}
            {zeigeAlles && unsicherDabei.length > 0 ? (
              <p className="hinweis">Dabei unsicher: {unsicherDabei.join(", ")}. Bitte vorher ansehen.</p>
            ) : null}
            {zeigeAlles ? (
              <button
                type="button"
                id={ID_ALLES}
                className="gross"
                aria-disabled={allesLaeuft || undefined}
                onClick={allesStimmt}
              >
                {allesLaeuft
                  ? "Speichert …"
                  : `Alles stimmt so · ${mehrzahl(bestaetigbar.length, "Angabe", "Angaben")}`}
              </button>
            ) : null}
            {fertigGeprueft ? (
              <Weiter naechste={naechste} klasse={zeigeAlles ? "zweit" : "gross"} />
            ) : (
              <button
                type="button"
                id={ID_ABSCHLIESSEN}
                className={zeigeAlles ? "zweit" : "gross"}
                aria-disabled={global.abschliessen !== undefined || undefined}
                onClick={abschliessen}
              >
                {global.abschliessen !== undefined ? "Speichert …" : "Karte ist geprüft"}
              </button>
            )}
          </>
        )}
      </div>

      {foto.dialog}

      <dialog
        ref={auslistenDialog}
        className="rueckfrage"
        aria-labelledby="auslisten-titel"
        aria-describedby="auslisten-text"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="rueckfrage-inhalt">
          <h2 id="auslisten-titel">Diese Karte auslisten?</h2>
          <p id="auslisten-text">Sie verschwindet aus den Stapeln. Du kannst sie später zurückholen.</p>
          <div className="knoepfe">
            <button type="button" className="knopf haupt" onClick={auslisten}>
              Auslisten
            </button>
            <button
              type="button"
              id="auslisten-abbrechen"
              className="knopf leise"
              onClick={() => auslistenDialog.current?.close()}
            >
              Abbrechen
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function Leistenmeldung({ meldung, wiederholen }: { meldung: LeistenMeldung; wiederholen: (w: Wiederholung) => void }) {
  if (meldung.art === "erfolg") {
    return (
      <p className="meldung erfolg" role="status">
        <strong>{meldung.titel}</strong>
        <span>{meldung.text}</span>
      </p>
    );
  }
  if (meldung.art === "zurueck") {
    return (
      <p className="meldung fehler" role="alert">
        {meldung.text}
      </p>
    );
  }
  const { wiederholung } = meldung;
  return (
    <div className="meldung fehler" role="alert">
      <p>{meldung.text}</p>
      {wiederholung ? (
        <button type="button" className="knopf" onClick={() => wiederholen(wiederholung)}>
          Noch einmal versuchen
        </button>
      ) : null}
    </div>
  );
}

/** Nach dem Abschließen: zur nächsten Karte aus „Zu prüfen“, oder „Alles geprüft.“ */
function Weiter({ naechste, klasse }: { naechste: Naechste; klasse: "gross" | "zweit" }) {
  if (naechste.art === "karte") {
    return (
      <Link id={ID_NAECHSTE} className={klasse} href={`/weine/${naechste.kennung}`} prefetch={false}>
        Nächste Karte prüfen →
      </Link>
    );
  }
  return (
    <>
      {naechste.art === "keine" ? <p className="meldung erfolg">Alles geprüft.</p> : null}
      <Link id={ID_NAECHSTE} className={klasse} href="/weine" prefetch={false}>
        Alle Weine
      </Link>
    </>
  );
}
