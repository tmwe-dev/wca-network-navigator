import { seedTestData, cleanupTestData } from "./fixtures/seed";

export default async function globalSetup() {
  if (process.env.CI) {
    try {
      await seedTestData();
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
