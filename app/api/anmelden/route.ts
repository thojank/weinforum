import { NextResponse } from "next/server";
import { ZUGANG_COOKIE, zugangsMarke } from "@/lib/zugang";

export async function POST(request: Request) {
  const formular = await request.formData();
  const eingabe = String(formular.get("code") ?? "");
  const code = process.env.APP_ZUGANGSCODE;

  if (!code || eingabe !== code) {
    return NextResponse.redirect(new URL("/anmelden?fehler=1", request.url), 303);
  }

  const antwort = NextResponse.redirect(new URL("/", request.url), 303);
  antwort.cookies.set(ZUGANG_COOKIE, await zugangsMarke(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  return antwort;
}
