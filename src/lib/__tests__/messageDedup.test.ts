import { describe, it, expect } from "vitest";
import { buildDeterministicId } from "@/lib/messageDedup";

describe("messageDedup", () => {
  it("produces same ID for same input", () => {
    const a = buildDeterministicId("wa", "John", "Hello world", "2024-01-01");
    const b = buildDeterministicId("wa", "John", "Hello world", "2024-01-01");
    expect(a).toBe(b);
  });

  it("produces different IDs for different text", () => {
    const a = buildDeterministicId("wa", "John", "Hello", "2024-01-01");
    const b = buildDeterministicId("wa", "John", "Goodbye", "2024-01-01");
    expect(a).not.toBe(b);
  });

  it("produces different IDs for different contacts", () => {
    const a = buildDeterministicId("wa", "Alice", "Hello", "2024-01-01");
    const b = buildDeterministicId("wa", "Bob", "Hello", "2024-01-01");
    expect(a).not.toBe(b);
  });

  it("handles missing timestamp", () => {
    const id = buildDeterministicId("wa", "John", "Hello");
    expect(id).toMatch(/^wa_/);
  });

  it("normalizes whitespace", () => {
    const a = buildDeterministicId("wa", "John", "Hello   world");
    const b = buildDeterministicId("wa", "John", "Hello world");
    expect(a).toBe(b);
  });

  it("is case-insensitive", () => {
    const a = buildDeterministicId("wa", "John", "HELLO");
    const b = buildDeterministicId("wa", "John", "hello");
    expect(a).toBe(b);
  });
});
