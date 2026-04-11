/**
 * Contact Bridge Handler — STEP 5
 */

import { EventBus } from "../event-bus";
import { createEvent, type DomainEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import { validateEmail } from "@/v2/core/domain/validators";
import * as contactMutations from "@/v2/io/supabase/mutations/contacts";
import type { ContactId } from "@/v2/core/domain/entities";
import { logV2 } from "@/v2/lib/logger";

interface ContactCreatePayload {
  readonly name: string;
  readonly email?: string;
  readonly companyName?: string;
  readonly importLogId: string;
  readonly userId: string;
}

export function registerContactBridge(bus: EventBus): void {
  bus.subscribe("contact.create.requested", async (event: DomainEvent) => {
    const payload = event.payload as ContactCreatePayload;

    if (payload.email) {
      const emailCheck = validateEmail(payload.email);
      if (!isOk(emailCheck)) {
        bus.publish(createEvent("contact.create.failed", { reason: "invalid_email", ...payload }));
        return;
      }
    }

    const mutationResult = await contactMutations.createContact({
      name: payload.name,
      email: payload.email ?? null,
      company_name: payload.companyName ?? null,
      import_log_id: payload.importLogId,
      user_id: payload.userId,
    });

    if (isOk(mutationResult)) {
      bus.publish(createEvent("contact.created", mutationResult.value));
      logV2("info", "contact-bridge", "Contact created via bridge", { name: payload.name });
    } else {
      bus.publish(createEvent("contact.create.failed", { reason: "io_error", error: mutationResult.error }));
    }
  });

  bus.subscribe("contact.update.requested", async (event: DomainEvent) => {
    const { contactId, changes } = event.payload as { contactId: ContactId; changes: Record<string, unknown> };

    const mutationResult = await contactMutations.updateContact(contactId, changes);

    if (isOk(mutationResult)) {
      bus.publish(createEvent("contact.updated", mutationResult.value));
    } else {
      bus.publish(createEvent("contact.update.failed", { contactId, error: mutationResult.error }));
    }
  });
}
