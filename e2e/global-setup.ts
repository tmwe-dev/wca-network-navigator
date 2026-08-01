import { seedTestData, cleanupTestData } from "./fixtures/seed";

async function seedWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await seedTestData();
    } catch (error) {
      console.warn(`[e2e] Seed attempt ${i + 1}/${maxRetries} failed:`, (error as Error).message);
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export default async function globalSetup() {
  if (process.env.CI) {
    try {
      await seedWithRetry();
      console.log("[e2e] Test data seeded successfully");
    } catch (err) {
      console.warn("[e2e] Seed skipped (no DB access):", (err as Error).message);
    }
  }
}

export async function globalTeardown() {
  if (process.env.CI) {
    try {
      await cleanupTestData();
      console.log("[e2e] Test data cleaned up");
    } catch (err) {
      console.warn("[e2e] Cleanup skipped:", (err as Error).message);
    }
  }
}
