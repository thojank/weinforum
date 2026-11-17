import Link from "next/link";

export default function Startseite() {
  return (
    <>
      <h1>Weinkartei</h1>
      <p className="hinweis">Aufnehmen geht. Lesen der Etiketten und Prüfen folgen.</p>
      <Link className="kachel" href="/aufnehmen">
        Wein aufnehmen
      </Link>
      <Link className="kachel zweitrangig" href="/weine">
        Alle Weine
      </Link>
    </>
  );
}
