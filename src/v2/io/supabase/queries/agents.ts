/**
 * IO Queries: Agents — facciata Result-based sul DAL canonico `src/data/agents`.
 * Nessuna query Supabase diretta: qui si applicano solo mapping e semantica Result.
 */
import { findAgents, getAgentById, type AgentRow as DalAgentRow } from "@/data/agents";
import { type Result, ok, err } from "../../../core/domain/result";
import { fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Agent } from "../../../core/domain/entities";
import { mapAgentRow } from "../../../core/mappers/agent-mapper";
import type { PostgrestError } from "@supabase/supabase-js";

export type AgentRow = DalAgentRow;

export async function fetchAgents(): Promise<Result<Agent[], AppError>> {
  try {
    const rows = await findAgents();
    const agents: Agent[] = [];
    for (const row of rows) {
      const mapped = mapAgentRow(row);
      if (mapped._tag === "Err") return mapped;
      agents.push(mapped.value);
    }
    return ok(agents);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchAgents"));
  }
}

/* ── Raw single-agent fetch (chat hub) ─────────────────── */
export async function fetchAgentByIdRaw(agentId: string): Promise<{
  data: AgentRow | null;
  error: PostgrestError | null;
}> {
  try {
    const row = await getAgentById(agentId);
    return { data: row, error: null };
  } catch (caught: unknown) {
    const appErr = fromUnknown(caught, "DATABASE_ERROR", "fetchAgentByIdRaw");
    return {
      data: null,
      error: {
        message: appErr.message,
        details: "",
        hint: "",
        code: "DATABASE_ERROR",
        name: "PostgrestError",
      } as PostgrestError,
    };
  }
}
