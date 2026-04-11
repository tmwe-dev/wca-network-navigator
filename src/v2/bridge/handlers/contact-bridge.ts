/**
 * Contact Bridge Handler — STEP 5
 */

import { subscribe, publish } from "../event-bus";
import { createEvent } from "@/v2/core/domain/events";
import { isOk } from "@/v2/core/domain/result";
import { validateEmail } from "@/v2/core/domain/validators";
import * as contactMutations from "@/v2/io/supabase/mutations/contacts";
import { createLogger } from "@/v2/lib/logger";

const logger = createLogger("contact-bridge");

export function registerContactBridge(): void {
  subscribe("contact.create.requested", async (event) => {
    const payload = event.payload as {
      name: string; email?: string; companyName?: string; importLogId: string;
    };

    if (payload.email) {
      const emailCheck = validateEmail(payload.email);
      if (!isOk(emailCheck)) {
        publish(createEvent("contact.create.failed", { reason: "invalid_email" }, "contact-bridge"));
        return;
      }
    }

    const mutationResult = await contactMutations.createContact({
      name: payload.name,
      email: payload.email ?? undefined,
      company_name: payload.companyName ?? undefined,
      import_log_id: payload.importLogId,
    });

    if (isOk(mutationResult)) {
      publish(createEvent("contact.created", { contactId: String(mutationResult.value.id) }, "contact-bridge"));
      logger.info("Contact created", { name: payload.name });
    } else {
      publish(createEvent("contact.create.failed", { reason: "io_error" }, "contact-bridge"));
    }
  });

  subscribe("contact.update.requested", async (event) => {
    const { contactId, changes } = event.payload as { contactId: string; changes: Record<string, unknown> };
    const mutationResult = await contactMutations.updateContact(contactId, changes);

    if (isOk(mutationResult)) {
      publish(createEvent("contact.updated", { contactId }, "contact-bridge"));
    } else {
      publish(createEvent("contact.update.failed", { contactId }, "contact-bridge"));
    }
  });
}
