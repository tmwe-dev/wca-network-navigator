import { describe, it, expect } from "vitest";
import { buildDeterministicId } from "@/lib/messageDedup";

describe("buildDeterministicId", () => {
  it("produces consistent IDs for same input", () => {
    const id1 = buildDeterministicId("wa", "John Doe", "Hello!", "2024-01-01");
    const id2 = buildDeterministicId("wa", "John Doe", "Hello!", "2024-01-01");
    expect(id1).toBe(id2);
  });

  it("produces different IDs for different text", () => {
    const id1 = buildDeterministicId("wa", "John", "Hello");
    const id2 = buildDeterministicId("wa", "John", "Goodbye");
    expect(id1).not.toBe(id2);
  });

  it("includes prefix", () => {
    const id = buildDeterministicId("li_out", "Jane", "Test");
    expect(id.startsWith("li_out_")).toBe(true);
  });

  it("handles empty strings", () => {
    const id = buildDeterministicId("wa", "", "");
    expect(id).toMatch(/^wa_/);
  });

  it("normalizes whitespace", () => {
    const id1 = buildDeterministicId("wa", "  John  Doe  ", " Hello   world ");
    const id2 = buildDeterministicId("wa", "John Doe", "Hello world");
    expect(id1).toBe(id2);
  });

  it("handles Unicode (Thai, Arabic, CJK)", () => {
    const id = buildDeterministicId("wa", "สวัสดี", "مرحبا");
    expect(id).toBeTruthy();
    expect(id.startsWith("wa_")).toBe(true);
  });
});
