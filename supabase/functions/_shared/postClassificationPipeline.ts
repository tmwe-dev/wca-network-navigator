/**
 * postClassificationPipeline.ts — Orchestrator for post-classification actions (LOVABLE-86).
 *
 * After classify-email-response classifies an inbound email, this pipeline decides
 * and executes appropriate actions based on classification domain and category.
 *
 * Refactored into focused modules:
 * - classificationRules.ts: Email address rules + draft generation
 * - emailRouter.ts: Commercial domain category handlers
 * - bounceAndUnsubscribeHandler.ts: Bounce + unsubscribe logic
 * - questionAndComplaintHandler.ts: Question + complaint + OOO logic
 * - domainHandler.ts: Domain-specific handlers (operative, administrative, support, internal)
 * - senderGrouping.ts: Auto-suggestion for sender groups
 */

import { loadEmailAddressRules, type EmailAddressRule } from "./classificationRules.ts";
import { handleInterested, handleNotInterested, handleFollowUp, type RouterInput } from "./emailRouter.ts";
import { handleBounce, handleUnsubscribe, type BounceHandlerInput } from "./bounceAndUnsubscribeHandler.ts";
import { handleQuestion, handleComplaint, handleOutOfOffice, type QuestionComplaintInput } from "./questionAndComplaintHandler.ts";
import {
  handleOperativeRequest,
  handleAdministrativeRequest,
  handleSupportRequest,
  handleInternalMessage,
  type DomainHandlerInput,
} from "./domainHandler.ts";
import { suggestGroupForSender } from "./senderGrouping.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export type ClassificationCategory =
  | "interested"
  | "not_interested"
  | "request_info"
  | "question"
  | "meeting_request"
  | "complaint"
  | "follow_up"
  | "auto_reply"
  | "unsubscribe"
  | "bounce"
  | "spam"
  | "uncategorized"
  | "quote_request"
  | "booking_request"
  | "rate_inquiry"
  | "shipment_tracking"
  | "cargo_status"
  | "documentation_request"
  | "invoice_query"
  | "payment_request"
  | "payment_confirmation"
  | "credit_note"
  | "account_statement"
  | "service_inquiry"
  | "technical_issue"
  | "feedback"
  | "newsletter"
  | "system_notification"
  | "internal_communication";

export type ClassificationDomain =
  | "commercial"
  | "operative"
  | "administrative"
  | "support"
  | "internal";

export interface ClassificationInput {
  userId: string;
  partnerId?: string | null;
  contactId?: string | null;
  category: ClassificationCategory;
  confidence: number;
  senderEmail: string;
  senderName?: string;
  subject?: string;
  aiSummary?: string;
  urgency?: number;
  sentiment?: string;
  channel?: "email" | "whatsapp" | "linkedin";
  oooReturnDate?: string;
  emailAddressRule?: EmailAddressRule;
  domain?: ClassificationDomain;
}

export interface PostClassificationResult {
  actionsExecuted: string[];
  statusChanged: boolean;
  pendingActionCreated: boolean;
  reminderCreated: boolean;
  errors: string[];
}

/**
 * Main pipeline orchestrator. Call AFTER classification.
 */
