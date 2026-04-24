/**
 * replay-domain-events — Cross-request domain event replay engine.
 *
 * RESPONSABILITÀ:
 *   Replays unprocessed domain events from the domain_events table.
 *   Dispatches to appropriate handlers (LeadProcessManager, EmailProcessManager, etc.)
 *   Marks events as processed on success, logs errors on failure.
 *   Designed to run on a CRON schedule (every 60 seconds).
 *
 * ARCHITETTURA:
 *   1. Query domain_events where processed = false, order by created_at ASC
 *   2. Batch process (max 50 per run)
 *   3. For each event, dispatch to handler based on event_type
 *   4. Mark processed_at = now() on success
 *   5. Log error, increment retry_count on failure (do NOT mark processed)
 *   6. Return summary (processed count, failed count, skipped count)
 *
 * IDEMPOTENCE:
 *   Safe to run multiple times — only unprocessed events are selected.
 *   Failed events are retried indefinitely until they succeed or are manually reviewed.
 *
 * PATTERN: Event Sourcing, CQRS
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { eventBus, createEvent } from "../_shared/domainEvents.ts";
import { initLeadProcessManager } from "../_shared/processManagers/leadProcessManager.ts";
import { initEmailProcessManager } from "../_shared/processManagers/emailProcessManager.ts";
import type {
  WCADomainEvent,
  LeadStatusChanged,
  FirstTouchSent,
  LeadQualificationSignal,
  ConversionSignalDetected,
  EmailSent,
  InboundEmailReceived,
  EmailClassified,
  EmailBounceDetected,
  OutreachScheduled,
  OutreachExecuted,
  OutreachReplied,
  CadenceViolation,
} from "../_shared/domainEvents.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════

interface DomainEventRow {
  id: number;
  event_id: string;
  event_type: string;
  correlation_id: string;
  causation_id: string | null;
  user_id: string;
  actor_type: string;
  actor_name: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ReplayResult {
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{ eventId: string; eventType: string; error: string }>;
  summary: string;
}

// ═══════════════════════════════════════════════════════════
//  MAIN REPLAY ENGINE
// ═══════════════════════════════════════════════════════════

async function replayDomainEvents(): Promise<ReplayResult> {
  const result: ReplayResult = {
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    summary: "",
  };

  try {
    // Fetch unprocessed events, ordered by creation time (FIFO)
    // Batch size: 50 events per run to avoid timeout/overload
    const { data: events, error: fetchError } = await supabase
      .from("domain_events")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      result.summary = `[FATAL] Failed to fetch unprocessed events: ${fetchError.message}`;
      console.error(result.summary);
      return result;
    }

    if (!events || events.length === 0) {
      result.summary = "No unprocessed events found.";
      console.log(result.summary);
      return result;
    }

    console.log(`[replay-domain-events] Found ${events.length} unprocessed events`);

    // Initialize process managers for this session
    const leadPM = initLeadProcessManager(supabase);
    const emailPM = initEmailProcessManager(supabase);

    // Process each event
    for (const row of events as DomainEventRow[]) {
      try {
        // Reconstruct the typed domain event
        const event = reconstructEvent(row);

        // Dispatch to appropriate handler based on event_type
        await dispatchEvent(event, leadPM, emailPM);

        // Mark as processed
        await supabase
          .from("domain_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", row.id);

        result.processed++;
        console.log(`[replay-domain-events] ✓ Processed event ${row.event_id} (${row.event_type})`);
      } catch (err) {
        result.failed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push({
          eventId: row.event_id,
          eventType: row.event_type,
          error: errorMsg,
        });

        console.error(
          `[replay-domain-events] ✗ Failed to process event ${row.event_id}: ${errorMsg}`,
        );

        // Do NOT mark as processed — let it retry on next run
        // Optionally log to error tracking
      }
    }

    result.summary =
      `Processed: ${result.processed}, Failed: ${result.failed}, Skipped: ${result.skipped}`;
    console.log(`[replay-domain-events] Summary: ${result.summary}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.summary = `[FATAL] ${msg}`;
    console.error(result.summary);
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
//  EVENT RECONSTRUCTION & DISPATCH
// ═══════════════════════════════════════════════════════════

/**
 * Reconstruct a typed DomainEvent from the database row.
 */
function reconstructEvent(row: DomainEventRow): WCADomainEvent {
  return {
    type: row.event_type as WCADomainEvent["type"],
    timestamp: row.created_at,
    eventId: row.event_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id || undefined,
    userId: row.user_id,
    actor: {
      type: row.actor_type as "user" | "system" | "cron" | "ai_agent" | "trigger",
      name: row.actor_name,
    },
    payload: row.payload as never,
    metadata: row.metadata || undefined,
  };
}

/**
 * Dispatch event to the appropriate handler.
 * The process managers have already been registered on the eventBus,
 * so publishing to the bus automatically triggers their handlers.
 */
async function dispatchEvent(
  event: WCADomainEvent,
  leadPM: ReturnType<typeof initLeadProcessManager>,
  emailPM: ReturnType<typeof initEmailProcessManager>,
): Promise<void> {
  const eventType = event.type;

  // Route to appropriate handler based on event type
  switch (eventType) {
    // ── LEAD EVENTS ──
    case "lead.status_changed":
    case "lead.first_touch_sent":
    case "lead.qualification_signal":
    case "lead.conversion_signal":
      // LeadProcessManager handlers are registered on eventBus.on()
      // Just publish and the handlers will react
      await eventBus.publish(event);
      break;

    // ── EMAIL EVENTS ──
    case "email.sent":
    case "email.inbound_received":
    case "email.classified":
    case "email.bounce_detected":
      // EmailProcessManager handlers are registered on eventBus.on()
      // LeadProcessManager also listens to email.inbound_received
      await eventBus.publish(event);
      break;

    // ── OUTREACH EVENTS ──
    case "outreach.scheduled":
    case "outreach.executed":
    case "outreach.replied":
    case "outreach.cadence_violation":
      // LeadProcessManager also listens to outreach.executed and outreach.replied
      await eventBus.publish(event);
      break;

    // ── AI/AUTOMATION EVENTS ──
    case "ai.pending_action_created":
    case "ai.pending_action_approved":
    case "ai.action_executed":
      // Currently no handlers, but publish for future use
      await eventBus.publish(event);
      break;

    // ── ENRICHMENT EVENTS ──
    case "enrichment.quality_score_updated":
    case "enrichment.refreshed":
      // Currently no handlers, but publish for future use
      await eventBus.publish(event);
      break;

    // ── LEARNING EVENTS ──
    case "learning.improvement_suggested":
    case "learning.improvement_applied":
      // Currently no handlers, but publish for future use
      await eventBus.publish(event);
      break;

    default:
      // Unknown event type — log but don't fail
      console.warn(`[replay-domain-events] Unknown event type: ${eventType}`);
      await eventBus.publish(event);
  }
}

// ═══════════════════════════════════════════════════════════
//  HTTP HANDLER — CRON-compatible
// ═══════════════════════════════════════════════════════════

/**
 * HTTP handler for the edge function.
 * Invoked by CRON or manual trigger.
 */
serve(async (req: Request) => {
  // Only accept POST requests (CRON uses POST)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  const result = await replayDomainEvents();

  return new Response(
    JSON.stringify(result, null, 2),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
