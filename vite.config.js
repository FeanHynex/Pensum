import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  // GitHub Pages project site: https://<username>.github.io/Pensum/
  base: "/Pensum/",
  // Stellt die Version aus package.json als globale Konstante __APP_VERSION__ zur Laufzeit bereit
  // (z. B. Anzeige in den Einstellungen). Bei jedem funktional relevanten Release muss die
  // "version" in package.json manuell hochgezählt werden.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["pwa-icon.svg"],
      manifest: {
        name: "Pensum – Arbeitszeit für Lehrkräfte",
        short_name: "Pensum",
        description: "Arbeitszeiterfassung und Auswertung für Lehrkräfte",
        theme_color: "#022c22",
        background_color: "#f5f5f4",
        display: "standalone",
        start_url: "/Pensum/",
        scope: "/Pensum/",
        icons: [
          { src: "pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      }
    })
  ]
});