export async function runPostClassificationPipeline(
  supabase: SupabaseClient,
  input: ClassificationInput,
): Promise<PostClassificationResult> {
  const result: PostClassificationResult = {
    actionsExecuted: [],
    statusChanged: false,
    pendingActionCreated: false,
    reminderCreated: false,
    errors: [],
  };

  try {
    // Load email_address_rules for sender
    const addressRule = await loadEmailAddressRules(supabase, input.userId, input.senderEmail);

    // Enrich input with email_address_rules context
    const enrichedInput = {
      ...input,
      emailAddressRule: addressRule || undefined,
    };

    // Suggest group for sender if applicable
    await suggestGroupForSender(
      supabase,
      input.userId,
      input.senderEmail,
      input.category,
      input.confidence,
    ).catch((e) => {
      console.warn("[postClassification] Group suggestion error (non-blocking):", e);
    });

    // Route by domain first (operative/admin/support/internal)
    const domain = enrichedInput.domain || "commercial";
    if (domain !== "commercial") {
      const domainInput: DomainHandlerInput = {
        userId: enrichedInput.userId,
        partnerId: enrichedInput.partnerId,
        category: enrichedInput.category,
        confidence: enrichedInput.confidence,
        senderEmail: enrichedInput.senderEmail,
        senderName: enrichedInput.senderName,
        subject: enrichedInput.subject,
        aiSummary: enrichedInput.aiSummary,
        urgency: enrichedInput.urgency,
        sentiment: enrichedInput.sentiment,
        emailAddressRule: enrichedInput.emailAddressRule,
      };

      switch (domain) {
        case "operative":
          await handleOperativeRequest(supabase, domainInput, result);
          break;
        case "administrative":
          await handleAdministrativeRequest(supabase, domainInput, result);
          break;
        case "support":
          await handleSupportRequest(supabase, domainInput, result, (s, i, r) =>
            handleComplaint(s, i as QuestionComplaintInput, r)
          );
          break;
        case "internal":
          await handleInternalMessage(supabase, domainInput, result);
          break;
      }
    } else {
      // Commercial domain: route by category
      const routerInput: RouterInput = {
        userId: enrichedInput.userId,
        partnerId: enrichedInput.partnerId,
        category: enrichedInput.category,
        confidence: enrichedInput.confidence,
        senderEmail: enrichedInput.senderEmail,
        senderName: enrichedInput.senderName,
        subject: enrichedInput.subject,
        aiSummary: enrichedInput.aiSummary,
        urgency: enrichedInput.urgency,
        sentiment: enrichedInput.sentiment,
        emailAddressRule: enrichedInput.emailAddressRule,
      };

      switch (input.category) {
        case "interested":
        case "meeting_request":
          await handleInterested(supabase, routerInput, result);
          break;

        case "not_interested":
          await handleNotInterested(supabase, routerInput, result);
          break;

        case "auto_reply":
          const oooInput: QuestionComplaintInput = {
            userId: enrichedInput.userId,
            partnerId: enrichedInput.partnerId,
            contactId: enrichedInput.contactId,
            category: enrichedInput.category,
            confidence: enrichedInput.confidence,
            senderEmail: enrichedInput.senderEmail,
            senderName: enrichedInput.senderName,
            subject: enrichedInput.subject,
            aiSummary: enrichedInput.aiSummary,
            urgency: enrichedInput.urgency,
            sentiment: enrichedInput.sentiment,
            emailAddressRule: enrichedInput.emailAddressRule,
          };
          await handleOutOfOffice(supabase, oooInput, result);
          break;

        case "bounce":
          const bounceInput: BounceHandlerInput = {
            userId: enrichedInput.userId,
            partnerId: enrichedInput.partnerId,
            confidence: enrichedInput.confidence,
            senderEmail: enrichedInput.senderEmail,
            category: enrichedInput.category,
            aiSummary: enrichedInput.aiSummary,
          };
          await handleBounce(supabase, bounceInput, result);
          break;

        case "unsubscribe":
          const unsubInput: BounceHandlerInput = {
            userId: enrichedInput.userId,
            partnerId: enrichedInput.partnerId,
            confidence: enrichedInput.confidence,
            senderEmail: enrichedInput.senderEmail,
            category: enrichedInput.category,
            aiSummary: enrichedInput.aiSummary,
          };
          await handleUnsubscribe(supabase, unsubInput, result);
          break;

        case "question":
        case "request_info":
          const questionInput: QuestionComplaintInput = {
            userId: enrichedInput.userId,
            partnerId: enrichedInput.partnerId,
            contactId: enrichedInput.contactId,
            category: enrichedInput.category,
            confidence: enrichedInput.confidence,
            senderEmail: enrichedInput.senderEmail,
            senderName: enrichedInput.senderName,
            subject: enrichedInput.subject,
            aiSummary: enrichedInput.aiSummary,
            urgency: enrichedInput.urgency,
            sentiment: enrichedInput.sentiment,
            emailAddressRule: enrichedInput.emailAddressRule,
          };
          await handleQuestion(supabase, questionInput, result);
          break;

        case "complaint":
          const complaintInput: QuestionComplaintInput = {
            userId: enrichedInput.userId,
            partnerId: enrichedInput.partnerId,
            contactId: enrichedInput.contactId,
            category: enrichedInput.category,
            confidence: enrichedInput.confidence,
            senderEmail: enrichedInput.senderEmail,
            senderName: enrichedInput.senderName,
            subject: enrichedInput.subject,
            aiSummary: enrichedInput.aiSummary,
            urgency: enrichedInput.urgency,
            sentiment: enrichedInput.sentiment,
            emailAddressRule: enrichedInput.emailAddressRule,
          };
          await handleComplaint(supabase, complaintInput, result);
          break;

        case "follow_up":
          await handleFollowUp(supabase, routerInput, result);
          break;

        case "spam":
        case "uncategorized":
          result.actionsExecuted.push("skip_no_action");
          break;
      }
    }
  } catch (e) {
    result.errors.push(`Pipeline error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return result;
}
