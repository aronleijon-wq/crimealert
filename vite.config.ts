import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // A new version installs in the background and is switched to when the page is hidden
      // (see main.tsx), instead of reloading the page in the middle of a visit
      registerType: "prompt",
      // The install icons aren't needed offline; the browser fetches them when installing
      includeManifestIcons: false,
      devOptions: {
        enabled: false,
      },
      includeAssets: ["lovable-uploads/c2e577a8-2adc-46ca-b331-79142ec40f70.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        // Not shown by the app: the 512 px install icon and two unused uploads (about 0.9 MB)
        globIgnores: ["**/pwa-512x512.png", "**/lovable-uploads/442645a7-*.png", "**/lovable-uploads/f5451b06-*.png"],
        importScripts: ["/sw-push.js"],
      },
      manifest: {
        name: "CrimeAlert — Säkerhetskarta",
        short_name: "CrimeAlert",
        description: "Realtidsbaserad säkerhets- och incidentkarta för Sverige.",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Rarely-changing vendor code gets its own chunks so browsers keep them cached across deploys
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
