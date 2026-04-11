/**
 * IO Queries: Agents — Result-based
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Agent } from "../../../core/domain/entities";
import { mapAgentRow } from "../../../core/mappers/agent-mapper";

export async function fetchAgents(): Promise<Result<Agent[], AppError>> {
  try {
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "agents",
      }, "fetchAgents"));
    }

    if (!data) return ok([]);

    const agents: Agent[] = [];
    for (const row of data) {
      const mapped = mapAgentRow(row);
      if (mapped._tag === "Err") return mapped;
      agents.push(mapped.value);
    }
    return ok(agents);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "fetchAgents"));
  }
}
