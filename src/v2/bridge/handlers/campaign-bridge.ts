/**
 * Campaign Bridge Handler — STEP 5
 */

import { subscribe, publish } from "../event-bus";
import { createEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import * as campaignMutations from "@/v2/io/supabase/mutations/campaigns";
import { createLogger } from "@/v2/lib/logger";

const logger = createLogger("campaign-bridge");

export function registerCampaignBridge(): void {
  subscribe("campaign.create.requested", async (event) => {
    const payload = event.payload as {
      batchId: string; partnerId: string; companyName: string;
      countryCode: string; countryName: string;
    };

    const mutationResult = await campaignMutations.createCampaignJob({
      batch_id: payload.batchId,
      partner_id: payload.partnerId,
      company_name: payload.companyName,
      country_code: payload.countryCode,
      country_name: payload.countryName,
    });

    if (isOk(mutationResult)) {
      publish(createEvent("campaign.created", { campaignJobId: String(mutationResult.value.id) }, "campaign-bridge"));
      logger.info("Campaign job created", { batchId: payload.batchId });
    } else {
      publish(createEvent("campaign.create.failed", { reason: "io_error" }, "campaign-bridge"));
    }
  });

  subscribe("campaign.update.requested", async (event) => {
    const { campaignJobId, changes } = event.payload as { campaignJobId: string; changes: Record<string, unknown> };
    const mutationResult = await campaignMutations.updateCampaignJob(campaignJobId, changes);

    if (isOk(mutationResult)) {
      publish(createEvent("campaign.updated", { campaignJobId }, "campaign-bridge"));
    } else {
      publish(createEvent("campaign.update.failed", { campaignJobId }, "campaign-bridge"));
    }
  });
}
