/**
 * Types for EmailComposer state management
 */
import type { EditAnalysis } from "@/components/email/EmailEditLearningDialog";

export interface LinkItem { label: string; url: string }

export interface EmailTemplate {
  id: string;
  name: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  category: string | null;
}

export interface EmailComposerLocationState {
  prefilledRecipient?: {
    partnerId?: string;
    company?: string;
    companyName?: string;
    companyAlias?: string;
    contactId?: string;
    name?: string;
    contactName?: string;
    contactAlias?: string;
    email?: string;
    city?: string;
    countryName?: string;
    countryCode?: string;
  };
  prefilledSubject?: string;
  prefilledBody?: string;
}

export interface GenerateContentResponse {
  body?: string;
  subject?: string;
  _context_summary?: Record<string, unknown>;
}

export interface ImproveEmailResponse {
  body?: string;
  subject?: string;
  _context_summary?: Record<string, unknown>;
}

export interface PartnerPreviewData {
  companyAlias?: string;
  company_alias?: string;
  companyName?: string;
  company_name?: string;
  contactAlias?: string;
  contact_alias?: string;
  city?: string;
  countryName?: string;
  country_name?: string;
}

interface EmailState {
  subject: string;
  htmlBody: string;
  selectedAttachments: string[];
  emailLinks: LinkItem[];
  newLinkLabel: string;
  newLinkUrl: string;
}

interface UIState {
  manualEmail: string;
  previewOpen: boolean;
  unknownEmailDialog: boolean;
  pendingEmail: string;
  manualContactName: string;
  manualCompanyName: string;
}

interface AIState {
  aiGenerating: boolean;
  aiImproving: boolean;
  aiGeneratedBody: string;
  aiGeneratedSubject: string;
  learningDialogOpen: boolean;
  editAnalysis: EditAnalysis | null;
  pendingSend: boolean;
}

interface TemplateState {
  saveTemplateOpen: boolean;
  templateName: string;
  templateCategory: string;
  customCategory: string;
}

interface QueueState {
  sending: boolean;
  activeDraftId: string | null;
  activeQueueStatus: string;
}

export interface ComposerState {
  email: EmailState;
  ui: UIState;
  ai: AIState;
  template: TemplateState;
  queue: QueueState;
}

export type Action =
  | { type: "SET_SUBJECT"; payload: string }
  | { type: "SET_HTML_BODY"; payload: string }
  | { type: "SET_ATTACHMENTS"; payload: string[] }
  | { type: "SET_EMAIL_LINKS"; payload: LinkItem[] }
  | { type: "SET_NEW_LINK_LABEL"; payload: string }
  | { type: "SET_NEW_LINK_URL"; payload: string }
  | { type: "SET_MANUAL_EMAIL"; payload: string }
  | { type: "TOGGLE_PREVIEW" }
  | { type: "SET_UNKNOWN_DIALOG"; payload: boolean }
  | { type: "SET_PENDING_EMAIL"; payload: string }
  | { type: "SET_MANUAL_CONTACT_NAME"; payload: string }
  | { type: "SET_MANUAL_COMPANY_NAME"; payload: string }
  | { type: "SET_AI_GENERATING"; payload: boolean }
  | { type: "SET_AI_IMPROVING"; payload: boolean }
  | { type: "SET_AI_GENERATED"; payload: { body: string; subject: string } }
  | { type: "SET_LEARNING_DIALOG"; payload: boolean }
  | { type: "SET_EDIT_ANALYSIS"; payload: EditAnalysis | null }
  | { type: "SET_PENDING_SEND"; payload: boolean }
  | { type: "SET_SAVE_TEMPLATE_OPEN"; payload: boolean }
  | { type: "SET_TEMPLATE_NAME"; payload: string }
  | { type: "SET_TEMPLATE_CATEGORY"; payload: string }
  | { type: "SET_CUSTOM_CATEGORY"; payload: string }
  | { type: "SET_SENDING"; payload: boolean }
  | { type: "SET_ACTIVE_DRAFT"; payload: { id: string | null; status: string } }
  | { type: "SET_QUEUE_STATUS"; payload: string }
  | { type: "RESET_TEMPLATE_FORM" };
