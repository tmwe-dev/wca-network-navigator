export interface ToolResultColumn {
  readonly key: string;
  readonly label: string;
}

export interface ToolResult {
  readonly kind: "table";
  readonly title: string;
  readonly columns: ToolResultColumn[];
  readonly rows: Record<string, string | number | null>[];
  readonly meta?: {
    readonly count: number;
    readonly sourceLabel: string;
  };
}

export interface Tool {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  match(prompt: string): boolean;
  execute(prompt: string): Promise<ToolResult>;
}
