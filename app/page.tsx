import Link from "next/link";

export default function Startseite() {
  return (
    <>
      <h1>Weinkartei</h1>
      <p className="hinweis">Grundgerüst. Aufnehmen und Prüfen folgen in Stufe 1.</p>
      <Link className="kachel" href="/aufnehmen">
        Wein aufnehmen
      </Link>
      <Link className="kachel zweitrangig" href="/weine">
        Alle Weine
      </Link>
    </>
  );
}
