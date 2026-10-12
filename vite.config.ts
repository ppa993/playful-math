import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
        "audio/number-0.mp3",
        "audio/number-1.mp3",
        "audio/number-2.mp3",
        "audio/number-3.mp3",
        "audio/number-4.mp3",
        "audio/number-5.mp3",
        "audio/number-6.mp3",
        "audio/number-7.mp3",
        "audio/number-8.mp3",
        "audio/number-9.mp3",
        "audio/number-10.mp3",
        "audio/plus.mp3",
        "audio/minus.mp3",
        "audio/equals-question.mp3",
        "audio/choose-greater.mp3",
        "audio/choose-less.mp3",
        "audio/less-or-greater.mp3",
        "audio/try-again.mp3",
        "audio/praise-1.mp3",
        "audio/praise-2.mp3",
        "audio/praise-3.mp3",
        "audio/praise-4.mp3",
        "audio/praise-5.mp3",
        "audio/praise-6.mp3",
      ],
      manifest: {
        name: "Toán Vui!",
        short_name: "Toán Vui",
        description: "Ứng dụng luyện tập phép cộng và phép trừ vui nhộn dành cho trẻ em.",
        theme_color: "#ff6b9d",
        background_color: "#ffdeeb",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
    viteSingleFile(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
