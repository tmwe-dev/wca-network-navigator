import { describe, it, expect } from "vitest";
import { normalizeExtensionResult } from "./extractProfile";

describe("normalizeExtensionResult", () => {
  it("returns bridge_error for null input", () => {
    const result = normalizeExtensionResult(null);
    expect(result.success).toBe(false);
    expect(result.state).toBe("bridge_error");
    expect(result.errorCode).toBe("EXT_BRIDGE_ERROR");
    expect(result.contacts).toEqual([]);
    expect(result.profile).toEqual({});
  });

  it("returns bridge_error for undefined input", () => {
    const result = normalizeExtensionResult(undefined);
    expect(result.success).toBe(false);
    expect(result.state).toBe("bridge_error");
  });

  it("normalizes a successful response", () => {
    const raw = {
      success: true,
      wcaId: 12345,
      state: "ok",
      companyName: "Test Corp",
      contacts: [{ name: "John", email: "john@test.com" }],
      profile: { city: "Rome" },
      profileHtml: "<div>profile</div>",
    };
    const result = normalizeExtensionResult(raw);
    expect(result.success).toBe(true);
    expect(result.state).toBe("ok");
    expect(result.wcaId).toBe(12345);
    expect(result.companyName).toBe("Test Corp");
    expect(result.contacts).toHaveLength(1);
    expect(result.htmlLength).toBe(raw.profileHtml.length);
  });

  it("defaults missing fields to safe values", () => {
    const raw = { success: false };
    const result = normalizeExtensionResult(raw);
    expect(result.success).toBe(false);
    expect(result.state).toBe("not_loaded");
    expect(result.companyName).toBeNull();
    expect(result.contacts).toEqual([]);
    expect(result.profile).toEqual({});
    expect(result.profileHtml).toBeNull();
    expect(result.htmlLength).toBe(0);
    expect(result.error).toBeNull();
    expect(result.debug).toEqual({});
  });

  it("infers state 'ok' when success is true and state is missing", () => {
    const raw = { success: true };
    const result = normalizeExtensionResult(raw);
    expect(result.state).toBe("ok");
  });

  it("computes htmlLength from profileHtml when not provided", () => {
    const raw = { success: true, profileHtml: "<p>hello</p>" };
    const result = normalizeExtensionResult(raw);
    expect(result.htmlLength).toBe("<p>hello</p>".length);
  });

  it("preserves error and debug fields", () => {
    const raw = {
      success: false,
      state: "extraction_error",
      error: "Timeout",
      debug: { attempt: 3 },
    };
    const result = normalizeExtensionResult(raw);
    expect(result.error).toBe("Timeout");
    expect(result.debug).toEqual({ attempt: 3 });
  });
});
