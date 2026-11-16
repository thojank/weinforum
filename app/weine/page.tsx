import Link from "next/link";
import { weinStore } from "@/lib/weinkartei/store";

export const dynamic = "force-dynamic";

export default async function Weine() {
  const store = weinStore();
  if (!store) {
    return (
      <>
        <h1>Alle Weine</h1>
        <p>Die Datenbank ist noch nicht verbunden. Siehe README, Abschnitt „Einrichten“.</p>
        <Link href="/">Zurück</Link>
      </>
    );
  }
  const weine = await store.liste();
  return (
    <>
      <h1>Alle Weine</h1>
      <p className="hinweis">{weine.length} Einträge</p>
      <ul>
        {weine.map((w) => (
          <li key={w.kennung}>
            {w.name} {w.jahrgang ?? ""} – {w.stand}
          </li>
        ))}
      </ul>
      <Link href="/">Zurück</Link>
    </>
  );
}
