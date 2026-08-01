/**
 * Deals DAL — DEPRECATED stub.
 * The Deals feature was removed from the UI (Pipeline section).
 * This file remains only to satisfy type imports from the Calendar module.
 * No DB calls are performed.
 */

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export interface Deal {
  readonly id: string;
  readonly user_id: string;
  readonly title: string;
  readonly stage: DealStage;
  readonly amount?: number | null;
  readonly currency?: string | null;
  readonly partner_id?: string | null;
  readonly contact_id?: string | null;
  readonly created_at?: string;
  readonly updated_at?: string;
}

export interface DealActivity {
  readonly id: string;
  readonly deal_id: string;
  readonly user_id: string;
  readonly activity_type:
    | "stage_change"
    | "amount_change"
    | "note"
    | "created"
    | "deleted";
  readonly description?: string | null;
  readonly old_value?: string | null;
  readonly new_value?: string | null;
  readonly created_at?: string;
}

export interface DealStats {
  readonly total: number;
  readonly byStage: Record<DealStage, number>;
  readonly amountTotal: number;
}

export interface DealFilters {
  readonly stage?: DealStage | DealStage[];
  readonly minAmount?: number;
  readonly maxAmount?: number;
}

export interface DealWithRelations extends Deal {
  readonly partner?: { id: string; name: string } | null;
  readonly contact?: { id: string; name: string } | null;
}