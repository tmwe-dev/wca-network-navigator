import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "src/i18n/**",
      ],
      thresholds: {
        // Baseline 2026-05-27 (ratchet #2 — Sprint 90k Fase 1 DAL coverage):
        // misurato 10.02 / 53.87 / 30.96 / 10.02 dopo l'aggiunta di 45 test DAL.
        // Soglie allineate al misurato per bloccare regressioni reali.
        // Da alzare incrementalmente man mano che aggiungiamo test.
        statements: 10,
        branches: 53,
        functions: 30,
        lines: 10,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
