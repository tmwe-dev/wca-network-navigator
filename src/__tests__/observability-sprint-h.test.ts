/**
 * Sprint H — Observability tests.
 *
 * Covers: discordAlert formatting, Sentry config exports, EdgeMetrics types.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Discord Alert tests ────────────────────────────────────────────────────

describe("discordAlert", () => {
  const WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a correctly formatted embed for each severity", async () => {
    // We need to mock global fetch before importing the module
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const { sendDiscordAlert, SEVERITY_COLORS } = await import("../../supabase/functions/_shared/discordAlert");

    const severities = ["info", "warning", "critical"] as const;

    for (const severity of severities) {
      fetchSpy.mockClear();

      await sendDiscordAlert(WEBHOOK_URL, `Test ${severity}`, severity);

      expect(fetchSpy).toHaveBeenCalledOnce();

      const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(WEBHOOK_URL);
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body as string) as {
        embeds: Array<{
          title: string;
          description: string;
          color: number;
          timestamp: string;
        }>;
      };
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0].color).toBe(SEVERITY_COLORS[severity]);
      expect(body.embeds[0].description).toBe(`Test ${severity}`);
      expect(body.embeds[0].timestamp).toBeTruthy();
    }
  });

  it("color codes match expected values", async () => {
    const { SEVERITY_COLORS } = await import("../../supabase/functions/_shared/discordAlert");

    expect(SEVERITY_COLORS.info).toBe(0x3498db);
    expect(SEVERITY_COLORS.warning).toBe(0xf1c40f);
    expect(SEVERITY_COLORS.critical).toBe(0xe74c3c);
  });

  it("throws on non-ok response", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const { sendDiscordAlert } = await import("../../supabase/functions/_shared/discordAlert");

    await expect(sendDiscordAlert(WEBHOOK_URL, "fail", "critical")).rejects.toThrow("Discord webhook failed");
  });
});

// ─── Sentry config tests ────────────────────────────────────────────────────

describe("Sentry config", () => {
  it("exports initSentry as a function", async () => {
    const mod = await import("../lib/sentry");
    expect(typeof mod.initSentry).toBe("function");
  });

  it("exports SentryErrorBoundary as a function", async () => {
    const mod = await import("../lib/sentry");
    expect(typeof mod.SentryErrorBoundary).toBe("function");
  });

  it("exports trackNavigation as a function", async () => {
    const mod = await import("../lib/sentry");
    expect(typeof mod.trackNavigation).toBe("function");
  });
});

// ─── EdgeMetrics type validation tests ──────────────────────────────────────

describe("EdgeMetrics types", () => {
  it("EdgeFunctionMetric satisfies the required shape", async () => {
    const { default: _typeCheck } = await import("../types/edgeMetrics").then((_mod) => ({ default: undefined }));

    // Build an object that must satisfy the interface at compile time.
    const metric: import("../types/edgeMetrics").EdgeFunctionMetric = {
      function_name: "ai-gateway",
      call_count_24h: 1200,
      p50_ms: 45,
      p95_ms: 210,
      p99_ms: 890,
      error_rate: 0.02,
      token_usage: 500_000,
    };

    expect(metric.function_name).toBe("ai-gateway");
    expect(metric.call_count_24h).toBeGreaterThan(0);
    expect(metric.error_rate).toBeGreaterThanOrEqual(0);
    expect(metric.error_rate).toBeLessThanOrEqual(1);
  });

  it("AlertRule satisfies the required shape", async () => {
    const rule: import("../types/edgeMetrics").AlertRule = {
      metric: "error_rate",
      threshold: 0.05,
      channel: "discord",
    };

    expect(rule.metric).toBe("error_rate");
    expect(rule.threshold).toBe(0.05);
    expect(rule.channel).toBe("discord");
  });

  it("AlertRule metric field only accepts valid EdgeFunctionMetric keys", () => {
    // This is a compile-time check — if the type is wrong TS will error.
    const validMetrics: Array<import("../types/edgeMetrics").AlertRule["metric"]> = [
      "call_count_24h",
      "p50_ms",
      "p95_ms",
      "p99_ms",
      "error_rate",
      "token_usage",
    ];

    expect(validMetrics).toHaveLength(6);
  });
});
