import { useMemo } from "react";

interface GovernanceData {
  role: string;
  permission: string;
  policy: string;
}

const actionPermissions: Record<string, string> = {
  "ai-query": "READ:DB",
  "followup-batch": "EXECUTE:OUTREACH",
  "agent-report": "READ:AGENTS",
  "campaign-preview": "WRITE:CAMPAIGN",
  "campaign-status": "READ:CAMPAIGNS",
  "compose-email": "WRITE:EMAIL",
  "search-kb": "READ:KB",
  "contact-search": "READ:CONTACTS",
  "prospect-search": "READ:PROSPECTS",
  "dashboard-snapshot": "READ:DASHBOARD",
  "outreach-queue": "READ:OUTREACH",
  "deep-search-partner": "READ:PARTNERS",
  "deep-search-contact": "READ:CONTACTS",
  "create-contact": "WRITE:CONTACTS",
  "update-contact": "WRITE:CONTACTS",
  "create-partner": "WRITE:PARTNERS",
  "update-partner-status": "WRITE:PARTNERS",
  "create-campaign": "WRITE:CAMPAIGNS",
  "enqueue-outreach": "EXECUTE:OUTREACH",
  "create-agent": "WRITE:AGENTS",
  "create-kb-entry": "WRITE:KB",
  "analyze-partner": "READ:PARTNERS",
  "calculate-lead-scores": "EXECUTE:SCORING",
  "deduplicate-contacts": "EXECUTE:DEDUP",
};

export function useGovernance(actionId?: string): GovernanceData {
  return useMemo(() => ({
    role: "COMMERCIALE",
    permission: actionPermissions[actionId ?? ""] ?? "READ:GENERIC",
    policy: "POLICY v1.0 · SOFT-SYNC",
  }), [actionId]);
}
