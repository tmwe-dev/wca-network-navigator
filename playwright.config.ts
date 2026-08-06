/**
 * Playwright config — scaffold E2E (Vol. II §9.3 + Vol. I Ondata 6 deferred).
 *
 * Obiettivo: fornire una baseline E2E sui flussi che attraversano i
 * monoliti residui (FiltersDrawer 1300 LOC, BusinessCardsHub 1084 LOC,
 * AddContactDialog 794 LOC) PRIMA di refattorizzarli, in modo da catturare
 * regressioni comportamentali durante lo splitting dei componenti.
 *
 * Attivazione: `npm i -D @playwright/test && npx playwright install --with-deps`
 * Esecuzione: `npm run e2e`
 *
 * Lo scaffold è committato come "infrastruttura pronta": non scarica
 * browser binaries automaticamente né blocca CI finché non viene
 * abilitato esplicitamente.
 */
import { defineConfig, devices } from "@playwright/test";

/**
 * Modalità server (versionata, nessun file di config temporaneo):
 *   E2E_SERVER_MODE=preview (default) → build statica su :4173
 *   E2E_SERVER_MODE=dev               → vite dev server su :8080
 *   E2E_SERVER_MODE=external          → nessun webServer, usa E2E_BASE_URL
 */
const SERVER_MODE = process.env.E2E_SERVER_MODE ?? "preview";
const DEFAULT_PORT = SERVER_MODE === "dev" ? 8080 : 4173;
const PORT = Number(process.env.E2E_PORT ?? DEFAULT_PORT);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  timeout: Number(process.env.E2E_TIMEOUT_MS ?? 45_000),
  expect: { timeout: Number(process.env.E2E_EXPECT_TIMEOUT_MS ?? 10_000) },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: Number(process.env.E2E_ACTION_TIMEOUT_MS ?? 10_000),
    navigationTimeout: Number(process.env.E2E_NAV_TIMEOUT_MS ?? 30_000),
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Opzionale: permette di puntare a un Chromium di sistema quando i
        // binari scaricati da Playwright non sono eseguibili (sandbox senza
        // librerie di sistema). Nessun path è hardcodato nel repo.
        ...(process.env.E2E_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } } : {}),
      },
    },
  ],

  webServer:
    SERVER_MODE === "external"
      ? undefined
      : {
          command:
            SERVER_MODE === "dev"
              ? `npm run dev -- --port ${PORT} --strictPort`
              : `npm run preview -- --port ${PORT} --strictPort`,
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
});
