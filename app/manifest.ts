import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pinky",
    short_name: "Pinky",
    description: "Pinky promise accountability with your friends",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fff7f3",
    theme_color: "#f2316f",
    categories: ["health", "lifestyle", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press menu on Android. iOS ignores these.
    shortcuts: [
      { name: "New pact", url: "/pacts/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Friends", url: "/friends", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
