/**
 * Agent Bridge Handler — STEP 5
 */

import { EventBus } from "../event-bus";
import { createEvent, type DomainEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import * as agentMutations from "@/v2/io/supabase/mutations/agents";
import type { AgentId } from "@/v2/core/domain/entities";
import { logV2 } from "@/v2/lib/logger";

interface AgentCreatePayload {
  readonly name: string;
  readonly role: string;
  readonly systemPrompt: string;
  readonly userId: string;
}

export function registerAgentBridge(bus: EventBus): void {
  bus.subscribe("agent.create.requested", async (event: DomainEvent) => {
    const payload = event.payload as AgentCreatePayload;

    const mutationResult = await agentMutations.createAgent({
      name: payload.name,
      role: payload.role,
      system_prompt: payload.systemPrompt,
      user_id: payload.userId,
    });

    if (isOk(mutationResult)) {
      bus.publish(createEvent("agent.created", mutationResult.value));
      logV2("info", "agent-bridge", "Agent created via bridge", { name: payload.name });
    } else {
      bus.publish(createEvent("agent.create.failed", { reason: "io_error", error: mutationResult.error }));
    }
  });

  bus.subscribe("agent.update.requested", async (event: DomainEvent) => {
    const { agentId, changes } = event.payload as { agentId: AgentId; changes: Record<string, unknown> };

    const mutationResult = await agentMutations.updateAgent(agentId, changes);

    if (isOk(mutationResult)) {
      bus.publish(createEvent("agent.updated", mutationResult.value));
    } else {
      bus.publish(createEvent("agent.update.failed", { agentId, error: mutationResult.error }));
    }
  });
}
