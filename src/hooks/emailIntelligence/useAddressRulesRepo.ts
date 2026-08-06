/**
 * useAddressRulesRepo — accesso tipizzato al DAL `emailAddressRules` per la UI
 * Email Intelligence. Nessun cambio di semantica: espone le stesse funzioni DAL
 * con identiche firme, memoizzate in un oggetto stabile.
 */
import { useMemo } from "react";
import {
  bulkUpdateAutoAction,
  bulkSetBlocked,
  findAutoActionRulesForEmails,
  findAddressRulesForUi,
  updateAddressRuleById,
  insertAddressRule,
  setAddressRuleActive,
  deleteAddressRule,
  countAddressRulesByGroup,
  findAddressRuleSummaries,
  findAddressRuleIdForUserEmail,
  updateAddressRulePrompt,
  insertAddressRuleWithPrompt,
  findReusablePromptRules,
  clearAddressRuleGroupAssignment,
  clearAddressRuleGroupAssignmentsByGroupName,
} from "@/data/emailAddressRules";

export type {
  AddressRuleUpsertInput,
  AddressRuleRow,
  AddressRuleOrder,
  AddressRuleSummary,
  ReusablePromptRuleRow,
  AutoActionRuleRow,
} from "@/data/emailAddressRules";

const repo = {
  bulkUpdateAutoAction,
  bulkSetBlocked,
  findAutoActionRulesForEmails,
  findAddressRulesForUi,
  updateAddressRuleById,
  insertAddressRule,
  setAddressRuleActive,
  deleteAddressRule,
  countAddressRulesByGroup,
  findAddressRuleSummaries,
  findAddressRuleIdForUserEmail,
  updateAddressRulePrompt,
  insertAddressRuleWithPrompt,
  findReusablePromptRules,
  clearAddressRuleGroupAssignment,
  clearAddressRuleGroupAssignmentsByGroupName,
} as const;

export type AddressRulesRepo = typeof repo;

export function useAddressRulesRepo(): AddressRulesRepo {
  return useMemo(() => repo, []);
}
