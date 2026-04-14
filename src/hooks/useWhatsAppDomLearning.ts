import { useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "./useWhatsAppExtensionBridge";
import { createLogger } from "@/lib/log";
import { upsertAppSetting, getAppSettingByKey } from "@/data/appSettings";

const log = createLogger("useWhatsAppDomLearning");

const LEARN_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours
const CACHE_KEY = "wa_dom_schema";

export type WaDomSchema = {
  sidebar?: string;
  chatList?: string;
  messageBubble?: string;
  inputBox?: string;
  sendButton?: string;
  unreadBadge?: string;
  contactName?: string;
  lastMessage?: string;
  timestamp?: string;
  learnedAt?: number;
  [key: string]: string | number | undefined;
};

export function useWhatsAppDomLearning() {
  const { isAvailable, learnDom } = useWhatsAppExtensionBridge();
  const learningRef = useRef(false);
  const lastLearnRef = useRef(0);
  const schemaRef = useRef<WaDomSchema | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load cached schema from app_settings
  const loadCached = useCallback(async (): Promise<WaDomSchema | null> => {
    try {
      const value = await getAppSettingByKey(CACHE_KEY);
      const data = value ? { value } : null;

      if (data?.value) {
        const parsed = JSON.parse(data.value) as WaDomSchema;
        schemaRef.current = parsed;
        lastLearnRef.current = parsed.learnedAt || 0;
        return parsed;
      }
    } catch (err) { console.warn("[WA DOM] Failed to load schema:", err); }
    return null;
  }, []);

  // Save schema to app_settings
  const saveSchema = useCallback(async (schema: WaDomSchema) => {
    schema.learnedAt = Date.now();
    const value = JSON.stringify(schema);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await upsertAppSetting(user.id, CACHE_KEY, value);

    schemaRef.current = schema;
    lastLearnRef.current = schema.learnedAt;
  }, []);

  // Trigger DOM learning via extension
  const learn = useCallback(async (): Promise<WaDomSchema | null> => {
    if (learningRef.current || !isAvailable) return schemaRef.current;
    learningRef.current = true;

    try {
      const result = await learnDom();
      if (result.success && (result as Record<string, unknown>).schema) {
        const schema = (result as Record<string, unknown>).schema as WaDomSchema;
        await saveSchema(schema);
        log.info("schema learned", { keys: Object.keys(schema).length });
        return schema;
      }
      log.warn("learning failed", { error: result.error });
      return schemaRef.current;
    } catch (err) {
      log.error("learning error", { message: err instanceof Error ? err.message : String(err) });
      return schemaRef.current;
    } finally {
      learningRef.current = false;
    }
  }, [isAvailable, learnDom, saveSchema]);

  // Check if schema is stale (>3h)
  const isStale = useCallback((): boolean => {
    return Date.now() - lastLearnRef.current > LEARN_INTERVAL_MS;
  }, []);

  // Get current schema, learning if stale
  const getSchema = useCallback(async (): Promise<WaDomSchema | null> => {
    if (schemaRef.current && !isStale()) return schemaRef.current;

    // Try loading from DB first
    const cached = await loadCached();
    if (cached && !isStale()) return cached;

    // Need fresh learning
    return await learn();
  }, [loadCached, isStale, learn]);

  // Force re-learn (called when selectors fail)
  const forceRelearn = useCallback(async (): Promise<WaDomSchema | null> => {
    log.info("force re-learn triggered");
    lastLearnRef.current = 0;
    return await learn();
  }, [learn]);

  // Auto-learn on mount + schedule every 3h
  useEffect(() => {
    if (!isAvailable) return;

    const init = async () => {
      const cached = await loadCached();
      if (!cached || isStale()) {
        await learn();
      }
    };
    init();

    // Schedule periodic re-learning
    timerRef.current = setInterval(() => {
      if (isStale()) learn();
    }, LEARN_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAvailable, loadCached, isStale, learn]);

  return {
    schema: schemaRef.current,
    getSchema,
    forceRelearn,
    isLearning: learningRef.current,
    isStale: isStale(),
    lastLearnedAt: lastLearnRef.current,
  };
}
