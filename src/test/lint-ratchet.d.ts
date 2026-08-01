declare module "*/scripts/lint-ratchet.mjs" {
  export const BUDGET: Record<string, number>;
  export function evaluateRatchet(
    results: Array<{ filePath: string; messages: Array<{ ruleId: string | null; severity: number; line: number; message: string }> }>,
    budget?: Record<string, number>,
  ): {
    errors: string[];
    warnings: Record<string, number>;
    failures: string[];
    improvements: string[];
    total: number;
    budgetTotal: number;
    ok: boolean;
  };
}
