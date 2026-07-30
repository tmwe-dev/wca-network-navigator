/**
 * Campagna 90K — contract test sulle estrazioni DAL ad alto impatto.
 * Verifica che ogni funzione estratta esista con la firma attesa,
 * così un rollback accidentale del DAL rompe la suite invece che la UI.
 */
import { describe, it, expect } from "vitest";
import * as addressRules from "@/data/emailAddressRules";
import * as prompts from "@/data/emailPrompts";
import * as grouping from "@/data/emailGrouping";
import * as outreach from "@/data/outreachPipeline";
import * as pendingActions from "@/data/aiPendingActions";
import * as dataCounts from "@/data/dataCounts";

describe("DAL 90K — email_address_rules", () => {
  it("espone le funzioni CRUD estratte dai componenti", () => {
    expect(typeof addressRules.findAddressRulesForUi).toBe("function");
    expect(typeof addressRules.updateAddressRuleById).toBe("function");
    expect(typeof addressRules.updateAddressRuleUnfiltered).toBe("function");
    expect(typeof addressRules.insertAddressRule).toBe("function");
    expect(typeof addressRules.setAddressRuleActive).toBe("function");
    expect(typeof addressRules.deleteAddressRule).toBe("function");
    expect(typeof addressRules.countAddressRulesByGroup).toBe("function");
  });

  it("findAddressRulesForUi accetta search + ordine tipizzato", () => {
    expect(addressRules.findAddressRulesForUi.length).toBe(2);
  });
});

describe("DAL 90K — email_prompts", () => {
  it("espone le funzioni CRUD estratte", () => {
    expect(typeof prompts.findAllEmailPrompts).toBe("function");
    expect(typeof prompts.updateEmailPromptUnfiltered).toBe("function");
    expect(typeof prompts.insertEmailPrompt).toBe("function");
    expect(typeof prompts.setEmailPromptActive).toBe("function");
    expect(typeof prompts.deleteEmailPrompt).toBe("function");
  });
});

describe("DAL 90K — assegnazione gruppi", () => {
  it("espone il write path completo di useGroupAssignment", () => {
    expect(typeof grouping.fetchOperatorIdForUser).toBe("function");
    expect(typeof grouping.updateAddressRuleGroupAssignment).toBe("function");
    expect(typeof grouping.insertAddressRuleForSender).toBe("function");
    expect(typeof grouping.insertGroupAssignmentDecision).toBe("function");
    expect(typeof grouping.findDomainPatternKbEntryId).toBe("function");
    expect(typeof grouping.insertKbEntry).toBe("function");
    expect(typeof grouping.updateSenderGroupAutoAction).toBe("function");
  });
});

describe("DAL 90K — conteggi", () => {
  it("espone i conteggi outreach e dataset", () => {
    expect(typeof outreach.fetchOutreachSubCounts).toBe("function");
    expect(typeof dataCounts.fetchGlobalDataCounts).toBe("function");
  });
});

describe("DAL 90K — ai_pending_actions", () => {
  it("espone lettura, update e side effect di review", () => {
    expect(typeof pendingActions.findPendingAiActions).toBe("function");
    expect(typeof pendingActions.updatePendingAction).toBe("function");
    expect(typeof pendingActions.setDecisionLogReview).toBe("function");
    expect(typeof pendingActions.findActiveAgentPrompts).toBe("function");
    expect(typeof pendingActions.updateAgentSystemPrompt).toBe("function");
  });
});
