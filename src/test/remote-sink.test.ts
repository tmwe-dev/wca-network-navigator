/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
/**
 * remoteSink — Vol. II §11.4 + ADR-0003.
 * Verifica installazione env-gated, filtro per livello, flush per dimensione.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logConfig, createLogger } from "@/lib/log";
import {
  installRemoteSink,
  __getInstalledSinkState,
  __resetInstalledSinkState,
} from "@/lib/log/remoteSink";

describe("remoteSink", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetInstalledSinkState();
    logConfig.reset();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    __resetInstalledSinkState();
    logConfig.reset();
  });

  it("è no-op senza endpoint (env-gated)", () => {
    const state = installRemoteSink({});
    expect(state.enabled).toBe(false);
  });

  it("si installa quando viene fornito un endpoint", () => {
    const state = installRemoteSink({ endpoint: "https://logs.example.com/ingest" });
    expect(state.enabled).toBe(true);
    expect(state.endpoint).toBe("https://logs.example.com/ingest");
  });

  it("è idempotente: doppia install non duplica i sink", () => {
    installRemoteSink({ endpoint: "https://a.example.com" });
    installRemoteSink({ endpoint: "https://b.example.com" });
    const state = __getInstalledSinkState();
    expect(state.endpoint).toBe("https://a.example.com");
  });

  it("ignora i livelli sotto warn (default)", () => {
    installRemoteSink({ endpoint: "https://x.example.com", flushAt: 1 });
    const log = createLogger("test");
    log.debug("hidden");
    log.info("hidden");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flush automatico al raggiungere flushAt con warn/error", () => {
    installRemoteSink({ endpoint: "https://x.example.com", flushAt: 2 });
    const log = createLogger("test");
    log.warn("first");
    expect(fetchMock).not.toHaveBeenCalled();
    log.error("second");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.example.com");
    expect((opts as any).method).toBe("POST");
    const body = JSON.parse((opts as any).body);
    expect(body.records).toHaveLength(2);
    expect(body.records[0].level).toBe("warn");
    expect(body.records[1].level).toBe("error");
  });

  it("aggiunge Authorization se token presente", () => {
    installRemoteSink({ endpoint: "https://x.example.com", token: "secret123", flushAt: 1 });
    createLogger("test").error("boom");
    const [, opts] = fetchMock.mock.calls[0];
    expect((opts as any).headers.Authorization).toBe("Bearer secret123");
  });

  it("rispetta il livello custom (error only)", () => {
    installRemoteSink({ endpoint: "https://x.example.com", minLevel: "error", flushAt: 1 });
    const log = createLogger("test");
    log.warn("ignored");
    expect(fetchMock).not.toHaveBeenCalled();
    log.error("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("non solleva eccezione se fetch fallisce (sink resiliente)", () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    installRemoteSink({ endpoint: "https://x.example.com", flushAt: 1 });
    expect(() => createLogger("test").error("boom")).not.toThrow();
  });
});
