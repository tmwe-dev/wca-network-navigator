import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { installGlobalErrorCatchers } from "@/lib/errorCatchers";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  },
}));

describe("installGlobalErrorCatchers", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
  });

  afterEach(() => {
    addSpy.mockRestore();
  });

  it("registers unhandledrejection listener", () => {
    installGlobalErrorCatchers();
    expect(addSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("registers error listener", () => {
    installGlobalErrorCatchers();
    expect(addSpy).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("registers both listeners in a single call", () => {
    installGlobalErrorCatchers();
    const calls = addSpy.mock.calls.filter(
      ([e]) => e === "unhandledrejection" || e === "error"
    );
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("handlers are functions", () => {
    installGlobalErrorCatchers();
    const handler = addSpy.mock.calls.find(([e]) => e === "error")?.[1];
    expect(typeof handler).toBe("function");
  });
});
