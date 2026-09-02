import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
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
        start_url: "/",
        icons: [
          { src: "pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      }
    })
  ]
});
