/**
 * Types per Email Management — Ported from tmwengine, adapted to WCA data model
 */

export interface EmailSenderGroup {
  id: string;
  nome_gruppo: string;
  descrizione?: string | null;
  colore: string;
  icon?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SenderAnalysis {
  email: string;
  domain: string;
  companyName: string;
  emailCount: number;
  firstSeen: string;
  lastSeen: string;
  isClassified: boolean;
  currentGroup?: EmailSenderGroup;
  customPrompt?: string;
  autoAction?: string;
  ruleId?: string;
  /** Suggerimento AI dal campo email_address_rules.ai_suggested_group (solo HINT visivo). */
  aiSuggestion?: { group_name: string; confidence: number; accepted: boolean | null };
  /** Flag is_blocked su email_address_rules. */
  isBlocked?: boolean;
}

export type GroupType =
  | 'operativo'
  | 'commerciale'
  | 'amministrativo'
  | 'dogana'
  | 'tecnologie'
  | 'spam'
  | 'promo'
  | 'documenti'
  | 'offerte'
  | 'custom';

export const DEFAULT_GROUPS: Array<{
  name: string;
  type: GroupType;
  color: string;
  icon: string;
  description: string;
}> = [
  { name: 'Operativo', type: 'operativo', color: '#3B82F6', icon: '⚙️', description: 'Email operative quotidiane' },
  { name: 'Commerciale', type: 'commerciale', color: '#F59E0B', icon: '💼', description: 'Vendite, offerte, clienti' },
  { name: 'Amministrativo', type: 'amministrativo', color: '#10B981', icon: '📊', description: 'Contabilità, amministrazione' },
  { name: 'Dogana', type: 'dogana', color: '#8B5CF6', icon: '🛃', description: 'Documenti doganali' },
  { name: 'Tecnologie e Sistemi', type: 'tecnologie', color: '#06B6D4', icon: '💻', description: 'IT, software, sistemi' },
  { name: 'Spam', type: 'spam', color: '#EF4444', icon: '🚫', description: 'Email indesiderate' },
  { name: 'Promo', type: 'promo', color: '#EC4899', icon: '🎁', description: 'Promozionali, marketing' },
  { name: 'Documenti', type: 'documenti', color: '#6366F1', icon: '📄', description: 'Contratti, certificati' },
  { name: 'Offerte', type: 'offerte', color: '#14B8A6', icon: '💰', description: 'Quotazioni, preventivi' },
];

export type SortOption = 'count-desc' | 'count-asc' | 'name-asc' | 'name-desc' | 'ai_group';
