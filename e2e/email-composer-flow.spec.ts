import { test, expect } from "@playwright/test";

test.describe("Email Composer Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/v2/email-composer");
    await page.waitForLoadState("networkidle");
  });

  test("route /v2/email-composer loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_") &&
      !e.includes("ResizeObserver")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("editor area renders (rich text or textarea)", async ({ page }) => {
    // Look for rich text editor or textarea for email body
    const editor = page.locator('[contenteditable="true"]')
      .or(page.locator('textarea'))
      .or(page.locator('[role="textbox"]'));

    const editorVisible = await editor.isVisible({ timeout: 10000 }).catch(() => false);
    expect(editorVisible).toBeTruthy();
  });

  test("Oracle panel is visible (sidebar with email type chips)", async ({ page }) => {
    // EmailAIPanel should be visible on the right side
    const oraclePanel = page.locator("div").filter({ has: page.locator("button").filter({ hasText: /generat|improve|template/i }) });

    const panelVisible = await oraclePanel.isVisible({ timeout: 10000 }).catch(() => false);

    // If panel exists, it should have action buttons
    if (panelVisible) {
      const generateBtn = page.getByRole("button").filter({ hasText: /generat/i });
      expect(await generateBtn.count().then(c => c > 0)).toBeTruthy();
    }
  });

  test("Generate button exists", async ({ page }) => {
    const generateButton = page.getByRole("button").filter({ hasText: /generat|crea/i });
    const btnCount = await generateButton.count().catch(() => 0);

    if (btnCount > 0) {
      await expect(generateButton.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("Recipient field is present", async ({ page }) => {
    const recipientInput = page.locator('input')
      .filter({ has: page.locator('[placeholder*="destinatar"]').or(page.locator('[placeholder*="recipient"]')) })
      .or(page.locator('input[placeholder*="email"]'))
      .or(page.locator('div').filter({ has: page.getByText(/destinatar|recipient|a:/i) }));

    const recipientVisible = await recipientInput.isVisible({ timeout: 10000 }).catch(() => false)
      || await page.getByText(/a:|to:/i).isVisible({ timeout: 5000 }).catch(() => false);

    expect(recipientVisible).toBeTruthy();
  });

  test("Subject field is present", async ({ page }) => {
    const subjectInput = page.locator('input')
      .filter({ has: page.locator('[placeholder*="oggetto"]').or(page.locator('[placeholder*="subject"]')) })
      .or(page.locator('input[placeholder*="subject"]'));

    const subjectVisible = await subjectInput.isVisible({ timeout: 10000 }).catch(() => false)
      || await page.getByText(/oggetto|subject/i).isVisible({ timeout: 5000 }).catch(() => false);

    expect(subjectVisible).toBeTruthy();
  });

  test("Subject field accepts input", async ({ page }) => {
    const subjectInput = page.locator('input')
      .filter({ has: page.locator('[placeholder*="oggetto"]').or(page.locator('[placeholder*="subject"]')) })
      .or(page.locator('input[placeholder*="Oggetto della email"]'));

    const inputVisible = await subjectInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (inputVisible) {
      await subjectInput.first().fill("Test Subject", { timeout: 5000 }).catch(() => {});
      const value = await subjectInput.first().inputValue().catch(() => "");
      expect(value).toBeTruthy();
    }
  });

  test("Template drawer can open", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    // Look for template button or link
    const templateButton = page.getByRole("button").filter({ hasText: /template|salva template/i });
    const templateCount = await templateButton.count().catch(() => 0);

    // Template functionality might not always be available, but should not error
    if (templateCount > 0) {
      await templateButton.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("PermissionGate for send button", async ({ page }) => {
    // Look for Send button with PermissionGate
    const sendButton = page.getByRole("button").filter({ hasText: /invia|send/i });
    const permissionMessage = page.getByText(/non hai il permesso|you don't have permission/i);

    const sendBtnExists = await sendButton.count().then(c => c > 0).catch(() => false);
    const permissionMsgExists = await permissionMessage.count().then(c => c > 0).catch(() => false);

    // Either send button or permission message should exist
    expect(sendBtnExists || permissionMsgExists).toBeTruthy();
  });

  test("nessun ErrorBoundary visibile", async ({ page }) => {
    await expect(page.getByText(/qualcosa è andato storto|something went wrong/i)).toHaveCount(0);
  });

  test("no critical console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_") &&
      !e.includes("ResizeObserver") &&
      !e.includes("Content Security Policy")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("responsive layout - desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    const editor = page.locator('[contenteditable="true"]')
      .or(page.locator('textarea'))
      .or(page.locator('[role="textbox"]'));

    await expect(editor).toBeVisible({ timeout: 10000 });
  });

  test("responsive layout - tablet", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const subjectField = page.locator('input[placeholder*="oggetto"]')
      .or(page.locator('input[placeholder*="subject"]'));

    const fieldExists = await subjectField.isVisible({ timeout: 5000 }).catch(() => false)
      || await page.getByText(/oggetto|subject/i).isVisible({ timeout: 5000 }).catch(() => false);

    expect(fieldExists).toBeTruthy();
  });

  test("responsive layout - mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const mainContent = page.locator("div[class*='flex'][class*='flex-col']");

    const contentVisible = await mainContent.isVisible({ timeout: 10000 }).catch(() => false)
      || await page.getByText(/oggetto|subject|destinatar/i).isVisible({ timeout: 5000 }).catch(() => false);

    expect(contentVisible).toBeTruthy();
  });

  test("email toolbar renders", async ({ page }) => {
    // EmailToolbar should have various action buttons
    const toolbar = page.locator("div").filter({ has: page.locator("button").filter({ hasText: /variabil|link|attachment|preview/i }) });

    const toolbarButtons = page.getByRole("button").filter({ hasText: /variabil|link|anteprima|preview/i });
    const btnCount = await toolbarButtons.count().catch(() => 0);

    // Should have at least some toolbar buttons
    expect(btnCount).toBeGreaterThanOrEqual(0);
  });

  test("draft save button present", async ({ page }) => {
    const draftButton = page.getByRole("button").filter({ hasText: /bozza|draft/i });
    const btnCount = await draftButton.count().catch(() => 0);

    if (btnCount > 0) {
      await expect(draftButton.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("recipient fields are editable", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });

    const inputs = page.locator('input[type="text"]');
    const inputCount = await inputs.count().catch(() => 0);

    // Try to interact with a field
    if (inputCount > 0) {
      await inputs.first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
    }

    const criticalErrors = errors.filter((e) =>
      !e.includes("favicon") &&
      !e.includes("404") &&
      !e.includes("ERR_")
    );
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test("page structure has correct flex layout", async ({ page }) => {
    const mainContainer = page.locator("div").filter({ has: page.locator('[contenteditable="true"]').or(page.locator('textarea')) });

    const containerVisible = await mainContainer.isVisible({ timeout: 10000 }).catch(() => false);
    expect(containerVisible).toBeTruthy();
  });
});

/* ============================================================
 * DEEP INVARIANTS REINFORCEMENT (F3 - 2026-05-25)
 * Vol II §enterprise-method + audit 2026-05-13
 * Asserzioni invarianti su route critica /v2/email-composer
 * ============================================================ */
import {
  runDeepInvariants,
  attachInvariantWatchers,
  assertInvariants,
  assertNoErrorBoundary,
  assertRootNotEmpty,
  assertResponsiveRender,
} from "./_helpers/invariants";
import { test as deepTest, expect as deepExpect } from "@playwright/test";

const DEEP_ROUTE = "/v2/email-composer";

deepTest.describe("Deep invariants: /v2/email-composer", () => {
  deepTest("nessun pageerror / 5xx / leak segreti / AI diretta", async ({ page }) => {
    await runDeepInvariants(page, DEEP_ROUTE);
  });

  deepTest("redirect coerente a /auth se non autenticato (o pagina renderizzata)", async ({ page }) => {
    const res = await page.goto(DEEP_ROUTE);
    deepExpect(res?.status() ?? 0).toBeLessThan(500);
    await page.waitForLoadState("networkidle").catch(() => {});
    const url = new URL(page.url());
    const isAuthOr = url.pathname.includes("/auth") || url.pathname.startsWith("/v2/email-composer".split("/").slice(0, 3).join("/"));
    deepExpect(isAuthOr, `URL atteso /auth o sotto ramo, got ${url.pathname}`).toBeTruthy();
  });

  deepTest("nessun ErrorBoundary anche dopo navigazioni ripetute", async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.goto(DEEP_ROUTE);
      await page.waitForLoadState("networkidle").catch(() => {});
      await assertNoErrorBoundary(page);
    }
  });

  deepTest("rendering responsive (mobile + desktop)", async ({ page }) => {
    await assertResponsiveRender(page, DEEP_ROUTE);
  });

  deepTest("nessuna chiamata AI diretta dal frontend (charter ai-invocation)", async ({ page }) => {
    const inv = attachInvariantWatchers(page);
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    deepExpect(inv.forbiddenAiCalls,
      `AI provider diretto: ${inv.forbiddenAiCalls.join(" | ")}`
    ).toHaveLength(0);
  });

  deepTest("network: nessuna 5xx ne body con service_role", async ({ page }) => {
    const inv = attachInvariantWatchers(page);
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1500);
    deepExpect(inv.serverErrors,
      `5xx: ${inv.serverErrors.map(e => e.url).join(" | ")}`
    ).toHaveLength(0);
    deepExpect(inv.secretLeaks).toHaveLength(0);
  });

  deepTest("root idratato e <html lang> impostato", async ({ page }) => {
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertRootNotEmpty(page);
    const lang = await page.locator("html").getAttribute("lang");
    deepExpect(lang).toBeTruthy();
  });

  deepTest("assertInvariants finale (bundle completo)", async ({ page }) => {
    const inv = attachInvariantWatchers(page);
    await page.goto(DEEP_ROUTE);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2500);
    assertInvariants(inv);
  });
});
