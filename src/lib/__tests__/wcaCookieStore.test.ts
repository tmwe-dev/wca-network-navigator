import { describe, it, expect, beforeEach } from "vitest";
import { setWcaCookie, getWcaCookie, clearWcaCookie } from "@/lib/wcaCookieStore";

vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("wcaCookieStore", () => {
  beforeEach(() => {
    clearWcaCookie();
    localStorage.clear();
  });

  it("setWcaCookie stores and getWcaCookie retrieves", () => {
    setWcaCookie("session=abc123");
    expect(getWcaCookie()).toBe("session=abc123");
  });

  it("getWcaCookie returns null when no cookie stored", () => {
    expect(getWcaCookie()).toBeNull();
  });

  it("clearWcaCookie removes the cookie", () => {
    setWcaCookie("session=xyz");
    expect(getWcaCookie()).toBe("session=xyz");
    clearWcaCookie();
    expect(getWcaCookie()).toBeNull();
  });

  it("cookie persists in localStorage as fallback", () => {
    setWcaCookie("session=persist");
    const stored = localStorage.getItem("wca_session_cookie");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.cookie).toBe("session=persist");
  });
});
