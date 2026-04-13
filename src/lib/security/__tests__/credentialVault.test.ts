import { describe, it, expect } from "vitest";
import { isVaulted, vaultVersion } from "@/lib/security/credentialVault";

describe("credentialVault", () => {
  it("isVaulted returns true for v1: prefixed strings", () => {
    expect(isVaulted("v1:abc123")).toBe(true);
  });

  it("isVaulted returns false for plain strings", () => {
    expect(isVaulted("plaintext")).toBe(false);
  });

  it("isVaulted returns false for empty string", () => {
    expect(isVaulted("")).toBe(false);
  });

  it("vaultVersion returns current version", () => {
    expect(vaultVersion()).toBe("v1");
  });
});
