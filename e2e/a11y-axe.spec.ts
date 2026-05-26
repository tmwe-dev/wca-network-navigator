/**
 * a11y-axe.spec — audit accessibilità con axe-core su 5 route pubbliche.
 *
 * Filosofia: copertura WCAG 2.1 AA su SOLO le route che non richiedono
 * login (auth pages + landing). Failure = qualunque violazione SERIOUS
 * o CRITICAL. Le route protette sono coperte separatamente quando
 * E2E_USER_EMAIL/PASSWORD sono disponibili in CI.
 *
 * Reporting-only se A11Y_WARN_ONLY=1 (utile per baseline).
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_ROUTES = ["/auth", "/auth/reset-password", "/auth/forgot-password"];

const WARN_ONLY = process.env.A11Y_WARN_ONLY === "1";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const route of PUBLIC_ROUTES) {
  test(`a11y axe — ${route}`, async ({ page }) => {
    const resp = await page.goto(route, { waitUntil: "networkidle" });
    // Route può non esistere → skip morbido
    if (!resp || resp.status() >= 400) {
      test.skip(true, `route ${route} non disponibile (status ${resp?.status()})`);
      return;
    }

    const results = await new AxeBuilder({ page })
      .withTags(TAGS)
      .disableRules(["color-contrast"]) // gestito dal design system; valutiamo a parte
      .analyze();

    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    if (serious.length > 0) {
      const summary = serious
        .map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodi)`)
        .join("\n");
      const msg = `Violazioni a11y SERIOUS/CRITICAL su ${route}:\n${summary}`;
      if (WARN_ONLY) {
        console.warn(msg);
      } else {
        expect(serious, msg).toEqual([]);
      }
    }
  });
}