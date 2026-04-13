/**
 * useArenaSession — State machine hook for AI Arena sessions
 */
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Suggestion {
  partner_id: string;
  company_name: string;
  company_alias: string | null;
  contact_name: string | null;
  contact_position: string | null;
  country_code: string;
  country_name: string | null;
  city: string | null;
  email: string;
  rating: number | null;
  employee_count: number | null;
  detected_language: string;
  language_label: string;
  target_language: string;
  ai_reasoning: string;
  draft_subject: string;
  draft_body: string;
  partner_match: boolean;
  channel: string;
}

export type AnimState = "enter" | "idle" | "confirm" | "skip" | "blacklist";
export type EffectTrigger = "confirm" | "skip" | "blacklist" | null;

export const LANG_FLAGS: Record<string, string> = {
  Deutsch: "🇩🇪", Français: "🇫🇷", Español: "🇪🇸", Português: "🇵🇹",
  Nederlands: "🇳🇱", Polski: "🇵🇱", Italiano: "🇮🇹", English: "🇬🇧",
  Русский: "🇷🇺", Türkçe: "🇹🇷", "中文": "🇨🇳", "日本語": "🇯🇵",
  "한국어": "🇰🇷", Svenska: "🇸🇪", Norsk: "🇳🇴", Dansk: "🇩🇰",
};

export function useArenaSession() {
  const queryClient = useQueryClient();

  // Config
  const [focus, setFocus] = useState("tutti");
  const [channel, setChannel] = useState("email");
  const [sendLanguage, setSendLanguage] = useState("recipient");
  const [batchSize, setBatchSize] = useState(1);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Counters
  const [proposed, setProposed] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [blocked, setBlocked] = useState(0);
  const [usedLanguages, setUsedLanguages] = useState<Set<string>>(new Set());
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  // Current suggestion
  const [currentIndex, setCurrentIndex] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [animState, setAnimState] = useState<AnimState>("idle");
  const [effectTrigger, setEffectTrigger] = useState<EffectTrigger>(null);
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (sessionStarted && !sessionEnded) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [sessionStarted, sessionEnded]);

  const minutes = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const seconds = (elapsed % 60).toString().padStart(2, "0");

  // Fetch suggestions
  const { isLoading: loadingSuggestions, refetch } = useQuery({
    queryKey: ["arena-suggestions", focus, channel, sendLanguage, batchSize, excludedIds.length],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-arena-suggest`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            focus,
            preferred_channel: channel,
            send_language: sendLanguage,
            batch_size: batchSize,
            excluded_ids: excludedIds,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      return res.json();
    },
    enabled: sessionStarted && !sessionEnded,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const data = queryClient.getQueryData<{ suggestions: Suggestion[] }>(
      ["arena-suggestions", focus, channel, sendLanguage, batchSize, excludedIds.length]
    );
    if (data?.suggestions?.length) {
      setSuggestions(data.suggestions);
      setCurrentIndex(0);
      setAnimState("enter");
      setTimeout(() => setAnimState("idle"), 600);
    }
  }, [queryClient, focus, channel, sendLanguage, batchSize, excludedIds.length]);

  const current = suggestions[currentIndex] || null;

  const advanceToNext = useCallback(() => {
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setAnimState("enter");
      setTimeout(() => setAnimState("idle"), 600);
    } else {
      refetch();
    }
  }, [currentIndex, suggestions.length, refetch]);

  const handleConfirm = useCallback(async () => {
    if (!current) return;
    setAnimState("confirm");
    setEffectTrigger("confirm");
    setConfirmed((c) => c + 1);
    setProposed((p) => p + 1);
    setUsedLanguages((prev) => new Set(prev).add(current.target_language));
    setExcludedIds((prev) => [...prev, current.partner_id]);

    const { error } = await supabase.from("activities").insert({
      activity_type: "send_email" as const,
      title: `AI Arena: ${editing ? editSubject : current.draft_subject}`,
      description: editing ? editBody : current.draft_body,
      email_subject: editing ? editSubject : current.draft_subject,
      email_body: editing ? editBody : current.draft_body,
      partner_id: current.partner_id,
      source_id: current.partner_id,
      source_type: "ai_arena",
      status: "pending" as const,
      priority: "medium",
    });
    if (error) {
      toast.error(`Errore creazione attività: ${error.message}`);
    } else {
      toast.success(`✅ Email programmata per ${current.company_name}`);
    }

    setEditing(false);
    setTimeout(() => { setEffectTrigger(null); advanceToNext(); }, 700);
  }, [current, advanceToNext, editing, editSubject, editBody]);

  const handleSkip = useCallback(() => {
    if (!current) return;
    setAnimState("skip");
    setEffectTrigger("skip");
    setSkipped((s) => s + 1);
    setProposed((p) => p + 1);
    setExcludedIds((prev) => [...prev, current.partner_id]);
    setEditing(false);
    setTimeout(() => { setEffectTrigger(null); advanceToNext(); }, 600);
  }, [current, advanceToNext]);

  const handleBlacklist = useCallback(async () => {
    if (!current) return;
    setAnimState("blacklist");
    setEffectTrigger("blacklist");
    setBlocked((b) => b + 1);
    setProposed((p) => p + 1);
    setExcludedIds((prev) => [...prev, current.partner_id]);
    setEditing(false);

    const { error } = await supabase.from("blacklist_entries").insert({
      company_name: current.company_name,
      country: current.country_name || current.country_code,
      source: "ai_arena",
      status: "active",
    } as Record<string, string>);
    if (error) {
      toast.error(`Errore blacklist: ${error.message}`);
    } else {
      toast.error(`🚫 ${current.company_name} aggiunto alla blacklist`);
    }

    setTimeout(() => { setEffectTrigger(null); advanceToNext(); }, 700);
  }, [current, advanceToNext]);

  const handleEdit = useCallback(() => {
    if (!current) return;
    setEditSubject(current.draft_subject);
    setEditBody(current.draft_body.replace(/<[^>]*>/g, ""));
    setEditing(true);
  }, [current]);

  const startSession = useCallback(() => {
    setSessionStarted(true);
    setElapsed(0);
    refetch();
  }, [refetch]);

  const endSession = useCallback(() => {
    setSessionEnded(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const sessionStats = useMemo(() => ({
    proposed,
    confirmed,
    skipped,
    blocked,
    languages: Array.from(usedLanguages),
    circuitBefore: 0,
    circuitAfter: confirmed,
  }), [proposed, confirmed, skipped, blocked, usedLanguages]);

  return {
    // Config
    focus, setFocus, channel, setChannel, sendLanguage, setSendLanguage,
    batchSize, setBatchSize, sessionStarted, sessionEnded,
    // Timer
    minutes, seconds,
    // Counters
    proposed, confirmed, skipped,
    // Suggestions
    current, loadingSuggestions, animState, effectTrigger,
    editing, editSubject, setEditSubject, editBody, setEditBody,
    // Actions
    handleConfirm, handleSkip, handleBlacklist, handleEdit,
    startSession, endSession,
    // Stats
    sessionStats,
  };
}
