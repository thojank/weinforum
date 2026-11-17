export default async function Anmelden({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;
  return (
    <>
      <h1>Weinkartei</h1>
      <form method="post" action="/api/anmelden" className="formular">
        <label htmlFor="code">Zugangscode</label>
        <input id="code" name="code" type="password" autoComplete="current-password" required autoFocus />
        {fehler ? <p className="fehler">Der Code stimmt nicht.</p> : null}
        <button type="submit">Anmelden</button>
      </form>
    </>
  );
}
