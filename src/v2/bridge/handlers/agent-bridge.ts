/**
 * Agent Bridge Handler — STEP 5
 */

import { subscribe, publish } from "../event-bus";
import { createEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import * as agentMutations from "@/v2/io/supabase/mutations/agents";
import { createLogger } from "@/v2/lib/logger";

const logger = createLogger("agent-bridge");

export function registerAgentBridge(): void {
  subscribe("agent.create.requested", async (event) => {
    const payload = event.payload as {
      name: string; role: string; systemPrompt: string; userId: string;
    };

    const mutationResult = await agentMutations.createAgent({
      name: payload.name,
      role: payload.role,
      system_prompt: payload.systemPrompt,
      user_id: payload.userId,
    });

    if (isOk(mutationResult)) {
      publish(createEvent("agent.created", { agentId: String(mutationResult.value.id) }, "agent-bridge"));
      logger.info("Agent created", { name: payload.name });
    } else {
      publish(createEvent("agent.create.failed", { reason: "io_error" }, "agent-bridge"));
    }
  });

  subscribe("agent.update.requested", async (event) => {
    const { agentId, changes } = event.payload as { agentId: string; changes: Record<string, unknown> };
    const mutationResult = await agentMutations.updateAgent(agentId, changes);

    if (isOk(mutationResult)) {
      publish(createEvent("agent.updated", { agentId }, "agent-bridge"));
    } else {
      publish(createEvent("agent.update.failed", { agentId }, "agent-bridge"));
    }
  });
}
