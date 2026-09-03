/**
 * Tool: run-prompt-test — esegue la suite di test per un prompt (o singolo test case).
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { mergePayload } from "./_helpers/writePayload";
import { runTests } from "@/data/promptTests";

type Payload = { prompt_id?: string; test_case_id?: string; [k: string]: unknown };

export const runPromptTestTool: Tool = {
  id: "run-prompt-test",
  label: "Esegui test prompt",
  description: "Esegue i test di regressione per un prompt operativo",
  match: (p) => /\b(esegui|lancia|run)\s+(?:il\s+|la\s+)?(test|regression)\s+(?:del\s+|dei\s+)?prompt/i.test(p),
  execute: async (prompt, context?: ToolContext): Promise<ToolResult> => {
    const id = prompt.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
    const payload = mergePayload<Payload>(context?.payload, { prompt_id: id });
    if (!context?.confirmed) {
      return {
        kind: "approval",
        title: "Eseguire test prompt?",
        description: "Verranno lanciati i test case attivi.",
        details: [
          { label: "Prompt", value: payload.prompt_id ?? "(tutti)" },
          ...(payload.test_case_id ? [{ label: "Test case", value: payload.test_case_id }] : []),
        ],
        governance: { role: "editor", permission: "EXECUTE:PROMPT_TESTS", policy: "prompt-test-run" },
        pendingPayload: payload,
        toolId: "run-prompt-test",
      };
    }
    const res = await runTests({
      prompt_id: payload.prompt_id,
      test_case_id: payload.test_case_id,
      trigger_source: "command",
    });
    const s = res.summary ?? { total: res.runs.length, passed: 0, failed: 0, error: 0, skipped: 0 };
    return {
      kind: "result",
      title: "🧪 Test eseguiti",
      message: `${s.total} test → ✅ ${s.passed} · ❌ ${s.failed} · ⚠ ${s.error}`,
      meta: { count: s.total, sourceLabel: "Prompt Lab · runner" },
    };
  },
};
