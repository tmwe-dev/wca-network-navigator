import { describe, it, expect } from "vitest";
import { toRecord, toRecordOrNull, toRecords, windowRecord } from "../records";

describe("records — narrowing runtime", () => {
  it("toRecord accetta oggetti semplici", () => {
    expect(toRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it.each([null, undefined, 0, "", "str", true, [1, 2], new Date(), new Map(), new Set()])(
    "toRecord scarta %p",
    (input) => {
      expect(toRecord(input)).toEqual({});
    },
  );

  it("toRecord non clona: preserva l'identità dell'oggetto", () => {
    const src = { a: 1 };
    expect(toRecord(src)).toBe(src);
  });

  it("toRecordOrNull distingue assenza da oggetto vuoto", () => {
    expect(toRecordOrNull(null)).toBeNull();
    expect(toRecordOrNull(undefined)).toBeNull();
    expect(toRecordOrNull([])).toBeNull();
    expect(toRecordOrNull(new Date())).toBeNull();
    expect(toRecordOrNull({})).toEqual({});
  });

  it("toRecords scarta gli elementi non-record (fail closed)", () => {
    expect(toRecords([{ a: 1 }, null, 3, [4], new Date(), { b: 2 }])).toEqual([
      { a: 1 },
      { b: 2 },
    ]);
  });

  it("toRecords ritorna [] per input non-array", () => {
    expect(toRecords({ a: 1 })).toEqual([]);
    expect(toRecords(null)).toEqual([]);
  });

  it("windowRecord espone window come record nel DOM env", () => {
    const w = windowRecord();
    expect(typeof w).toBe("object");
  });
});
