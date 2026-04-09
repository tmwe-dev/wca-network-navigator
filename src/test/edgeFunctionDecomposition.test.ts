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
