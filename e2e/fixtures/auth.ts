import { test as base, expect } from "@playwright/test";

/**
 * Reusable auth fixture for E2E tests.
 * Usage:
 *   import { test, expect } from "../fixtures/auth";
 *   test("my test", async ({ authedPage }) => { ... });
 */

type AuthFixtures = {
  authedPage: Awaited<ReturnType<typeof createAuthedPage>>;
};

async function createAuthedPage(page: any) {
  const email = process.env.E2E_USER_EMAIL || "test@example.com";
  const password = process.env.E2E_USER_PASSWORD || "test-password";

  await page.goto("/auth");
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation away from /auth
  await page.waitForURL((url: URL) => !url.pathname.includes("/auth"), { timeout: 15000 });

  return page;
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ page }, use) => {
    const authed = await createAuthedPage(page);
    await use(authed);
  },
});

export { expect };
