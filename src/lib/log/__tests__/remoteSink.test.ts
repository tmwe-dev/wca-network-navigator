import { describe, it, expect, vi, beforeEach } from "vitest";
import { installRemoteSink, __getInstalledSinkState, __resetInstalledSinkState } from "@/lib/log/remoteSink";

vi.mock("@/lib/log", async () => {
  const sinks: Array<(r: unknown) => void> = [];
  return {
    logConfig: {
      addSink: (s: (r: unknown) => void) => sinks.push(s),
      _sinks: sinks,
    },
  };
});

beforeEach(() => {
  __resetInstalledSinkState();
  vi.clearAllMocks();
});

describe("installRemoteSink", () => {
  it("is no-op without endpoint", () => {
    const result = installRemoteSink();
    expect(result.enabled).toBe(false);
    expect(result.pendingCount).toBe(0);
  });

  it("activates when endpoint is provided", () => {
    const result = installRemoteSink({ endpoint: "https://logs.example.com" });
    expect(result.enabled).toBe(true);
    expect(result.endpoint).toBe("https://logs.example.com");
  });

  it("is idempotent — second call returns same state", () => {
    const first = installRemoteSink({ endpoint: "https://logs.example.com" });
    const second = installRemoteSink({ endpoint: "https://other.com" });
    expect(second.endpoint).toBe("https://logs.example.com");
  });

  it("__getInstalledSinkState reflects current state", () => {
    expect(__getInstalledSinkState().enabled).toBe(false);
    installRemoteSink({ endpoint: "https://x.com" });
    expect(__getInstalledSinkState().enabled).toBe(true);
  });

  it("__resetInstalledSinkState resets state", () => {
    installRemoteSink({ endpoint: "https://x.com" });
    __resetInstalledSinkState();
    expect(__getInstalledSinkState().enabled).toBe(false);
  });
});
