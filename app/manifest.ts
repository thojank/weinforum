import type { MetadataRoute } from "next";

// Damit sich die App auf dem Handy als Symbol auf den Startbildschirm legen lässt.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Weinkartei",
    short_name: "Weinkartei",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f5",
    theme_color: "#8e3148",
    lang: "de",
  };
}
