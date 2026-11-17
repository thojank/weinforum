import { NextResponse } from "next/server";
import { weinStore } from "@/lib/weinkartei/store";

const MAX_BYTES = 4 * 1024 * 1024; // Vercel nimmt je Anfrage rund 4,5 MB an.

function alsFoto(wert: FormDataEntryValue | null): Blob | undefined {
  return wert instanceof Blob && wert.size > 0 ? wert : undefined;
}

// Nimmt die beiden Fotos entgegen und legt eine Karte „aufgenommen“ an.
export async function POST(request: Request) {
  const store = weinStore();
  if (!store) {
    return NextResponse.json({ fehler: "Die Datenbank ist nicht eingerichtet." }, { status: 503 });
  }

  const formular = await request.formData();
  const vorne = alsFoto(formular.get("vorne"));
  const hinten = alsFoto(formular.get("hinten"));

  if (!vorne) {
    return NextResponse.json({ fehler: "Das Foto vom Vorderetikett fehlt." }, { status: 400 });
  }
  if (vorne.size + (hinten?.size ?? 0) > MAX_BYTES) {
    return NextResponse.json({ fehler: "Die Fotos sind zusammen zu groß." }, { status: 413 });
  }

  try {
    const wein = await store.aufnehmen({ vorne, hinten });
    return NextResponse.json({ kennung: wein.kennung }, { status: 201 });
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : "Unbekannter Fehler";
    return NextResponse.json({ fehler: text }, { status: 502 });
  }
}
