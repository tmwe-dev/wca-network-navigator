import type { DetectedTone } from "../../lib/toneDetector";
import type { EmailPipelineStage } from "../../canvas/EmailPipelineBadge";

export interface PartnerRow {
  id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string | null;
  city: string | null;
  email: string | null;
  website: string | null;
  lead_status: string | null;
  status_reason: string | null;
  last_interaction_at: string | null;
}

export interface ContactRow {
  id: string;
  partner_id: string;
  name: string | null;
  contact_alias: string | null;
  email: string | null;
  title: string | null;
}

export type { DetectedTone, EmailPipelineStage };