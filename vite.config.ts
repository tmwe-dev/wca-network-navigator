import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  build: {
    // Vol. II §13.2 — code splitting esplicito per ridurre il bundle iniziale.
    // Le librerie pesanti (exceljs, three, recharts, framer-motion) e i blocchi
    // vendor comuni vengono isolati in chunk separati così la home page non
    // paga il costo di feature usate solo in pagine specifiche.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("exceljs")) return "vendor-exceljs";
          // Tutto l'ecosistema 3D / video / livekit di @react-three/drei
          // (hls.js, livekit-client, stats-gl, three-stdlib, @mediapipe, @dimforge)
          // viene caricato solo dalla pagina SuperHome3D — chunk dedicato.
          if (
            id.includes("three") ||
            id.includes("@react-three") ||
            id.includes("hls.js") ||
            id.includes("livekit-client") ||
            id.includes("stats-gl") ||
            id.includes("@mediapipe") ||
            id.includes("@dimforge") ||
            id.includes("rxjs")
          ) return "vendor-three";
          if (id.includes("lodash")) return "vendor-lodash";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("dompurify") || id.includes("react-markdown") || id.includes("remark-")) {
            return "vendor-markdown";
          }
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-tanstack";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) {
            return "vendor-forms";
          }
          if (id.includes("date-fns") || id.includes("react-day-picker")) return "vendor-date";
          if (id.includes("papaparse")) return "vendor-csv";
          if (id.includes("@elevenlabs")) return "vendor-elevenlabs";
          if (id.includes("@lovable.dev")) return "vendor-lovable";
          if (id.includes("react-resizable-panels")) return "vendor-resizable";
          if (id.includes("embla-carousel") || id.includes("vaul") || id.includes("sonner") || id.includes("cmdk") || id.includes("input-otp")) {
            return "vendor-ui-misc";
          }
          if (id.includes("next-themes")) return "vendor-react";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("react-router") ||
            id.includes("scheduler") ||
            id.includes("use-sync-external-store") ||
            id.includes("clsx") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority")
          ) {
            return "vendor-react";
          }
          return "vendor-misc";
        },
      },
    },
  },
}));
