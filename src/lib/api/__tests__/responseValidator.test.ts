import { describe, it, expect } from "vitest";
import { validateResponse, type ResponseSchema } from "@/lib/api/responseValidator";
import { ApiError } from "@/lib/api/apiError";

const schema: ResponseSchema = {
  required: { name: "string", count: "number" },
  optional: { tags: "array" },
};

describe("validateResponse", () => {
  it("passes valid response", () => {
    const data = { name: "test", count: 5 };
    expect(validateResponse(data, schema)).toEqual(data);
  });

  it("throws SCHEMA_MISMATCH for null response", () => {
    expect(() => validateResponse(null, schema)).toThrow(ApiError);
  });

  it("throws for missing required field", () => {
    expect(() => validateResponse({ name: "test" }, schema)).toThrow(/mancante/);
  });

  it("throws for wrong type on required field", () => {
    expect(() => validateResponse({ name: 123, count: 5 }, schema)).toThrow(/atteso string/);
  });
});
