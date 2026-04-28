import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkSmtpRateLimit, DEFAULT_CAP_PER_HOUR } from "./smtpRateLimit.ts";

Deno.env.delete("AI_USAGE_LIMITS_ENABLED");

Deno.test("checkSmtpRateLimit: kill-switch OFF → always allowed", async () => {
  const fakeClient = {
    from() {
      throw new Error("should not be called when kill-switch is off");
    },
  } as unknown as Parameters<typeof checkSmtpRateLimit>[0];

  const res = await checkSmtpRateLimit(fakeClient, "user-1");
  assertEquals(res.allowed, true);
  assertEquals(res.remaining, Number.POSITIVE_INFINITY);
  assertEquals(res.sentLastHour, 0);
});

Deno.test("checkSmtpRateLimit: kill-switch ON, under cap → allowed", async () => {
  Deno.env.set("AI_USAGE_LIMITS_ENABLED", "true");
  const fakeClient = {
    from(table: string) {
      if (table === "app_settings") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          }),
        };
      }
      if (table === "email_send_log") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({ count: 10, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as Parameters<typeof checkSmtpRateLimit>[0];

  const res = await checkSmtpRateLimit(fakeClient, "user-1");
  assertEquals(res.allowed, true);
  assertEquals(res.cap, DEFAULT_CAP_PER_HOUR);
  assertEquals(res.sentLastHour, 10);
  assertEquals(res.remaining, DEFAULT_CAP_PER_HOUR - 10);
  Deno.env.delete("AI_USAGE_LIMITS_ENABLED");
});

Deno.test("checkSmtpRateLimit: kill-switch ON, at cap → blocked", async () => {
  Deno.env.set("AI_USAGE_LIMITS_ENABLED", "true");
  const fakeClient = {
    from(table: string) {
      if (table === "app_settings") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: { value: "20" } }) }),
            }),
          }),
        };
      }
      if (table === "email_send_log") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: async () => ({ count: 20, error: null }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as Parameters<typeof checkSmtpRateLimit>[0];

  const res = await checkSmtpRateLimit(fakeClient, "user-1");
  assertEquals(res.allowed, false);
  assertEquals(res.cap, 20);
  assertEquals(res.sentLastHour, 20);
  assertEquals(res.remaining, 0);
  Deno.env.delete("AI_USAGE_LIMITS_ENABLED");
});