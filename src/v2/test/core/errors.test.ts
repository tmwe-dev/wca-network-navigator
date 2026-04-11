/**
 * Tests: Error factory
 */
import { describe, it, expect } from "vitest";
import { domainError, ioError, infraError, isAppError, fromUnknown } from "../../core/domain/errors";

describe("Error factory", () => {
  it("domainError creates correct category", () => {
    const e = domainError("VALIDATION_FAILED", "bad field", { field: "email" });
    expect(e.category).toBe("domain");
    expect(e.code).toBe("VALIDATION_FAILED");
    expect(e.message).toBe("bad field");
    expect(e.context?.field).toBe("email");
    expect(e.recoveryStrategy).toBe("escalate");
    expect(e.timestamp).toBeTruthy();
  });

  it("domainError ENTITY_NOT_FOUND → fallback", () => {
    const e = domainError("ENTITY_NOT_FOUND", "not found");
    expect(e.recoveryStrategy).toBe("fallback");
  });

  it("ioError NETWORK_ERROR → retry", () => {
    const e = ioError("NETWORK_ERROR", "fetch failed");
    expect(e.category).toBe("io");
    expect(e.recoveryStrategy).toBe("retry");
  });

  it("ioError UNAUTHENTICATED → escalate", () => {
    const e = ioError("UNAUTHENTICATED", "session expired");
    expect(e.recoveryStrategy).toBe("escalate");
  });

  it("infraError CIRCUIT_OPEN → fallback", () => {
    const e = infraError("CIRCUIT_OPEN", "circuit open");
    expect(e.category).toBe("infra");
    expect(e.recoveryStrategy).toBe("fallback");
  });

  it("infraError FEATURE_DISABLED → ignore", () => {
    const e = infraError("FEATURE_DISABLED", "not enabled");
    expect(e.recoveryStrategy).toBe("ignore");
  });

  it("isAppError returns true for AppError", () => {
    expect(isAppError(domainError("VALIDATION_FAILED", "test"))).toBe(true);
  });

  it("isAppError returns false for plain object", () => {
    expect(isAppError({ message: "not an error" })).toBe(false);
  });

  it("fromUnknown converts Error", () => {
    const e = fromUnknown(new Error("native error"));
    expect(e.message).toBe("native error");
    expect(isAppError(e)).toBe(true);
  });

  it("fromUnknown converts string", () => {
    const e = fromUnknown("string error");
    expect(e.message).toBe("string error");
  });

  it("fromUnknown passes through AppError", () => {
    const original = ioError("TIMEOUT", "timeout");
    const converted = fromUnknown(original);
    expect(converted).toBe(original);
  });

  it("errors are frozen (immutable)", () => {
    const e = domainError("VALIDATION_FAILED", "test");
    expect(Object.isFrozen(e)).toBe(true);
  });
});
