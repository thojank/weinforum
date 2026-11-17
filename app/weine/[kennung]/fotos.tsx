"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FOTO_ALT, SEITEN, type Fotos, type Seite } from "./felder";

/** Feste Maße der Fotos (Hochformat 3:4); die Größe auf dem Bildschirm regelt das Stylesheet. */
const KACHEL = { breite: 300, hoehe: 400 };
const GROSS = { breite: 1200, hoehe: 1600 };
const MINI = { breite: 30, hoehe: 40 };

function adresse(fotos: Fotos, seite: Seite): string | undefined {
  return seite === "vorne" ? fotos.vorne : fotos.hinten;
}

function vorschauAdresse(fotos: Fotos, seite: Seite): string | undefined {
  return seite === "vorne" ? (fotos.vorneVorschau ?? fotos.vorne) : (fotos.hintenVorschau ?? fotos.hinten);
}

/**
 * Ein Foto, das beim Laden scheitern darf. Scheitert es schon vor der Hydration, fängt der
 * Blick auf `naturalWidth` nach dem Einhängen das auf; sonst `onError`.
 */
function Bild({
  src,
  alt,
  masse,
  ersatz,
  onKaputt,
}: {
  src: string;
  alt: string;
  masse: { breite: number; hoehe: number };
  ersatz?: ReactNode;
  onKaputt?: () => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [kaputt, setKaputt] = useState(false);
  const melden = useRef(onKaputt);
  useEffect(() => {
    melden.current = onKaputt;
  });
  useEffect(() => {
    const bild = ref.current;
    if (bild && bild.complete && bild.naturalWidth === 0) {
      setKaputt(true);
      melden.current?.();
    }
  }, [src]);
  if (kaputt) return <>{ersatz ?? null}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={masse.breite}
      height={masse.hoehe}
      onError={() => {
        setKaputt(true);
        melden.current?.();
      }}
    />
  );
}

/** Die beiden Fotos oben; ein Tipp öffnet das Foto in voller Größe. */
export function FotoReihe({ fotos, onOeffnen }: { fotos: Fotos; onOeffnen: (seite: Seite, von: HTMLElement) => void }) {
  return (
    <section className="fotos" aria-label="Fotos">
      {SEITEN.map((seite) => (
        <FotoKachel key={seite} seite={seite} src={adresse(fotos, seite)} onOeffnen={onOeffnen} />
      ))}
    </section>
  );
}

function FotoKachel({
  seite,
  src,
  onOeffnen,
}: {
  seite: Seite;
  src?: string;
  onOeffnen: (seite: Seite, von: HTMLElement) => void;
}) {
  const [kaputt, setKaputt] = useState(false);
  if (!src) {
    return (
      <div className="foto platzhalter">
        <span className="ersatz">{seite === "vorne" ? "kein Foto" : "kein Rückenetikett aufgenommen"}</span>
        <span className="unter">
          <span>{FOTO_ALT[seite]}</span>
        </span>
      </div>
    );
  }
  if (kaputt) {
    return (
      <div className="foto platzhalter">
        <span className="ersatz">Foto ließ sich nicht laden</span>
        <span className="unter">
          <span>{FOTO_ALT[seite]}</span>
        </span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="foto"
      aria-label={`${FOTO_ALT[seite]} vergrößern`}
      onClick={(e) => onOeffnen(seite, e.currentTarget)}
    >
      <Bild
        src={src}
        alt={FOTO_ALT[seite]}
        masse={KACHEL}
        onKaputt={() => setKaputt(true)}
      />
      <span className="unter" aria-hidden="true">
        <span>{FOTO_ALT[seite]}</span>
        <span>vergrößern</span>
      </span>
    </button>
  );
}

/** Kleine Knöpfe „Foto ansehen: Vorne / Hinten“ im offenen Feld (Option A). */
export function FotoZugriff({ fotos, onOeffnen }: { fotos: Fotos; onOeffnen: (seite: Seite, von: HTMLElement) => void }) {
  const seiten = SEITEN.filter((seite) => adresse(fotos, seite));
  if (seiten.length === 0) return null;
  return (
    <div className="foto-zugriff">
      <span>Foto ansehen:</span>
      {seiten.map((seite) => (
        <button
          key={seite}
          type="button"
          className="mini"
          aria-label={`${FOTO_ALT[seite]} ansehen`}
          onClick={(e) => onOeffnen(seite, e.currentTarget)}
        >
          <Bild src={vorschauAdresse(fotos, seite) ?? ""} alt="" masse={MINI} ersatz={<span className="mini-ersatz" />} />
          {seite === "vorne" ? "Vorne" : "Hinten"}
        </button>
      ))}
    </div>
  );
}

/**
 * Foto in voller Größe als `<dialog>` auf derselben Seite. Schließen über „Schließen“, Escape oder
 * einen Tipp auf den Hintergrund; danach kehrt der Fokus zu dem Knopf zurück, der es geöffnet hat.
 */
export function useFotoDialog(fotos: Fotos) {
  const ref = useRef<HTMLDialogElement>(null);
  const ausloeser = useRef<HTMLElement | null>(null);
  const [seite, setSeite] = useState<Seite | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (seite && dialog && !dialog.open) dialog.showModal();
  }, [seite]);

  function oeffnen(neu: Seite, von: HTMLElement) {
    ausloeser.current = von;
    setSeite(neu);
  }

  function geschlossen() {
    setSeite(null);
    const ziel = ausloeser.current;
    ausloeser.current = null;
    if (ziel && ziel.isConnected) ziel.focus();
  }

  const src = seite ? adresse(fotos, seite) : undefined;
  const dialog = (
    <dialog
      ref={ref}
      className="foto-dialog"
      aria-labelledby="foto-titel"
      onClose={geschlossen}
      onClick={(e) => {
        // Tipp auf den Hintergrund: Das Ziel ist dann der Dialog selbst, nicht sein Inhalt.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      <div className="foto-gross">
        {seite && src ? (
          <Bild
            key={src}
            src={src}
            alt={FOTO_ALT[seite]}
            masse={GROSS}
            ersatz={<p className="ersatz">Foto ließ sich nicht laden</p>}
          />
        ) : null}
      </div>
      <div className="dialog-fuss">
        <strong id="foto-titel">{seite ? FOTO_ALT[seite] : ""}</strong>
        <button type="button" className="knopf" onClick={() => ref.current?.close()}>
          Schließen
        </button>
      </div>
    </dialog>
  );

  return { oeffnen, istOffen: () => ref.current?.open === true, dialog };
}

/** Nur die Fotos mit ihrem Dialog, für eine Karte, die sich nicht bearbeiten lässt. */
export function NurFotos({ fotos }: { fotos: Fotos }) {
  const foto = useFotoDialog(fotos);
  return (
    <>
      <FotoReihe fotos={fotos} onOeffnen={foto.oeffnen} />
      {foto.dialog}
    </>
  );
}
