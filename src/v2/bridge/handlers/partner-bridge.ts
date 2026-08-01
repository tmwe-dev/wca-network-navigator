/**
 * Partner Bridge Handler — STEP 5
 */

import { subscribe, publish } from "../event-bus";
import { createEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import { validateCompanyName, validateCountryCode } from "@/v2/core/domain/validators";
import * as partnerMutations from "@/v2/io/supabase/mutations/partners";
import { createLogger } from "@/v2/lib/logger";

const logger = createLogger("partner-bridge");

export function registerPartnerBridge(): void {
  subscribe("partner.create.requested", async (event) => {
    const payload = event.payload as {
      companyName: string; countryCode: string; countryName: string; city: string; userId: string;
    };

    const nameCheck = validateCompanyName(payload.companyName);
    if (!isOk(nameCheck)) {
      publish(createEvent("partner.create.failed", { reason: "invalid_name" }, "partner-bridge"));
      return;
    }

    const countryCheck = validateCountryCode(payload.countryCode);
    if (!isOk(countryCheck)) {
      publish(createEvent("partner.create.failed", { reason: "invalid_country" }, "partner-bridge"));
      return;
    }

    const mutationResult = await partnerMutations.createPartner({
      company_name: payload.companyName,
      country_code: payload.countryCode,
      country_name: payload.countryName,
      city: payload.city,
      user_id: payload.userId,
    });

    if (isOk(mutationResult)) {
      publish(createEvent("partner.created", { partnerId: String(mutationResult.value.id) }, "partner-bridge"));
      logger.info("Partner created", { companyName: payload.companyName });
    } else {
      publish(createEvent("partner.create.failed", { reason: "io_error" }, "partner-bridge"));
    }
  });

  subscribe("partner.delete.requested", async (event) => {
    const { partnerId } = event.payload as { partnerId: string };
    const mutationResult = await partnerMutations.deletePartner(partnerId);

    if (isOk(mutationResult)) {
      publish(createEvent("partner.deleted", { partnerId }, "partner-bridge"));
    } else {
      publish(createEvent("partner.delete.failed", { partnerId }, "partner-bridge"));
    }
  });
}
