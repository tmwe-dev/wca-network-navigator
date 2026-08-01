import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z, safeParseAiJson, safeParseToolArgs } from "./aiJsonValidator.ts";

const Schema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).optional(),
});

type Out = z.infer<typeof Schema>;
const FALLBACK: Out = { category: "uncategorized", confidence: 0.1 };

const baseOpts = { fnName: "test-fn", model: "test-model", fallback: FALLBACK };

Deno.test("safeParseAiJson: parses valid JSON", () => {
  const r = safeParseAiJson(
    '{"category":"interested","confidence":0.8,"tags":["a","b"]}',
    Schema,
    baseOpts,
  );
  assertEquals(r.isFallback, false);
  assertEquals(r.data.category, "interested");
  assertEquals(r.data.confidence, 0.8);
});

Deno.test("safeParseAiJson: strips markdown fences", () => {
  const raw = "```json\n{\"category\":\"meeting_request\",\"confidence\":0.9}\n```";
  const r = safeParseAiJson(raw, Schema, baseOpts);
  assertEquals(r.isFallback, false);
  assertEquals(r.data.category, "meeting_request");
});

Deno.test("safeParseAiJson: extracts JSON block from prose", () => {
  const raw = "Sure! Here is the result: {\"category\":\"spam\",\"confidence\":0.5} hope it helps.";
  const r = safeParseAiJson(raw, Schema, baseOpts);
  assertEquals(r.isFallback, false);
  assertEquals(r.data.category, "spam");
});

Deno.test("safeParseAiJson: fallback on malformed JSON", () => {
  const r = safeParseAiJson("not json at all {{{", Schema, baseOpts);
  assertEquals(r.isFallback, true);
  assertEquals(r.data, FALLBACK);
  assert(r.error?.startsWith("parse_error"));
});

Deno.test("safeParseAiJson: fallback on schema mismatch", () => {
  const r = safeParseAiJson('{"category":123,"confidence":"high"}', Schema, baseOpts);
  assertEquals(r.isFallback, true);
  assertEquals(r.data, FALLBACK);
  assert(r.error?.startsWith("schema_error"));
});

Deno.test("safeParseAiJson: fallback on empty input", () => {
  const r = safeParseAiJson("", Schema, baseOpts);
  assertEquals(r.isFallback, true);
  assertEquals(r.error, "empty_response");
});

Deno.test("safeParseAiJson: fallback on null input", () => {
  const r = safeParseAiJson(null, Schema, baseOpts);
  assertEquals(r.isFallback, true);
});

Deno.test("safeParseAiJson: fallback on out-of-range number", () => {
  const r = safeParseAiJson('{"category":"x","confidence":2.5}', Schema, baseOpts);
  assertEquals(r.isFallback, true);
  assert(r.error?.includes("schema_error"));
});

Deno.test("safeParseToolArgs: parses tool call arguments", () => {
  const r = safeParseToolArgs('{"category":"x","confidence":0.4}', Schema, baseOpts);
  assertEquals(r.isFallback, false);
  assertEquals(r.data.category, "x");
});

Deno.test("safeParseToolArgs: fallback on malformed args", () => {
  const r = safeParseToolArgs("{not json", Schema, baseOpts);
  assertEquals(r.isFallback, true);
});

Deno.test("safeParseAiJson: array schema works", () => {
  const ArrSchema = z.array(z.object({ id: z.string() }));
  const r = safeParseAiJson('[{"id":"a"},{"id":"b"}]', ArrSchema, {
    fnName: "test", model: "test", fallback: [],
  });
  assertEquals(r.isFallback, false);
  assertEquals(r.data.length, 2);
});