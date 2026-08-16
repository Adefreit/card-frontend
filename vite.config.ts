import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = new URL(env.VITE_API_BASE_URL ?? "http://localhost:3000")
    .origin;

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: {
          name: "Legendary Profiles",
          short_name: "Legendary",
          description:
            "Digital profile cards you can launch from your home screen.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#0b121b",
          theme_color: "#0b121b",
          icons: [
            { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
            {
              src: "/favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any",
            },
          ],
        },
        workbox: {
          runtimeCaching: [
            {
              // API responses must never be served from the SW cache, always hit the network
              urlPattern: ({ url }) => url.origin === apiOrigin,
              handler: "NetworkOnly",
            },
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: { cacheName: "html-shell" },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "images",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
      }),
    ],
  };
});
