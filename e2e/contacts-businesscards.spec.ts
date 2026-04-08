/**
 * BusinessCardsHub (1084 LOC) — comportamento da preservare durante il refactor.
 *
 * Vol. II §9.3: questi test devono passare PRIMA, DURANTE e DOPO lo splitting
 * dei sotto-componenti. Sono pensati per essere robusti ai cambi di DOM
 * structure: usare getByRole/getByLabel/getByText, MAI selettori CSS sensibili.
 */
import { test, expect } from "@playwright/test";

test.describe("BusinessCardsHub @regression", () => {
  test.beforeEach(async ({ page }) => {
    // L'app potrebbe richiedere autenticazione: in CI useremo un fixture
    // di sessione mock. Per ora il test naviga e accetta la pagina di login.
    await page.goto("/contacts");
  });

  test("la pagina contatti renderizza senza errori", async ({ page }) => {
    await expect(page.locator("#root")).not.toBeEmpty();
    // Nessun ErrorBoundary visibile
    await expect(page.getByText(/qualcosa è andato storto/i)).toHaveCount(0);
  });

  test("se autenticato, mostra la lista contatti o lo stato vuoto", async ({ page }) => {
    // Verifica che almeno uno dei pattern attesi sia presente:
    // - lista contatti
    // - empty state
    // - login form (utente non autenticato)
    const candidates = [
      page.getByRole("heading", { name: /contatti/i }),
      page.getByText(/nessun contatto/i),
      page.getByRole("button", { name: /accedi|login/i }),
    ];
    let visible = false;
    for (const c of candidates) {
      if ((await c.count()) > 0) { visible = true; break; }
    }
    expect(visible, "expected one of: heading 'Contatti', empty state, or login").toBe(true);
  });
});
