/**
 * IO Mutations: Agents — Result-based CRUD
 */
import { supabase } from "@/integrations/supabase/client";
import { type Result, ok, err } from "../../../core/domain/result";
import { ioError, fromUnknown, type AppError } from "../../../core/domain/errors";
import { type Agent } from "../../../core/domain/entities";
import { mapAgentRow } from "../../../core/mappers/agent-mapper";

export interface CreateAgentInput {
  readonly user_id: string;
  readonly name: string;
  readonly role?: string;
  readonly system_prompt?: string;
  readonly avatar_emoji?: string;
}

export async function createAgent(
  input: CreateAgentInput,
): Promise<Result<Agent, AppError>> {
  try {
    const { data, error } = await supabase
      .from("agents")
      .insert(input)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "agents", operation: "insert",
      }, "createAgent"));
    }

    return mapAgentRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createAgent"));
  }
}

export async function updateAgent(
  agentId: string,
  updates: Partial<Omit<CreateAgentInput, "user_id">>,
): Promise<Result<Agent, AppError>> {
  try {
    const { data, error } = await supabase
      .from("agents")
      .update(updates)
      .eq("id", agentId)
      .select()
      .single();

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "agents", agentId, operation: "update",
      }, "updateAgent"));
    }

    return mapAgentRow(data);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateAgent"));
  }
}

export async function deleteAgent(
  agentId: string,
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", agentId);

    if (error) {
      return err(ioError("DATABASE_ERROR", error.message, {
        table: "agents", agentId, operation: "delete",
      }, "deleteAgent"));
    }

    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteAgent"));
  }
}
