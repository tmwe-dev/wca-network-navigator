/**
 * Partner Bridge Handler — STEP 5
 *
 * Ascolta eventi partner dal bus, valida con domain rules,
 * chiama IO mutations, emette risultato.
 */

import { EventBus } from "../event-bus";
import { createEvent, type DomainEvent } from "@/v2/core/domain/events";
import { type Result, ok, err, isOk } from "@/v2/core/domain/result";
import { type AppError, ioError } from "@/v2/core/domain/errors";
import { validateCompanyName, validateCountryCode } from "@/v2/core/domain/validators";
import * as partnerMutations from "@/v2/io/supabase/mutations/partners";
import type { PartnerId } from "@/v2/core/domain/entities";
import { logV2 } from "@/v2/lib/logger";

// ── Types ────────────────────────────────────────────────────────────

interface PartnerCreatePayload {
  readonly companyName: string;
  readonly countryCode: string;
  readonly city?: string;
  readonly userId: string;
}

interface PartnerUpdatePayload {
  readonly partnerId: PartnerId;
  readonly changes: Record<string, unknown>;
}

// ── Registration ─────────────────────────────────────────────────────

export function registerPartnerBridge(bus: EventBus): void {
  bus.subscribe("partner.create.requested", async (event: DomainEvent) => {
    const payload = event.payload as PartnerCreatePayload;

    const nameCheck = validateCompanyName(payload.companyName);
    if (!isOk(nameCheck)) {
      bus.publish(createEvent("partner.create.failed", { reason: "invalid_name", ...payload }));
      return;
    }

    const countryCheck = validateCountryCode(payload.countryCode);
    if (!isOk(countryCheck)) {
      bus.publish(createEvent("partner.create.failed", { reason: "invalid_country", ...payload }));
      return;
    }

    const mutationResult = await partnerMutations.createPartner({
      company_name: payload.companyName,
      country_code: payload.countryCode,
      city: payload.city ?? null,
      user_id: payload.userId,
    });

    if (isOk(mutationResult)) {
      bus.publish(createEvent("partner.created", mutationResult.value));
      logV2("info", "partner-bridge", "Partner created via bridge", { companyName: payload.companyName });
    } else {
      bus.publish(createEvent("partner.create.failed", { reason: "io_error", error: mutationResult.error }));
    }
  });

  bus.subscribe("partner.update.requested", async (event: DomainEvent) => {
    const payload = event.payload as PartnerUpdatePayload;

    const mutationResult = await partnerMutations.updatePartner(payload.partnerId, payload.changes);

    if (isOk(mutationResult)) {
      bus.publish(createEvent("partner.updated", mutationResult.value));
    } else {
      bus.publish(createEvent("partner.update.failed", { partnerId: payload.partnerId, error: mutationResult.error }));
    }
  });

  bus.subscribe("partner.delete.requested", async (event: DomainEvent) => {
    const { partnerId } = event.payload as { partnerId: PartnerId };

    const mutationResult = await partnerMutations.deletePartner(partnerId);

    if (isOk(mutationResult)) {
      bus.publish(createEvent("partner.deleted", { partnerId }));
    } else {
      bus.publish(createEvent("partner.delete.failed", { partnerId, error: mutationResult.error }));
    }
  });
}
