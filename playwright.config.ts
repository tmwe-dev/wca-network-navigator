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

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    // Avvia la build statica già prodotta da `vite build`
    command: "npm run preview -- --port " + PORT + " --strictPort",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
