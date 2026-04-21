/**
 * Tipi frontend speculari di supabase/functions/_shared/emailContract.ts
 * (LOVABLE-81/82). Tenuti separati per evitare import edge→client.
 */
export interface TypeConflict {
  type:
    | "type_history_mismatch"
    | "type_status_mismatch"
    | "description_type_mismatch"
    | "status_channel_mismatch"
    | "duplicate_recent"
    | "phase_skip";
  description: string;
  severity: "info" | "warning" | "blocking";
  suggestion: string;
}

export interface ResolvedEmailType {
  original_type: string;
  resolved_type: string;
  was_overridden: boolean;
  confidence: number;
  reasoning: string;
  conflicts: TypeConflict[];
  proceed: boolean;
}