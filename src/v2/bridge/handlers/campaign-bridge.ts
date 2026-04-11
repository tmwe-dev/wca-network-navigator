/**
 * Campaign Bridge Handler — STEP 5
 */

import { EventBus } from "../event-bus";
import { createEvent, type DomainEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import { validateDateRange } from "@/v2/core/domain/validators";
import * as campaignMutations from "@/v2/io/supabase/mutations/campaigns";
import type { CampaignId } from "@/v2/core/domain/entities";
import { logV2 } from "@/v2/lib/logger";

interface CampaignCreatePayload {
  readonly name: string;
  readonly channel: string;
  readonly targetFilters: Record<string, unknown>;
  readonly userId: string;
}

export function registerCampaignBridge(bus: EventBus): void {
  bus.subscribe("campaign.create.requested", async (event: DomainEvent) => {
    const payload = event.payload as CampaignCreatePayload;

    const mutationResult = await campaignMutations.createCampaign({
      title: payload.name,
      channel: payload.channel,
      target_filters: payload.targetFilters,
      user_id: payload.userId,
    });

    if (isOk(mutationResult)) {
      bus.publish(createEvent("campaign.created", mutationResult.value));
      logV2("info", "campaign-bridge", "Campaign created via bridge", { name: payload.name });
    } else {
      bus.publish(createEvent("campaign.create.failed", { reason: "io_error", error: mutationResult.error }));
    }
  });

  bus.subscribe("campaign.update.requested", async (event: DomainEvent) => {
    const { campaignId, changes } = event.payload as { campaignId: CampaignId; changes: Record<string, unknown> };

    const mutationResult = await campaignMutations.updateCampaign(campaignId, changes);

    if (isOk(mutationResult)) {
      bus.publish(createEvent("campaign.updated", mutationResult.value));
    } else {
      bus.publish(createEvent("campaign.update.failed", { campaignId, error: mutationResult.error }));
    }
  });
}
