import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (tailwind merge)", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toContain("px-2");
    expect(cn("px-2", "py-1")).toContain("py-1");
  });

  it("resolves conflicting classes", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toContain("base");
    expect(result).toContain("visible");
    expect(result).not.toContain("hidden");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null", () => {
    expect(cn(undefined, null, "valid")).toBe("valid");
  });
});
