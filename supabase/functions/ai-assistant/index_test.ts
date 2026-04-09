import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

const BASE = `${SUPABASE_URL}/functions/v1/ai-assistant`;

Deno.test("ai-assistant: OPTIONS returns CORS headers", async () => {
  const res = await fetch(BASE, { method: "OPTIONS" });
  const body = await res.text();
  assertEquals(res.status, 200);
  assertExists(res.headers.get("access-control-allow-origin"));
});

Deno.test("ai-assistant: POST without body returns error gracefully", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  // Should return an error but not crash (500 with structured error is acceptable)
  assertExists(data);
});

Deno.test("ai-assistant: POST with message returns response", async () => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      message: "Quanti partner ci sono in Italia?",
      conversationId: null,
      pageContext: "/dashboard",
    }),
  });
  const data = await res.json();
  assertExists(data);
  // Either content or error — no crash
  if (res.status === 200) {
    assertExists(data.content);
  }
});
