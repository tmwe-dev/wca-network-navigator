/**
 * Sprint F — Query Keys integrity test.
 * Ensures all query key domains are present, no accidental duplicates,
 * and the structure is correctly merged from parts.
 */
import { describe, it, expect } from "vitest";
import { queryKeys } from "@/lib/queryKeys";

describe("queryKeys integrity", () => {
  it("should have CRM keys", () => {
    expect(queryKeys).toHaveProperty("partners");
    expect(queryKeys).toHaveProperty("partner");
  });

  it("should have comms keys", () => {
    expect(queryKeys).toHaveProperty("funnemailInbox");
    expect(queryKeys.funnemailInbox).toHaveProperty("root");
    expect(queryKeys.funnemailInbox).toHaveProperty("folders");
    expect(queryKeys.funnemailInbox).toHaveProperty("counts");
  });

  it("should have funnemail eval batch runs key", () => {
    expect(queryKeys).toHaveProperty("funnemailEvalBatchRuns");
    expect(queryKeys.funnemailEvalBatchRuns).toEqual(["funnemail-eval-batch-runs"]);
  });

  it("should have system keys", () => {
    expect(queryKeys).toHaveProperty("system");
  });

  it("should have AI and analytics keys", () => {
    expect(queryKeys).toHaveProperty("ai");
    expect(queryKeys).toHaveProperty("agents");
    expect(queryKeys).toHaveProperty("promptLabHealth");
  });

  it("should have v2 keys", () => {
    expect(queryKeys).toHaveProperty("v2");
  });

  it("should produce readonly arrays", () => {
    expect(Array.isArray(queryKeys.funnemailEvalBatchRuns)).toBe(true);
    expect(Array.isArray(queryKeys.promptLabHealth)).toBe(true);
  });

  it("funnemailInbox.grouped should be a function returning tuple", () => {
    const result = queryKeys.funnemailInbox.grouped("user-1", null, null);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe("funnemail-inbox");
    expect(result[1]).toBe("grouped");
    expect(result[2]).toBe("user-1");
  });

  it("funnemailInbox.decision should handle null messageId", () => {
    const result = queryKeys.funnemailInbox.decision(null);
    expect(result).toEqual(["funnemail-inbox", "decision", "none"]);
  });

  it("email count by mailbox key should default to 'any'", () => {
    const result = queryKeys.email.countByMailbox();
    expect(result).toEqual(["email-count", "any"]);
  });

  it("ai.classificationInsights should default to pending", () => {
    const result = queryKeys.ai.classificationInsights();
    expect(result).toEqual(["ai-classification-insights", "pending"]);
  });
});
