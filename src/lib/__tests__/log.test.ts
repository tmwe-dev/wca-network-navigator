import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLogger, logConfig, type LogRecord, type LogSink } from "@/lib/log";

beforeEach(() => {
  logConfig.reset();
  logConfig.setMinLevel("debug");
});

describe("createLogger", () => {
  it("returns object with debug/info/warn/error methods", () => {
    const log = createLogger("test-module");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("emits records to custom sinks", () => {
    const records: LogRecord[] = [];
    const sink: LogSink = (r) => records.push(r);
    logConfig.addSink(sink);

    const log = createLogger("myModule");
    log.info("hello", { key: "value" });

    expect(records).toHaveLength(1);
    expect(records[0].module).toBe("myModule");
    expect(records[0].message).toBe("hello");
    expect(records[0].level).toBe("info");
    expect(records[0].context).toEqual({ key: "value" });
    expect(records[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it("respects minimum level filter", () => {
    logConfig.setMinLevel("warn");
    const records: LogRecord[] = [];
    logConfig.addSink((r) => records.push(r));

    const log = createLogger("filtered");
    log.debug("should be skipped");
    log.info("should be skipped too");
    log.warn("should appear");
    log.error("should also appear");

    // Only warn and error should have been emitted to custom sink
    // (console sink also receives them but we check custom sink records)
    expect(records.filter((r) => r.module === "filtered")).toHaveLength(2);
  });

  it("handles context with nested objects", () => {
    const records: LogRecord[] = [];
    logConfig.addSink((r) => records.push(r));

    const log = createLogger("nested");
    log.error("deep", { a: { b: { c: 42 } } });

    expect(records[0].context).toEqual({ a: { b: { c: 42 } } });
  });

  it("handles undefined context gracefully", () => {
    const records: LogRecord[] = [];
    logConfig.addSink((r) => records.push(r));

    const log = createLogger("noCtx");
    log.info("no context");

    expect(records[0].context).toBeUndefined();
  });
});

describe("logConfig", () => {
  it("getMinLevel returns current level", () => {
    logConfig.setMinLevel("error");
    expect(logConfig.getMinLevel()).toBe("error");
  });

  it("reset restores default state", () => {
    logConfig.setMinLevel("error");
    logConfig.addSink(() => {});
    logConfig.reset();
    // After reset, min level should be back to default
    expect(logConfig.getMinLevel()).toMatch(/debug|warn/);
  });

  it("sink errors do not propagate", () => {
    logConfig.addSink(() => { throw new Error("broken sink"); });
    const log = createLogger("safe");
    // Should not throw
    expect(() => log.error("test")).not.toThrow();
  });
});
