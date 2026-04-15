import { useMemo } from "react";

interface GovernanceData {
  role: string;
  permission: string;
  policy: string;
}

const actionPermissions: Record<string, string> = {
  "partner-search": "READ:PARTNERS",
  "followup-batch": "EXECUTE:OUTREACH",
  "agent-report": "READ:AGENTS",
  "campaign-preview": "WRITE:CAMPAIGN",
};

export function useGovernance(actionId?: string): GovernanceData {
  return useMemo(() => ({
    role: "COMMERCIALE",
    permission: actionPermissions[actionId ?? ""] ?? "READ:GENERIC",
    policy: "POLICY v1.0 · SOFT-SYNC",
  }), [actionId]);
}
