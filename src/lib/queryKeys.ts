/**
 * Centralized React Query key factory.
 * Suddiviso per dominio in src/lib/queryKeysParts/* per LOC budget.
 * RULE: All query keys MUST be defined here. Inline string arrays are banned
 * by the ESLint `no-restricted-syntax` rule in eslint.config.js.
 */
import { crmKeys } from "./queryKeysParts/crm";
import { commsKeys } from "./queryKeysParts/comms";
import { systemKeys } from "./queryKeysParts/system";
import { aiAndAnalyticsKeys } from "./queryKeysParts/aiAndAnalytics";
import { v2Keys } from "./queryKeysParts/v2";

export const queryKeys = {
  ...crmKeys,
  ...commsKeys,
  ...systemKeys,
  ...aiAndAnalyticsKeys,
  ...v2Keys,
} as const;
