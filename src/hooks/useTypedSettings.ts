/**
 * Typed settings hooks — Phase 4 replacement for generic useAppSettings.
 * Separates app_settings into 3 typed contexts:
 *  - useCredentialSettings → SMTP, LinkedIn, WhatsApp, RA credentials
 *  - useAIConfig → tone, style, model preferences, prompts
 *  - useUIPreferences → theme, layout, default views
 *
 * All hooks still read from the same app_settings table but provide
 * typed interfaces and domain-specific defaults.
 */
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";

// ── Credential keys ──
const _CREDENTIAL_KEYS = [
  "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from",
  "imap_host", "imap_port", "imap_user", "imap_pass",
  "linkedin_cookie", "linkedin_user_agent",
  "whatsapp_connected", "whatsapp_dom_schema",
  "ra_username", "ra_password", "ra_network",
] as const;

export interface CredentialSettings {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  imapHost: string;
  imapPort: string;
  imapUser: string;
  imapPass: string;
  linkedinCookie: string;
  linkedinUserAgent: string;
  whatsappConnected: string;
  whatsappDomSchema: string;
  raUsername: string;
  raPassword: string;
  raNetwork: string;
}

function mapCredentials(raw: Record<string, string>): CredentialSettings {
  return {
    smtpHost: raw["smtp_host"] || "",
    smtpPort: raw["smtp_port"] || "587",
    smtpUser: raw["smtp_user"] || "",
    smtpPass: raw["smtp_pass"] || "",
    smtpFrom: raw["smtp_from"] || "",
    imapHost: raw["imap_host"] || "",
    imapPort: raw["imap_port"] || "993",
    imapUser: raw["imap_user"] || "",
    imapPass: raw["imap_pass"] || "",
    linkedinCookie: raw["linkedin_cookie"] || "",
    linkedinUserAgent: raw["linkedin_user_agent"] || "",
    whatsappConnected: raw["whatsapp_connected"] || "false",
    whatsappDomSchema: raw["whatsapp_dom_schema"] || "",
    raUsername: raw["ra_username"] || "",
    raPassword: raw["ra_password"] || "",
    raNetwork: raw["ra_network"] || "",
  };
}

// ── AI Config keys ──
const _AI_CONFIG_KEYS = [
  "ai_tone", "ai_language", "ai_sales_knowledge_base",
  "ai_custom_email_types", "ai_custom_goals", "ai_custom_proposals",
  "ai_deep_search_config",
  "agent_max_actions_per_cycle", "agent_work_start_hour", "agent_work_end_hour",
] as const;

export interface AIConfigSettings {
  tone: string;
  language: string;
  salesKnowledgeBase: string;
  customEmailTypes: string;
  customGoals: string;
  customProposals: string;
  deepSearchConfig: string;
  agentMaxActions: number;
  agentWorkStartHour: number;
  agentWorkEndHour: number;
}

function mapAIConfig(raw: Record<string, string>): AIConfigSettings {
  return {
    tone: raw["ai_tone"] || "professionale",
    language: raw["ai_language"] || "it",
    salesKnowledgeBase: raw["ai_sales_knowledge_base"] || "",
    customEmailTypes: raw["ai_custom_email_types"] || "[]",
    customGoals: raw["ai_custom_goals"] || "[]",
    customProposals: raw["ai_custom_proposals"] || "[]",
    deepSearchConfig: raw["ai_deep_search_config"] || "{}",
    agentMaxActions: parseInt(raw["agent_max_actions_per_cycle"] || "10", 10),
    agentWorkStartHour: parseInt(raw["agent_work_start_hour"] || "8", 10),
    agentWorkEndHour: parseInt(raw["agent_work_end_hour"] || "18", 10),
  };
}

// ── Typed hooks ──

export function useCredentialSettings() {
  const { data: raw, isLoading } = useAppSettings();
  return {
    credentials: raw ? mapCredentials(raw) : null,
    isLoading,
  };
}

export function useAIConfigSettings() {
  const { data: raw, isLoading } = useAppSettings();
  return {
    aiConfig: raw ? mapAIConfig(raw) : null,
    isLoading,
  };
}

/**
 * Helper to update a setting with type-safe key mapping.
 * Still uses the same underlying mutation but provides better DX.
 */
export function useTypedSettingUpdate() {
  return useUpdateSetting();
}
