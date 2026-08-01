import { describe, it, expect } from "vitest";
import { isViewSchemaError } from "@/data/_shared/viewFallbackPredicate";

describe("isViewSchemaError", () => {
  it("returns false for null/undefined", () => {
    expect(isViewSchemaError(null)).toBe(false);
    expect(isViewSchemaError(undefined)).toBe(false);
  });

  it("returns true for PG undefined_table (42P01)", () => {
    expect(isViewSchemaError({ code: "42P01", message: "relation x does not exist" })).toBe(true);
  });

  it("returns true for PG undefined_column (42703)", () => {
    expect(isViewSchemaError({ code: "42703", message: "column foo does not exist" })).toBe(true);
  });

  it("returns true for PostgREST schema cache codes", () => {
    for (const code of ["PGRST200", "PGRST202", "PGRST204", "PGRST205"]) {
      expect(isViewSchemaError({ code, message: "schema cache miss" })).toBe(true);
    }
  });

  it("returns true when code missing but message says 'does not exist'", () => {
    expect(isViewSchemaError({ message: "relation message_intelligence_v does not exist" })).toBe(true);
  });

  it("returns false for RLS/permission (42501)", () => {
    expect(isViewSchemaError({ code: "42501", message: "permission denied for table" })).toBe(false);
  });

  it("returns false for JWT expired (PGRST301)", () => {
    expect(isViewSchemaError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
  });

  it("returns false for network / fetch failures", () => {
    expect(isViewSchemaError({ message: "fetch failed" })).toBe(false);
    expect(isViewSchemaError({ message: "network error" })).toBe(false);
    expect(isViewSchemaError({ message: "request timeout" })).toBe(false);
  });

  it("returns false for generic errors without schema signal", () => {
    expect(isViewSchemaError({ message: "boom" })).toBe(false);
    expect(isViewSchemaError({ code: "XX000", message: "internal" })).toBe(false);
  });

  it("refuses to fall back on permission message even with weird code", () => {
    expect(isViewSchemaError({ code: "", message: "permission denied" })).toBe(false);
  });
});
