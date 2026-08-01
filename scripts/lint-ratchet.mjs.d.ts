export declare const BUDGET: Record<string, number>;

export interface RatchetLintMessage {
  ruleId: string | null;
  severity: number;
  line: number;
  message: string;
}

export interface RatchetLintFile {
  filePath: string;
  messages: RatchetLintMessage[];
}

export interface RatchetResult {
  errors: string[];
  warnings: Record<string, number>;
  failures: string[];
  improvements: string[];
  total: number;
  budgetTotal: number;
  ok: boolean;
}

export declare function evaluateRatchet(
  results: RatchetLintFile[],
  budget?: Record<string, number>,
): RatchetResult;
