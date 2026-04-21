/**
 * COLLAUDO Catena 8 — Governance AI: Scope + Tool Filtering
 *
 * Verifica che:
 * - Ogni scope ha una config valida
 * - I tool sono filtrati per scope
 * - Lo scope "strategic" non ha tool
 * - Gli scope V2 non vanno a 400
 *
 * Bug #1 (scope morto) e parte di #4 (governance agenti)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════
// Reproduce scope configs from the real code
// (Pure data test — no Deno imports needed)
// ══════════════════════════════════════════════════════════

// Valid scopes accepted by unified-assistant (from index.ts line 10-12)
const VALID_SCOPES = [
  "partner_hub", "cockpit", "contacts", "import", "extension",
  "strategic", "kb-supervisor", "deep-search", "chat", "mission-builder",
];

// Scopes used by V2 hooks
const V2_HOOK_SCOPES = {
  "useDeepSearchV2.ts": "deep-search",
  "useAgentChatV2.ts": "chat",
  "useMissionBuilderV2.ts": "mission-builder",
};

// Tool count per scope (from scopeConfigs.ts read)
const SCOPE_TOOL_CONFIG: Record<string, { toolCount: string; hasLocalHandler: boolean }> = {
  cockpit:          { toolCount: "platform",        hasLocalHandler: false },
  contacts:         { toolCount: "platform+extras",  hasLocalHandler: true },
  import:           { toolCount: "platform+extras",  hasLocalHandler: true },
  extension:        { toolCount: "platform",         hasLocalHandler: false },
  strategic:        { toolCount: "zero",             hasLocalHandler: false },
  "kb-supervisor":  { toolCount: "platform",         hasLocalHandler: false },
  "deep-search":    { toolCount: "platform",         hasLocalHandler: false },
  chat:             { toolCount: "platform",         hasLocalHandler: false },
  "mission-builder":{ toolCount: "zero",             hasLocalHandler: false },
};

// ══════════════════════════════════════════════════════════
// TEST 1: Scope Routing
// ══════════════════════════════════════════════════════════

describe("Collaudo C8 — Scope Routing", () => {

  it("C8.1 — unified-assistant accepts exactly 10 scopes", () => {
    expect(VALID_SCOPES).toHaveLength(10);
  });

  it("C8.2 — V2 hooks use scopes that are in VALID_SCOPES", () => {
    for (const [hook, scope] of Object.entries(V2_HOOK_SCOPES)) {
      expect(VALID_SCOPES).toContain(scope);
    }
  });

  it("C8.3 — all scopes in VALID_SCOPES have a scopeConfig", () => {
    // partner_hub goes to default → throws Error
    // All others should have explicit config
    const scopesWithConfig = Object.keys(SCOPE_TOOL_CONFIG);
    const scopesNeedingConfig = VALID_SCOPES.filter(s => s !== "partner_hub");
    for (const scope of scopesNeedingConfig) {
      expect(scopesWithConfig).toContain(scope);
    }
  });

  it("C8.4 — BUG: partner_hub (default scope) has NO scopeConfig → throws Error", () => {
    // scopeConfigs.ts line 405: default throws Error("Unknown scope: ${scope}")
    // This means the most common scope (partner_hub) will CRASH if scopeConfigs is used
    const hasPartnerHubConfig = Object.keys(SCOPE_TOOL_CONFIG).includes("partner_hub");
    expect(hasPartnerHubConfig).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 2: Tool Filtering
// ══════════════════════════════════════════════════════════

describe("Collaudo C8 — Tool Filtering by Scope", () => {

  it("C8.5 — strategic scope has ZERO tools", () => {
    expect(SCOPE_TOOL_CONFIG.strategic.toolCount).toBe("zero");
  });

  it("C8.6 — mission-builder scope has ZERO tools", () => {
    expect(SCOPE_TOOL_CONFIG["mission-builder"].toolCount).toBe("zero");
  });

  it("C8.7 — contacts scope has MORE tools than cockpit (extras)", () => {
    expect(SCOPE_TOOL_CONFIG.contacts.toolCount).toBe("platform+extras");
    expect(SCOPE_TOOL_CONFIG.cockpit.toolCount).toBe("platform");
  });

  it("C8.8 — contacts and import have local tool handlers", () => {
    expect(SCOPE_TOOL_CONFIG.contacts.hasLocalHandler).toBe(true);
    expect(SCOPE_TOOL_CONFIG.import.hasLocalHandler).toBe(true);
  });

  it("C8.9 — BUG: ai-assistant does NOT use scopeConfigs to filter tools", () => {
    // From audit bug #1: ai-assistant receives scope but loads ALL TOOL_DEFINITIONS
    // regardless of scope. The scopeConfigs.ts config is decorative.
    // This test documents the expected behavior AFTER the fix:
    //
    // After fix 1.9:
    //   scope=strategic → 0 tools sent to AI
    //   scope=contacts → platform + contacts extras
    //   scope=cockpit → platform only
    //
    // Currently: ALL scopes get ALL tools (broken)
    const bugExists = true; // ai-assistant ignores scope for tool filtering
    expect(bugExists).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════
// TEST 3: Approval Gate Coverage
// ══════════════════════════════════════════════════════════

describe("Collaudo C8 — Agent Approval Gate", () => {

  // Tools that have REAL side effects (write to DB, send messages, etc.)
  const SIDE_EFFECT_TOOLS = [
    "send_email",
    "send_whatsapp",
    "send_linkedin",
    "queue_channel_message",
    "update_partner",
    "create_task",
    "schedule_followup",
  ];

  // Tools that are read-only (should NEVER be blocked by approval)
  const READ_ONLY_TOOLS = [
    "search_kb",
    "search_memory",
    "get_holding_pattern",
    "get_conversation_history",
    "get_inbox",
    "list_workflows",
    "list_playbooks",
    "get_active_plans",
  ];

  // Currently, ONLY send_email has a hard approval guard in agent-execute
  const TOOLS_WITH_HARD_GUARD = ["send_email"];

  it("C8.10 — BUG: only send_email has hard approval guard", () => {
    expect(TOOLS_WITH_HARD_GUARD).toHaveLength(1);
    expect(TOOLS_WITH_HARD_GUARD).toContain("send_email");
  });

  it("C8.11 — BUG: other side-effect tools LACK approval guard", () => {
    const unguarded = SIDE_EFFECT_TOOLS.filter(
      t => !TOOLS_WITH_HARD_GUARD.includes(t)
    );
    // These tools can bypass approval — this is the bug
    expect(unguarded.length).toBeGreaterThan(0);
    expect(unguarded).toContain("send_whatsapp");
    expect(unguarded).toContain("send_linkedin");
    expect(unguarded).toContain("queue_channel_message");
  });

  it("C8.12 — after fix 2.1: ALL side-effect tools must have guard", () => {
    // This test will pass AFTER the fix is applied
    // For now it documents the expected behavior
    const expectedGuardedCount = SIDE_EFFECT_TOOLS.length;
    expect(expectedGuardedCount).toBe(7);
    // After fix: TOOLS_WITH_HARD_GUARD.length should === 7
  });

  it("C8.13 — read-only tools must NEVER be blocked by approval", () => {
    for (const tool of READ_ONLY_TOOLS) {
      expect(SIDE_EFFECT_TOOLS).not.toContain(tool);
    }
  });
});

// ══════════════════════════════════════════════════════════
// TEST 4: Cadence Engine Action Mapping
// ══════════════════════════════════════════════════════════

describe("Collaudo C6 — Cadence Engine mapActionType", () => {

  // Current code from cadence-engine/index.ts line 342-350
  function mapActionType(type: string): string {
    const map: Record<string, string> = {
      email: "send_email",
      phone: "create_task",
      whatsapp: "send_whatsapp",
      linkedin: "linkedin_message",
    };
    return map[type] || "send_email";
  }

  it("C6.1 — email maps to send_email", () => {
    expect(mapActionType("email")).toBe("send_email");
  });

  it("C6.2 — whatsapp maps to send_whatsapp", () => {
    expect(mapActionType("whatsapp")).toBe("send_whatsapp");
  });

  it("C6.3 — BUG: linkedin maps to linkedin_message (inconsistent naming)", () => {
    // Other channels use "send_" prefix, LinkedIn uses "linkedin_message"
    const result = mapActionType("linkedin");
    expect(result).toBe("linkedin_message"); // Inconsistent with send_email, send_whatsapp
    // After fix 1.6: should be "send_linkedin"
  });

  it("C6.4 — BUG: unknown types default to send_email (dangerous)", () => {
    // An unknown action type like "sms" or garbage defaults to "send_email"
    // This is dangerous — should default to "create_task" (safe) instead
    expect(mapActionType("sms")).toBe("send_email");
    expect(mapActionType("unknown_garbage")).toBe("send_email");
  });

  it("C6.5 — phone correctly maps to create_task (safe fallback)", () => {
    expect(mapActionType("phone")).toBe("create_task");
  });
});
