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
    // Motivazione (D1.1): molte suite DAL usano `await import()` di moduli
    // pesanti; il transform Vite SSR a freddo, sotto carico parallelo,
    // supera i 5s default provocando timeout intermittenti (flaky).
    // Alziamo solo il timeout di default: assertion e comportamento runtime
    // invariati, nessuno skip, nessun retry.
    testTimeout: 30_000,
    hookTimeout: 30_000,
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
        // Baseline 2026-07-19 (ratchet #3 — Sprint bonifica 7 punti):
        // aggiunti test dedicati per v2/core/domain/errors e v2/core/security/sanitizeHtml.
        // Statements/lines alzati di 1 punto rispetto al ratchet #2 (10 -> 11)
        // per bloccare regressioni; branches/functions invariati.
        statements: 11,
        branches: 53,
        functions: 30,
        lines: 11,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
