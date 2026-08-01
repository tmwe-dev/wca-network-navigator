/**
 * Shared types for mission step components
 */
export interface DeepSearchConfig {
  enabled: boolean;
  scrapeWebsite: boolean;
  scrapeLinkedIn: boolean;
  verifyWhatsApp: boolean;
  aiAnalysis: boolean;
}

export interface CommunicationConfig {
  templateMode: "ai_generate" | "preset" | "custom";
  presetId?: string;
  customSubject?: string;
  customBody?: string;
  samplePreview?: string;
  emailType?: string;
}

export interface AttachmentConfig {
  templateIds: string[];
  imageIds: string[];
  links: string[];
  includeSignatureImage: boolean;
}

export interface ToneConfig {
  quality: "fast" | "standard" | "premium";
  tone: string;
  language: string;
}

export interface MissionStepData {
  targets?: { countries: string[]; types: string[]; ratings: number[]; hasEmail: boolean };
  batching?: { batches: { country: string; count: number }[] };
  channel?: "email" | "whatsapp" | "linkedin" | "mix";
  deepSearch?: DeepSearchConfig;
  communication?: CommunicationConfig;
  attachments?: AttachmentConfig;
  toneConfig?: ToneConfig;
  agents?: { agentId: string; agentName: string; countries: string[] }[];
  schedule?: "immediate" | "scheduled" | "distributed";
  scheduleDate?: string;
}

export interface CountryStat {
  code: string;
  name: string;
  count: number;
  withEmail: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  territories: string[];
}

export interface MissionStepProps {
  data: MissionStepData;
  onChange: (d: MissionStepData) => void;
  stats?: { countries: CountryStat[] };
  agentsList?: AgentInfo[];
}
