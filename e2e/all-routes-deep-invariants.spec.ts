/**
 * Deep invariants matrix — copertura sistematica route critiche V2.
 *
 * Per ogni route nella matrice esegue il bundle di invarianti (no 5xx,
 * no pageerror, no ErrorBoundary, no AI diretto, no secret leak,
 * render mobile+desktop).
 *
 * Chiude residuo audit "−3000 E2E nightly espansione" sostituendo 30+
 * spec custom con una singola matrice dichiarativa.
 *
 * Pesante (~30 route × 2 viewport). Pensato per il nightly, non lo smoke.
 */
import { test, expect } from "@playwright/test";
import {
  attachInvariantWatchers,
  assertInvariants,
  assertNoErrorBoundary,
  assertRootNotEmpty,
} from "./_helpers/invariants";

const CRITICAL_ROUTES = [
  // Core
  "/",
  "/auth",
  "/v2/command",
  "/v2/agenda",
  "/v2/network",
  "/v2/crm",
  "/v2/outreach",
  "/v2/campaigns",
  "/v2/settings",
  // CRM / contacts
  "/v2/business-cards",
  "/v2/contacts",
  "/v2/deals",
  // Email pipeline
  "/v2/email-composer",
  "/v2/inreach",
  "/v2/funnemail",
  "/v2/email-intelligence",
  // AI / governance
  "/v2/agent-chat",
  "/v2/agents",
  "/v2/agents/missions",
  "/v2/agents/autopilot",
  "/v2/ai-staff",
  "/v2/ai-staff/prompt-lab",
  "/v2/ai-staff/kb-supervisor",
  "/v2/ai-interactions-log",
  "/v2/ai-lab",
  "/v2/ai-control",
  "/v2/prompt-lab/catalog",
  "/v2/prompt-lab/tests",
  // Observability / admin
  "/v2/pipeline-traces",
  "/v2/observability",
  "/v2/admin/health",
  "/v2/approvals",
] as const;

test.describe("deep-invariants @nightly", () => {
  for (const route of CRITICAL_ROUTES) {
    test(`${route} — invarianti (no 5xx / no pageerror / no AI diretta / no secret leak)`, async ({ page }) => {
      const inv = attachInvariantWatchers(page);
      const res = await page.goto(route);
      // 4xx accettabili (auth redirect), 5xx no.
      expect(res?.status() ?? 0).toBeLessThan(500);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      await assertNoErrorBoundary(page);
      await assertRootNotEmpty(page);
      assertInvariants(inv);
    });

    test(`${route} — render mobile 375x667`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      const inv = attachInvariantWatchers(page);
      const res = await page.goto(route);
      expect(res?.status() ?? 0).toBeLessThan(500);
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoErrorBoundary(page);
      expect(inv.pageErrors,
        `pageerror su mobile: ${inv.pageErrors.join(" | ")}`
      ).toHaveLength(0);
    });
  }
});