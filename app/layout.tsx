import type { Metadata, Viewport } from "next";
// Webschriften kommen als Pakete von Fontsource und werden mit der App ausgeliefert.
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Weinkartei",
  description: "Weine per Foto erfassen, prüfen und verwenden",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8e3148",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
