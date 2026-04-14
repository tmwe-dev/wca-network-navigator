import { describe, it, expect } from "vitest";
import { validateResponse, outreachSchema } from "@/lib/api/responseValidator";
import { isApiError } from "@/lib/api/apiError";

describe("responseValidator", () => {
  const schema = {
    required: { name: "string" as const, age: "number" as const },
    optional: { tags: "array" as const },
  };

  it("passes valid data and returns it typed", () => {
    const data = { name: "Alice", age: 30 };
    const result = validateResponse<{ name: string; age: number }>(data, schema);
    expect(result).toEqual(data);
  });

  it("allows null values for required fields", () => {
    const data = { name: null, age: 25 };
    expect(() => validateResponse(data, schema)).not.toThrow();
  });

  it("rejects missing required fields", () => {
    try {
      validateResponse({ name: "Bob" }, schema);
      throw new Error("should have thrown");
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      expect((e as any).code).toBe("SCHEMA_MISMATCH");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      expect((e as any).message).toContain("age");
    }
  });

  it("rejects wrong type on required field", () => {
    try {
      validateResponse({ name: "Bob", age: "thirty" }, schema);
      throw new Error("should have thrown");
    } catch (e) {
      expect(isApiError(e)).toBe(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      expect((e as any).message).toContain("age");
    }
  });

  it("rejects wrong type on optional field", () => {
    try {
      validateResponse({ name: "Bob", age: 30, tags: "not-array" }, schema);
      throw new Error("should have thrown");
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
      expect((e as any).message).toContain("tags");
    }
  });

  it("rejects non-object responses", () => {
    expect(() => validateResponse(null, schema)).toThrow();
    expect(() => validateResponse("string", schema)).toThrow();
    expect(() => validateResponse([1, 2], schema)).toThrow();
  });

  it("validates outreachSchema with valid data", () => {
    const data = { channel: "email", body: "Hello", language: "it", subject: "Test" };
    expect(() => validateResponse(data, outreachSchema)).not.toThrow();
  });
});
