/**
 * Contact Domain Rules — STEP 7
 */

import { type Result, ok, err } from "../result";
import { domainError, type AppError } from "../errors";
import type { Contact } from "../entities";

export function contactCompletenessScore(contact: Contact): number {
  let score = 0;
  const weights = [
    { field: contact.name, points: 20 },
    { field: contact.email, points: 20 },
    { field: contact.companyName, points: 15 },
    { field: contact.phone, points: 10 },
    { field: contact.mobile, points: 10 },
    { field: contact.position, points: 10 },
    { field: contact.city, points: 5 },
    { field: contact.country, points: 5 },
    { field: contact.origin, points: 5 },
  ];

  for (const weight of weights) {
    if (weight.field != null && weight.field !== "") {
      score += weight.points;
    }
  }

  return score;
}

export function validateContactForOutreach(contact: Contact): Result<Contact, AppError> {
  if (!contact.email) {
    return err(domainError(
      "BUSINESS_RULE_VIOLATED",
      "Contact must have an email for outreach",
      { contactId: String(contact.id) },
    ));
  }

  return ok(contact);
}

export function isContactTransferEligible(contact: Contact): boolean {
  if (contact.isTransferred) return false;
  if (!contact.email && !contact.phone) return false;
  return contactCompletenessScore(contact) >= 40;
}
