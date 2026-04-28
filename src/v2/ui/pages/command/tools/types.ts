export interface ToolResultColumn {
  readonly key: string;
  readonly label: string;
}

export interface CardItem {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly meta: readonly string[];
  readonly lastContact: string | null;
  readonly suggestedAction: string;
}

export interface TimelineEventItem {
  readonly time: string;
  readonly agent: string;
  readonly action: string;
  readonly status: "success" | "pending" | "warning" | "info";
}

export interface TimelineKpiItem {
  readonly label: string;
  readonly value: string;
}

export interface FlowNodeItem {
  readonly label: string;
  readonly type: "trigger" | "action" | "condition" | "end";
  readonly detail?: string;
}

export interface ToolResultMeta {
  readonly count: number;
  readonly sourceLabel: string;
  /** Riferimenti tracciabili da esporre nell'audit del messaggio Direttore. */
  readonly auditRefs?: ReadonlyArray<{
    readonly kind: "operative-prompt" | "kb-section" | "model" | "playbook" | "context";
    readonly label: string;
    readonly value?: string;
  }>;
}

export interface BulkAction {
  readonly id: string;
  readonly label: string;
  /** Prompt template; placeholder `{ids}` will be replaced with comma-joined selected IDs */
  readonly promptTemplate: string;
}

export interface ApprovalDetail {
  readonly label: string;
  readonly value: string;
}

export interface GovernanceInfo {
  readonly role: string;
  readonly permission: string;
  readonly policy: string;
}

export type ToolResult =
  | {
      readonly kind: "table";
      readonly title: string;
      readonly columns: ToolResultColumn[];
      readonly rows: Record<string, string | number | null>[];
      readonly meta?: ToolResultMeta;
      /** Enables row-selection (checkbox column) */
      readonly selectable?: boolean;
      /** Bulk actions exposed when ≥1 row is selected */
      readonly bulkActions?: readonly BulkAction[];
      /** Field name in each row that uniquely identifies it (default: "id") */
      readonly idField?: string;
      /** Source kind for realtime auto-refresh (e.g. "partners", "outreach_queue") */
      readonly liveSource?: string;
    }
  | {
      readonly kind: "card-grid";
      readonly title: string;
      readonly cards: readonly CardItem[];
      readonly meta?: ToolResultMeta;
      readonly selectable?: boolean;
      readonly bulkActions?: readonly BulkAction[];
      readonly liveSource?: string;
    }
  | {
      readonly kind: "timeline";
      readonly title: string;
      readonly events: readonly TimelineEventItem[];
      readonly kpis: readonly TimelineKpiItem[];
      readonly meta?: ToolResultMeta;
    }
  | {
      readonly kind: "flow";
      readonly title: string;
      readonly nodes: readonly FlowNodeItem[];
      readonly meta?: ToolResultMeta;
    }
  | {
      readonly kind: "composer";
      readonly title: string;
      readonly initialTo: string;
      readonly initialSubject: string;
      readonly initialBody: string;
      readonly promptHint: string;
      readonly meta?: ToolResultMeta;
      /** Optional dossier shown in chat BEFORE the composer opens (Oracle/Architect summary). */
      readonly dossier?: {
        readonly partnerName: string;
        readonly contactName: string | null;
        readonly leadStatus: string | null;
        readonly lastInteraction: string | null;
        readonly notes: readonly string[];
        readonly emailType: string;
      };
      /** Resolved partner_id used to call generate-email (for re-generation in composer). */
      readonly partnerId?: string | null;
      /** Resolved recipient name used by generate-email. */
      readonly recipientName?: string | null;
      /** Resolved oracle email type (e.g. "primo_contatto"). */
      readonly emailType?: string;
    }
  | {
      readonly kind: "approval";
      readonly title: string;
      readonly description: string;
      readonly details: readonly ApprovalDetail[];
      readonly governance: GovernanceInfo;
      readonly pendingPayload: Record<string, unknown>;
      readonly toolId: string;
      readonly meta?: ToolResultMeta;
    }
  | {
      readonly kind: "report";
      readonly title: string;
      readonly sections: readonly { heading: string; body: string }[];
      readonly meta?: ToolResultMeta;
    }
  | {
      readonly kind: "result";
      readonly title: string;
      readonly message: string;
      readonly meta?: ToolResultMeta;
    };

export interface ToolContext {
  readonly confirmed?: boolean;
  readonly payload?: Record<string, unknown>;
  /** Original natural-language user prompt (preserved across plan resolution) */
  readonly originalPrompt?: string;
  /** Conversational hint string describing previous-turn context (for follow-ups) */
  readonly contextHint?: string;
  /** Recent conversation turns for AI context */
  readonly history?: { role: string; content: string }[];
}

export interface Tool {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  match(prompt: string): boolean;
  execute(prompt: string, context?: ToolContext): Promise<ToolResult>;
}
