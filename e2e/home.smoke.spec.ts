/**
 * @smoke — verifica che l'app monti senza errori console critici.
 *
 * Questo è il primo test E2E della suite e funge da canary: se questo
 * fallisce, qualunque altro test sarebbe inaffidabile. Cattura
 * regressioni di bootstrap (errori in main.tsx, ErrorBoundary scattato
 * al render iniziale, asset 404).
 */
import { test, expect } from "@playwright/test";

test.describe("home @smoke", () => {
  test("la root monta senza errori console critici", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto("/");

    // L'app deve renderizzare almeno qualcosa nel root
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 10_000 });

    // Nessun errore critico al boot
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("nessun ErrorBoundary visibile al primo render", async ({ page }) => {
    await page.goto("/");
    // Convenzione: ErrorBoundary mostra il messaggio "Qualcosa è andato storto"
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });
});
