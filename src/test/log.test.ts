import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger, logConfig, type LogRecord } from "@/lib/log";

describe("structured logger", () => {
  afterEach(() => {
    logConfig.reset();
  });

  it("emits a structured record with timestamp, level, module, message", () => {
    const records: LogRecord[] = [];
    logConfig.reset();
    // silence console sink by replacing it
    logConfig.addSink((r) => records.push(r));

    const log = createLogger("TestModule");
    log.warn("hello", { foo: 1 });

    // records include both the default console sink call (noop side effect)
    // and our test sink; we only assert what we observe.
    const last = records[records.length - 1];
    expect(last.level).toBe("warn");
    expect(last.module).toBe("TestModule");
    expect(last.message).toBe("hello");
    expect(last.context).toEqual({ foo: 1 });
    expect(typeof last.timestamp).toBe("string");
    expect(() => new Date(last.timestamp)).not.toThrow();
  });

  it("filters out records below the minimum level", () => {
    const records: LogRecord[] = [];
    logConfig.reset();
    logConfig.addSink((r) => records.push(r));
    logConfig.setMinLevel("warn");

    const log = createLogger("Filter");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");

    const levels = records.map((r) => r.level);
    expect(levels).not.toContain("debug");
    expect(levels).not.toContain("info");
    expect(levels).toContain("warn");
    expect(levels).toContain("error");
  });

  it("a failing sink does not break the application", () => {
    logConfig.reset();
    logConfig.addSink(() => {
      throw new Error("boom");
    });

    const log = createLogger("Crashy");
    expect(() => log.error("should not throw")).not.toThrow();
  });

  it("createLogger exposes four level methods", () => {
    const log = createLogger("API");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("logger accepts undefined context without errors", () => {
    logConfig.reset();
    const records: LogRecord[] = [];
    logConfig.addSink((r) => records.push(r));

    const log = createLogger("NoCtx");
    log.info("no context");

    const last = records[records.length - 1];
    expect(last.context).toBeUndefined();
  });

  it("reset restores default min level and removes custom sinks", () => {
    const spy = vi.fn();
    logConfig.addSink(spy);
    logConfig.setMinLevel("error");
    logConfig.reset();

    const log = createLogger("Reset");
    log.warn("after reset");

    // custom sink was removed, so it should never have been called
    expect(spy).not.toHaveBeenCalled();
  });
});
