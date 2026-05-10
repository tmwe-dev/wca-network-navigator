/**
 * Governance: invio LinkedIn/WhatsApp deve passare dai SSOT.
 *
 *  - Nessun call site fuori da src/lib/messaging/* o dai bridge stessi
 *    deve invocare bulk → ai_pending_actions inline.
 *  - useBulkLinkedInDispatch deve usare queueLinkedInForApproval.
 *  - Esiste un wrapper "Direct" e uno "Queue" per ciascun canale.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("messaging SSOT governance", () => {
  it("expone i 4 entry-point del modulo", async () => {
    const linkedinSender = await import("@/lib/messaging/linkedinSender");
    const whatsappSender = await import("@/lib/messaging/whatsappSender");
    expect(typeof linkedinSender.sendLinkedInDirect).toBe("function");
    expect(typeof linkedinSender.queueLinkedInForApproval).toBe("function");
    expect(typeof whatsappSender.sendWhatsAppDirect).toBe("function");
    expect(typeof whatsappSender.queueWhatsAppForApproval).toBe("function");
  });

  it("useBulkLinkedInDispatch usa queueLinkedInForApproval e non più supabase.from('ai_pending_actions') inline", () => {
    const src = readFileSync("src/hooks/useBulkLinkedInDispatch.ts", "utf-8");
    expect(src).toContain("queueLinkedInForApproval");
    expect(src).not.toMatch(/supabase\.from\(["']ai_pending_actions["']\)/);
  });

  it("nessun file applicativo (escluso messaging/inbox/test) inserisce direttamente ai_pending_actions con send_linkedin/send_whatsapp", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      if (file.includes("/lib/messaging/")) continue;
      if (file.includes("/lib/inbox/")) continue;
      if (file.includes("/test/")) continue;
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const txt = readFileSync(file, "utf-8");
      const insertsPending = /\.from\(["']ai_pending_actions["']\)\s*\.insert/.test(txt);
      const refsSendChannel = /action_type:\s*["']send_(linkedin|whatsapp)["']/.test(txt);
      if (insertsPending && refsSendChannel) offenders.push(file);
    }
    expect(offenders, `Devono passare da queue*ForApproval: ${offenders.join(", ")}`).toEqual([]);
  });
});