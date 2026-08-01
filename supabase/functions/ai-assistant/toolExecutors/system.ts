/**
 * system.ts — System-level tools like KB audits.
 * Handles run_kb_audit tool.
 */

import { extractErrorMessage } from "../../_shared/handleEdgeError.ts";

export async function executeRunKbAudit(
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const level = String(args.audit_level || "all");
  try {
    const resp = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/kb-supervisor`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
          }`,
        },
        body: JSON.stringify({ user_id: userId, audit_level: level }),
      },
    );
    const result = await resp.json();
    if (!resp.ok) return { error: result.error || "Audit failed" };
    return {
      success: true,
      summary: result.summary,
      issues: result.results,
      message: `Audit KB completato: ${
        result.summary?.total_issues || 0
      } problemi trovati (${result.summary?.critical || 0} critici, ${
        result.summary?.high || 0
      } alti).`,
    };
  } catch (err: unknown) {
    return { error: extractErrorMessage(err) };
  }
}
