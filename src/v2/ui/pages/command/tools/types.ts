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

export interface ToolResultMeta {
  readonly count: number;
  readonly sourceLabel: string;
}

export type ToolResult =
  | {
      readonly kind: "table";
      readonly title: string;
      readonly columns: ToolResultColumn[];
      readonly rows: Record<string, string | number | null>[];
      readonly meta?: ToolResultMeta;
    }
  | {
      readonly kind: "card-grid";
      readonly title: string;
      readonly cards: readonly CardItem[];
      readonly meta?: ToolResultMeta;
    };

export interface Tool {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  match(prompt: string): boolean;
  execute(prompt: string): Promise<ToolResult>;
}
