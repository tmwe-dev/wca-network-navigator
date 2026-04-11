/**
 * Tests: Result monad
 */
import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, map, flatMap, unwrapOr, unwrap, fromPromise } from "../../core/domain/result";
import { domainError } from "../../core/domain/errors";

describe("Result monad", () => {
  it("ok() creates Ok result", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    expect(r._tag).toBe("Ok");
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it("err() creates Err result", () => {
    const e = domainError("VALIDATION_FAILED", "bad input");
    const r = err(e);
    expect(isErr(r)).toBe(true);
    expect(isOk(r)).toBe(false);
    if (isErr(r)) expect(r.error.code).toBe("VALIDATION_FAILED");
  });

  it("map transforms Ok value", () => {
    const r = map(ok(10), (v: number) => v * 2);
    expect(isOk(r) && r.value).toBe(20);
  });

  it("map passes through Err", () => {
    const e = domainError("ENTITY_NOT_FOUND", "not found");
    const r = map(err(e), () => 999);
    expect(isErr(r)).toBe(true);
  });

  it("flatMap chains Ok results", () => {
    const r = flatMap(ok(5), (v: number) => ok(v + 1));
    expect(isOk(r) && r.value).toBe(6);
  });

  it("flatMap short-circuits on Err", () => {
    const e = domainError("VALIDATION_FAILED", "fail");
    const r = flatMap(err(e), () => ok(999));
    expect(isErr(r)).toBe(true);
  });

  it("unwrapOr returns value on Ok", () => {
    expect(unwrapOr(ok("hello"), "default")).toBe("hello");
  });

  it("unwrapOr returns fallback on Err", () => {
    const e = domainError("VALIDATION_FAILED", "fail");
    expect(unwrapOr(err(e), "default")).toBe("default");
  });

  it("unwrap returns value on Ok", () => {
    expect(unwrap(ok(42))).toBe(42);
  });

  it("unwrap throws on Err", () => {
    const e = domainError("VALIDATION_FAILED", "fail");
    expect(() => unwrap(err(e))).toThrow();
  });

  it("fromPromise wraps resolved promise", async () => {
    const r = await fromPromise(Promise.resolve(42), (caught: unknown) => domainError("VALIDATION_FAILED", String(caught)));
    expect(isOk(r) && r.value).toBe(42);
  });

  it("fromPromise wraps rejected promise", async () => {
    const r = await fromPromise(Promise.reject(new Error("boom")), (caught: unknown) =>
      domainError("VALIDATION_FAILED", caught instanceof Error ? caught.message : "unknown"),
    );
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toBe("boom");
  });
});
