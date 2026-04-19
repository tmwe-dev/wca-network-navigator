import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Edge Function Decomposition — ai-assistant", () => {
  const sharedDir = path.resolve("supabase/functions/_shared");

  it("toolHandlersRead.ts esiste e esporta createReadHandlers", () => {
    const content = fs.readFileSync(path.join(sharedDir, "toolHandlersRead.ts"), "utf-8");
    expect(content).toContain("export function createReadHandlers");
    expect(content).toContain("executeSearchPartners");
    expect(content).toContain("executePartnerDetail");
    expect(content).toContain("executeCheckJobStatus");
  });

  it("toolHandlersWrite.ts esiste e esporta createWriteHandlers", () => {
    const content = fs.readFileSync(path.join(sharedDir, "toolHandlersWrite.ts"), "utf-8");
    expect(content).toContain("export function createWriteHandlers");
    expect(content).toContain("executeUpdatePartner");
    expect(content).toContain("executeCreateActivity");
    expect(content).toContain("executeSendEmail");
  });

  it("toolHandlersEnterprise.ts esiste e esporta createEnterpriseHandlers", () => {
    const content = fs.readFileSync(path.join(sharedDir, "toolHandlersEnterprise.ts"), "utf-8");
    expect(content).toContain("export function createEnterpriseHandlers");
    expect(content).toContain("executeSaveMemory");
    expect(content).toContain("executeSearchKb");
    expect(content).toContain("executeStartWorkflow");
  });

  it("ogni modulo shared è sotto 800 righe", () => {
    const files = ["toolHandlersRead.ts", "toolHandlersWrite.ts", "toolHandlersEnterprise.ts"];
    for (const file of files) {
      const content = fs.readFileSync(path.join(sharedDir, file), "utf-8");
      const lines = content.split("\n").length;
      expect(lines).toBeLessThan(800);
    }
  });

  it("i tool handler condivisi coprono tutti i case del dispatcher", () => {
    const readContent = fs.readFileSync(path.join(sharedDir, "toolHandlersRead.ts"), "utf-8");
    const writeContent = fs.readFileSync(path.join(sharedDir, "toolHandlersWrite.ts"), "utf-8");
    const enterpriseContent = fs.readFileSync(path.join(sharedDir, "toolHandlersEnterprise.ts"), "utf-8");
    const allContent = readContent + writeContent + enterpriseContent;

    const requiredHandlers = [
      "executeSearchPartners", "executeCountryOverview", "executeDirectoryStatus",
      "executeListJobs", "executePartnerDetail", "executeGlobalSummary",
      "executeCheckBlacklist", "executeListReminders", "executePartnersWithoutContacts",
      "executeUpdatePartner", "executeAddPartnerNote", "executeCreateReminder",
      "executeUpdateLeadStatus", "executeBulkUpdatePartners",
      "executeSaveMemory", "executeSearchMemory", "executeCreateWorkPlan",
      "executeGetActivePlans", "executeSearchKb",
    ];

    for (const handler of requiredHandlers) {
      expect(allContent).toContain(handler);
    }
  });
});

describe("Edge Function Consolidation — Macro-functions", () => {
  const functionsDir = path.resolve("supabase/functions");

  it("unified-assistant esiste e gestisce tutti gli scope", () => {
    const content = fs.readFileSync(path.join(functionsDir, "unified-assistant/index.ts"), "utf-8");
    expect(content).toContain("partner_hub");
    expect(content).toContain("cockpit");
    expect(content).toContain("contacts");
    expect(content).toContain("import");
    expect(content).toContain("extension");
    expect(content).toContain("strategic");
    expect(content).toContain("forwardToFunction");
  });

  it("generate-content esiste e gestisce tutte le azioni", () => {
    const content = fs.readFileSync(path.join(functionsDir, "generate-content/index.ts"), "utf-8");
    expect(content).toContain('"email"');
    expect(content).toContain('"outreach"');
    expect(content).toContain('"improve"');
    expect(content).toContain('"analyze_edit"');
    expect(content).toContain("forwardToFunction");
  });

  it("ai-utility esiste e gestisce le utility", () => {
    const content = fs.readFileSync(path.join(functionsDir, "ai-utility/index.ts"), "utf-8");
    expect(content).toContain('"briefing"');
    expect(content).toContain('"categorize"');
    expect(content).toContain('"deep_search"');
    expect(content).toContain("forwardToFunction");
  });

  it("proxyUtils.ts esporta forwardToFunction e proxyToMacro", () => {
    const content = fs.readFileSync(path.join(functionsDir, "_shared/proxyUtils.ts"), "utf-8");
    expect(content).toContain("export async function forwardToFunction");
    expect(content).toContain("export async function proxyToMacro");
  });

  it("le 3 macro-funzioni sono sotto 100 righe ciascuna (sono router)", () => {
    const macros = ["unified-assistant/index.ts", "generate-content/index.ts", "ai-utility/index.ts"];
    for (const macro of macros) {
      const content = fs.readFileSync(path.join(functionsDir, macro), "utf-8");
      const lines = content.split("\n").length;
      expect(lines).toBeLessThan(100);
    }
  });
});

describe("Client Migration — call sites use macro-endpoints", () => {
  const srcDir = path.resolve("src");

  // Exclude test pages, data config files, and the dedicated deep-search-partner tool
  // (deep-search-partner is a stand-alone V2 Command tool, NOT a legacy proxy.)
  const EXCLUDE = [
    "AILab.tsx",
    "Diagnostics.tsx",
    "agentPrompts.ts",
    "types.ts",
    "sentry.ts",
    "deepSearchPartner.ts",
    "useGovernance.ts",
  ];

  function searchFiles(dir: string, pattern: RegExp): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "test" && entry.name !== "__tests__") {
        results.push(...searchFiles(fullPath, pattern));
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) && !EXCLUDE.includes(entry.name)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (pattern.test(content)) results.push(fullPath);
      }
    }
    return results;
  }

  it("nessun call site usa più i proxy legacy per gli assistant", () => {
    const legacyAssistants = /"(cockpit-assistant|contacts-assistant|import-assistant|extension-brain|super-assistant)"/;
    const hits = searchFiles(srcDir, legacyAssistants);
    expect(hits).toEqual([]);
  });

  it("nessun call site usa più i proxy legacy per generate/utility", () => {
    const legacyGenerators = /"(generate-email|generate-outreach|deep-search-partner)"/;
    const hits = searchFiles(srcDir, legacyGenerators);
    expect(hits).toEqual([]);
  });

  it("dead hooks sono stati rimossi", () => {
    const deadHooks = [
      "useDirectoryDownload.ts", "useEntityPaginated.ts", "usePartnerHubActions.ts",
      "useTeamMembers.ts", "useThemeToggle.ts", "useWorkedToday.ts",
    ];
    for (const hook of deadHooks) {
      expect(fs.existsSync(path.join(srcDir, "hooks", hook))).toBe(false);
    }
  });
});
