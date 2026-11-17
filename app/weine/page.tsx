import Link from "next/link";
import { weinStore } from "@/lib/weinkartei/store";

export const dynamic = "force-dynamic";

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
  return (
    <>
      <p>
        <Link href="/">← Start</Link>
      </p>
      <h1>Alle Weine</h1>
      <p className="hinweis">{weine.length} Einträge</p>
      <ul className="weinliste">
        {weine.map((w) => (
          <li key={w.kennung}>
            {w.fotoVorneVorschau ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={w.fotoVorneVorschau} alt="" width={48} height={48} />
            ) : (
              <span className="platzhalter" aria-hidden="true" />
            )}
            <span>
              <strong>{w.name}</strong> {w.jahrgang ?? ""}
              <br />
              <span className="hinweis">
                {w.erzeuger ? `${w.erzeuger} · ` : ""}
                {w.stand}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
