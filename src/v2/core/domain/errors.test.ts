import { describe, it, expect } from "vitest";
import { extractErrorMessage, fromUnknown, isAppError, domainError } from "./errors";

describe("extractErrorMessage", () => {
  it("estrae message da Error", () => {
    expect(extractErrorMessage(new Error("boom"))).toBe("boom");
  });
  it("ritorna stringa così com'è", () => {
    expect(extractErrorMessage("plain")).toBe("plain");
  });
  it("estrae message da oggetto error-like", () => {
    expect(extractErrorMessage({ message: "obj" })).toBe("obj");
  });
  it("fa String() sui valori sconosciuti", () => {
    expect(extractErrorMessage(42)).toBe("42");
    expect(extractErrorMessage(null)).toBe("null");
  });
});

describe("fromUnknown", () => {
  it("passa attraverso un AppError esistente", () => {
    const app = domainError("VALIDATION_FAILED", "invalid");
    const result = fromUnknown(app);
    expect(result).toBe(app);
    expect(isAppError(result)).toBe(true);
  });
  it("wrappa un Error nativo con code di default", () => {
    const wrapped = fromUnknown(new Error("db down"));
    expect(wrapped.code).toBe("DATABASE_ERROR");
    expect(wrapped.message).toBe("db down");
    expect(wrapped.category).toBe("io");
  });
  it("wrappa una stringa con code di dominio", () => {
    const wrapped = fromUnknown("upsi", "VALIDATION_FAILED");
    expect(wrapped.category).toBe("domain");
    expect(wrapped.message).toBe("upsi");
  });
  it("classifica CIRCUIT_OPEN come infra", () => {
    const wrapped = fromUnknown(new Error("x"), "CIRCUIT_OPEN");
    expect(wrapped.category).toBe("infra");
  });
});