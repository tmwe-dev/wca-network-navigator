import { describe, it, expect, vi } from "vitest";
import { lazyRetry } from "@/lib/lazyRetry";
describe("lazyRetry", () => {
  it("returns component on success", async () => {
    const comp = { default: () => null };
    const loader = vi.fn().mockResolvedValue(comp);
    const result = await lazyRetry(loader);
    expect(result).toBe(comp);
  });
  it("retries on failure then succeeds", async () => {
    const comp = { default: () => null };
    const loader = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValueOnce(comp);
    const result = await lazyRetry(loader);
    expect(result).toBe(comp);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
