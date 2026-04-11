import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Scans for empty catch blocks — a code smell that hides errors.
 * Vol. I §5.3: "Every catch must log or handle."
 */
describe("Empty catch blocks audit", () => {
  const SRC_DIR = path.resolve("src");
  const EMPTY_CATCH_RE = /catch\s*\([^)]*\)\s*\{\s*\}/g;

  function findEmptyCatches(dir: string): { file: string; count: number }[] {
    const results: { file: string; count: number }[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") {
        results.push(...findEmptyCatches(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const matches = content.match(EMPTY_CATCH_RE);
        if (matches && matches.length > 0) {
          results.push({ file: fullPath.replace(SRC_DIR + "/", ""), count: matches.length });
        }
      }
    }
    return results;
  }

  it("should have zero empty catch blocks in src/", () => {
    const violations = findEmptyCatches(SRC_DIR);
    if (violations.length > 0) {
      console.warn("Files with empty catches:", violations);
    }
    // Only log.ts infra files are exempt (would cause recursion)
    const total = violations.reduce((sum, v) => sum + v.count, 0);
    const exemptFiles = ["lib/log.ts", "lib/log/remoteSink.ts"];
    const nonExempt = violations.filter(v => !exemptFiles.some(e => v.file.endsWith(e)));
    const nonExemptTotal = nonExempt.reduce((sum, v) => sum + v.count, 0);
    expect(nonExemptTotal).toBe(0);
  });
});
