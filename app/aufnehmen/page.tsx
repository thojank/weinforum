import Link from "next/link";
import { Aufnahme } from "./aufnahme";

export default function Aufnehmen() {
  return (
    <>
      <p>
        <Link href="/">← Start</Link>
      </p>
      <h1>Wein aufnehmen</h1>
      <Aufnahme />
    </>
  );
}
