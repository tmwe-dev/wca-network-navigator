/**
 * Telemetry — lightweight client-side event tracking.
 *
 * Writes to public.page_events. Fire-and-forget, never blocks UI.
 * Use trackPage() in route layouts and trackEvent() on user actions.
 *
 * Backend: see migration 20260408095954_wave6_hardening_telemetry_staff.sql
 */
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("telemetry");

const SESSION_KEY = "wca_telemetry_session";

function getSessionId(): string {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return `s_${Date.now()}`;
  }
}

export interface TrackOptions {
  page?: string;
  entityType?: string;
  entityId?: string;
  props?: Record<string, unknown>;
  durationMs?: number;
}

let userIdCache: string | null | undefined = undefined;
async function getUserId(): Promise<string | null> {
  if (userIdCache !== undefined) return userIdCache;
  try {
    const { data } = await supabase.auth.getUser();
    userIdCache = data?.user?.id ?? null;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    userIdCache = null;
  }
  return userIdCache;
}

/** Reset cached user id (call on logout) */
export function resetTelemetryUser() {
  userIdCache = undefined;
}

/** Internal: insert one event row, never throws */
async function insert(
  eventName: string,
  page: string,
  opts: TrackOptions = {}
): Promise<void> {
  try {
    const userId = await getUserId();
    const payload = {
      user_id: userId,
      session_id: getSessionId(),
      event_name: eventName,
      page,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      props: opts.props ?? {},
      duration_ms: opts.durationMs ?? null,
    };
    // intentionally not awaited in caller — fire and forget
    await supabase.from("page_events" as any).insert(payload as any);
  } catch (e) {
    if (typeof console !== "undefined") {
      console.debug("[telemetry] insert failed", e);
    }
  }
}

/** Track a page view. Call in route layouts on mount. */
export function trackPage(page: string, props?: Record<string, unknown>): void {
  void insert("page_view", page, { props });
}

/** Track an arbitrary user event. */
export function trackEvent(
  eventName: string,
  opts: TrackOptions = {}
): void {
  const page = opts.page ?? (typeof window !== "undefined" ? window.location.pathname : "unknown");
  void insert(eventName, page, opts);
}

/** Track an entity open (drawer, detail panel, etc.) */
export function trackEntityOpen(
  entityType: string,
  entityId: string,
  page?: string
): void {
  trackEvent("entity_open", { entityType, entityId, page });
}

/** Track an action with optional duration */
export function trackAction(
  actionName: string,
  props?: Record<string, unknown>,
  durationMs?: number
): void {
  trackEvent(`action.${actionName}`, { props, durationMs });
}

/** Wrap an async function with timing telemetry */
export async function withTelemetry<T>(
  actionName: string,
  fn: () => Promise<T>,
  props?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    trackAction(actionName, { ...props, ok: true }, Math.round(performance.now() - start));
    return result;
  } catch (e: any) {
    trackAction(
      actionName,
      { ...props, ok: false, error: e?.message ?? String(e) },
      Math.round(performance.now() - start)
    );
    throw e;
  }
}
