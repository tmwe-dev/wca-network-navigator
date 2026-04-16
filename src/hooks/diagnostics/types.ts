/**
 * Diagnostics types — zero any
 */

export type TestStatus = "idle" | "running" | "pass" | "fail" | "warn";

export interface TestResult {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly status: TestStatus;
  readonly message?: string;
  readonly durationMs?: number;
}

export interface DiagnosticsSummary {
  readonly total: number;
  readonly pass: number;
  readonly fail: number;
  readonly warn: number;
  readonly running: number;
}

export const DB_TABLES = [
  "partners", "partner_contacts", "partner_networks", "partner_services",
  "partner_certifications", "partner_social_links", "partners_no_contacts",
  "activities", "interactions", "reminders", "team_members",
  "campaign_jobs", "email_campaign_queue", "email_drafts", "email_templates",
  "download_jobs", "download_queue", "directory_cache",
  "imported_contacts", "import_logs", "import_errors",
  "prospects", "prospect_contacts", "prospect_interactions", "prospect_social_links",
  "contact_interactions",
  "profiles", "user_credits", "credit_transactions", "user_api_keys", "user_wca_credentials",
  "app_settings", "workspace_documents", "workspace_presets",
  "network_configs", "blacklist_entries", "blacklist_sync_log",
] as const;

export const EDGE_FUNCTIONS = [
  "ai-assistant", "analyze-import-structure", "analyze-partner",
  "consume-credits",
  "deduplicate-partners", "deep-search-contact", "deep-search-partner",
  "enrich-partner-website", "generate-aliases", "generate-email",
  "get-linkedin-credentials", "get-ra-credentials", "get-wca-credentials",
  "parse-profile-ai", "process-ai-import",
  "process-download-job", "process-email-queue",
  "save-linkedin-cookie", "save-ra-cookie", "save-ra-prospects",
  "save-wca-contacts", "save-wca-cookie",
  "scrape-wca-blacklist", "scrape-wca-directory", "scrape-wca-partners",
  "send-email", "unified-assistant", "wca-auto-login",
] as const;

export const RPC_FUNCTIONS = [
  "get_country_stats", "get_contact_filter_options",
  "get_contact_group_counts", "get_directory_counts",
  "deduct_credits", "increment_contact_interaction",
] as const;

export const STORAGE_BUCKETS = ["templates", "workspace-docs", "import-files"] as const;

export const APP_ROUTES = [
  "/", "/operations", "/campaigns", "/acquisizione", "/reminders",
  "/settings", "/prospects", "/partner-hub", "/guida",
  "/campaign-jobs", "/email-composer", "/workspace", "/sorting",
  "/import", "/global", "/test-download", "/contacts", "/hub", "/cockpit",
] as const;

/** Extracts error message from unknown catch value */
export function extractErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/** Times an async operation, returns duration in ms */
export async function timedRun(fn: () => Promise<void>): Promise<number> {
  const t = performance.now();
  await fn();
  return Math.round(performance.now() - t);
}
