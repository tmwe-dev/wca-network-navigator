/**
 * IO Mutations: Agents — facciata Result-based sul DAL canonico `src/data/agents`.
 */
import {
  createAgent as dalCreateAgent,
  updateAgent as dalUpdateAgent,
  deleteAgent as dalDeleteAgent,
  getAgentById,
} from "@/data/agents";
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

export async function createAgent(input: CreateAgentInput): Promise<Result<Agent, AppError>> {
  try {
    const row = await dalCreateAgent(input);
    return mapAgentRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "createAgent"));
  }
}

export async function updateAgent(
  agentId: string,
  updates: Partial<Omit<CreateAgentInput, "user_id">>,
): Promise<Result<Agent, AppError>> {
  try {
    await dalUpdateAgent(agentId, updates);
    const row = await getAgentById(agentId);
    if (!row) {
      return err(
        ioError(
          "NOT_FOUND",
          `Agent ${agentId} non trovato`,
          {
            table: "agents",
            agentId,
            operation: "update",
          },
          "updateAgent",
        ),
      );
    }
    return mapAgentRow(row);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "updateAgent"));
  }
}

export async function deleteAgent(agentId: string): Promise<Result<void, AppError>> {
  try {
    await dalDeleteAgent(agentId);
    return ok(undefined);
  } catch (caught: unknown) {
    return err(fromUnknown(caught, "DATABASE_ERROR", "deleteAgent"));
  }
}
