/**
 * Event Bus — Vol. IV §6
 *
 * Tipizzato, con Dead Letter Queue e max 3 retry per handler.
 * Logging strutturato di ogni evento emesso/ricevuto.
 */

import type { DomainEvent } from "../core/domain/events";
import { createLogger } from "./internal-logger";

const logger = createLogger("EventBus");

// ── Types ────────────────────────────────────────────────────────────

export type EventHandler<T extends DomainEvent<string, unknown>> = (
  event: T,
) => void | Promise<void>;

interface Subscription {
  readonly eventType: string;
  readonly handler: EventHandler<DomainEvent<string, unknown>>;
  readonly id: string;
}

export interface DeadLetterEntry {
  readonly event: DomainEvent<string, unknown>;
  readonly error: string;
  readonly handlerId: string;
  readonly attempts: number;
  readonly lastAttemptAt: string;
}

// ── Constants ────────────────────────────────────────────────────────

const MAX_HANDLER_RETRIES = 3;

// ── State ────────────────────────────────────────────────────────────

let subscriptionCounter = 0;
const subscriptions: Subscription[] = [];
const deadLetterQueue: DeadLetterEntry[] = [];
const retryCountMap = new Map<string, number>();

// ── Public API ───────────────────────────────────────────────────────

export function subscribe<T extends DomainEvent<string, unknown>>(
  eventType: T["type"],
  handler: EventHandler<T>,
): string {
  const id = `sub_${++subscriptionCounter}`;
  subscriptions.push({
    eventType,
    handler: handler as EventHandler<DomainEvent<string, unknown>>,
    id,
  });
  logger.debug("subscribed", { eventType, subscriptionId: id });
  return id;
}

export function unsubscribe(subscriptionId: string): boolean {
  const index = subscriptions.findIndex((s) => s.id === subscriptionId);
  if (index === -1) return false;
  subscriptions.splice(index, 1);
  logger.debug("unsubscribed", { subscriptionId });
  return true;
}

export async function publish<T extends DomainEvent<string, unknown>>(
  event: T,
): Promise<void> {
  logger.info("event published", {
    eventType: event.type,
    correlationId: event.correlationId,
    source: event.source,
  });

  const handlers = subscriptions.filter((s) => s.eventType === event.type);

  for (const sub of handlers) {
    const retryKey = `${sub.id}:${event.correlationId}`;
    const attempts = retryCountMap.get(retryKey) ?? 0;

    if (attempts >= MAX_HANDLER_RETRIES) {
      pushToDeadLetter(event, "Max retries exceeded", sub.id, attempts);
      retryCountMap.delete(retryKey);
      continue;
    }

    try {
      await sub.handler(event);
      retryCountMap.delete(retryKey);
    } catch (caught: unknown) {
      const errorMessage =
        caught instanceof Error ? caught.message : String(caught);
      const newAttempts = attempts + 1;
      retryCountMap.set(retryKey, newAttempts);

      logger.warn("handler failed", {
        subscriptionId: sub.id,
        eventType: event.type,
        attempt: newAttempts,
        error: errorMessage,
      });

      if (newAttempts >= MAX_HANDLER_RETRIES) {
        pushToDeadLetter(event, errorMessage, sub.id, newAttempts);
        retryCountMap.delete(retryKey);
      }
    }
  }
}

export function getDeadLetterQueue(): ReadonlyArray<DeadLetterEntry> {
  return [...deadLetterQueue];
}

export function clearDeadLetterQueue(): void {
  deadLetterQueue.length = 0;
}

export function getSubscriptionCount(): number {
  return subscriptions.length;
}

/**
 * Reset completo — usato nei test.
 */
export function resetBus(): void {
  subscriptions.length = 0;
  deadLetterQueue.length = 0;
  retryCountMap.clear();
  subscriptionCounter = 0;
}

// ── Internal ─────────────────────────────────────────────────────────

function pushToDeadLetter(
  event: DomainEvent<string, unknown>,
  error: string,
  handlerId: string,
  attempts: number,
): void {
  deadLetterQueue.push({
    event,
    error,
    handlerId,
    attempts,
    lastAttemptAt: new Date().toISOString(),
  });
  logger.error("event moved to DLQ", {
    eventType: event.type,
    correlationId: event.correlationId,
    handlerId,
    attempts,
    error,
  });
}
