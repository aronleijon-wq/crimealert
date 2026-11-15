import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Each build's id: written to /version.json and into the app, so an open page can tell that a
// newer build is live (src/lib/appVersion.ts), and added to the service worker's script so the
// browser never takes an old copy of it from its cache
const BUILD_ID = Date.now().toString(36);

/** /version.json with this build's id */
const versionFile = () => ({
  name: "version-file",
  generateBundle(this: { emitFile: (file: { type: "asset"; fileName: string; source: string }) => void }) {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_ID__: JSON.stringify(mode === "development" ? "dev" : BUILD_ID),
  },
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
    versionFile(),
    VitePWA({
      // A new version takes over as soon as it is installed and the old version's files are
      // removed. Open pages reload when it is safe (src/lib/appVersion.ts).
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
        importScripts: [`/sw-push.js?v=${BUILD_ID}`],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
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
