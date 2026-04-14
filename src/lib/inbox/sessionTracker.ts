/**
 * Session Tracker — stato di sessione per i 3 canali, persistito
 * in `app_settings` chiave `channel_session:<channel>` (JSON).
 *
 * Vol. II §11.3 (osservabilità) — abilita audit trail, indicatori
 * UI di salute, e recovery automatico.
 *
 * Ogni canale può chiamare:
 *   await markSessionAlive("whatsapp")
 *   await markSessionExpired("linkedin", "cookie scaduto")
 *   const s = await getSessionStatus("email")
 */

import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import type { ChannelKind, ChannelSession, SessionStatus } from "./types";

const log = createLogger("sessionTracker");

const KEY_PREFIX = "channel_session:";

function keyFor(channel: ChannelKind): string {
  return `${KEY_PREFIX}${channel}`;
}

export async function getSessionStatus(channel: ChannelKind): Promise<ChannelSession> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", keyFor(channel))
    .maybeSingle();

  if (error) {
    log.warn("session.read_failed", { channel, error: error.message });
    return defaultSession(channel, "unknown");
  }
  if (!data?.value) return defaultSession(channel, "unknown");

  try {
    const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
    return {
      channel,
      status: (parsed.status as SessionStatus) ?? "unknown",
      last_seen_at: parsed.last_seen_at ?? null,
      last_error: parsed.last_error ?? null,
      metadata: parsed.metadata ?? {},
    };
  } catch (err) {
    log.error("session.parse_failed", {
      channel,
      error: err instanceof Error ? err.message : String(err),
    });
    return defaultSession(channel, "unknown");
  }
}

async function writeSession(session: ChannelSession): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { upsertAppSetting } = await import("@/data/appSettings");
  let error: unknown = null;
  try {
    await upsertAppSetting(user.id, keyFor(session.channel), JSON.stringify({
      status: session.status,
      last_seen_at: session.last_seen_at,
      last_error: session.last_error,
      metadata: session.metadata,
    }));
  } catch (e) { error = e; }
  if (error) {
    log.error("session.write_failed", {
      channel: session.channel,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function markSessionAlive(
  channel: ChannelKind,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await writeSession({
    channel,
    status: "active",
    last_seen_at: new Date().toISOString(),
    last_error: null,
    metadata,
  });
  log.info("session.alive", { channel });
}

export async function markSessionExpired(
  channel: ChannelKind,
  reason: string
): Promise<void> {
  await writeSession({
    channel,
    status: "expired",
    last_seen_at: new Date().toISOString(),
    last_error: reason,
    metadata: {},
  });
  log.warn("session.expired", { channel, reason });
}

export async function markSessionDisconnected(
  channel: ChannelKind,
  reason: string
): Promise<void> {
  await writeSession({
    channel,
    status: "disconnected",
    last_seen_at: new Date().toISOString(),
    last_error: reason,
    metadata: {},
  });
  log.warn("session.disconnected", { channel, reason });
}

function defaultSession(channel: ChannelKind, status: SessionStatus): ChannelSession {
  return {
    channel,
    status,
    last_seen_at: null,
    last_error: null,
    metadata: {},
  };
}
