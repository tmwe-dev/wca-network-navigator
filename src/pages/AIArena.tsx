/**
 * AIArena — Immersive AI-driven contact outreach session page.
 */
import * as React from "react";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Check, SkipForward, Ban, Edit3, Settings2, Timer,
  Zap, Target, Loader2, Inbox, Globe,
} from "lucide-react";
import { toast } from "sonner";
import { ContactCard3D } from "@/components/ai-arena/ContactCard3D";
import { ConfirmationEffects } from "@/components/ai-arena/ConfirmationEffects";
import { SessionSummary } from "@/components/ai-arena/SessionSummary";
import { TypewriterText } from "@/components/ai-arena/TypewriterText";

// ── Types ──
interface Suggestion {
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

const LANG_FLAGS: Record<string, string> = {
  Deutsch: "🇩🇪", Français: "🇫🇷", Español: "🇪🇸", Português: "🇵🇹",
  Nederlands: "🇳🇱", Polski: "🇵🇱", Italiano: "🇮🇹", English: "🇬🇧",
  Русский: "🇷🇺", Türkçe: "🇹🇷", "中文": "🇨🇳", "日本語": "🇯🇵",
  "한국어": "🇰🇷", Svenska: "🇸🇪", Norsk: "🇳🇴", Dansk: "🇩🇰",
};

export function AIArenaPage(): React.ReactElement {
  const queryClient = useQueryClient();
  // Session state
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
  const [animState, setAnimState] = useState<"enter" | "idle" | "confirm" | "skip" | "blacklist">("idle");
  const [effectTrigger, setEffectTrigger] = useState<"confirm" | "skip" | "blacklist" | null>(null);
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

  // When suggestions come in
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
      // Fetch more
      refetch();
    }
  }, [currentIndex, suggestions.length, refetch]);

  // Actions
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
    setTimeout(() => {
      setEffectTrigger(null);
      advanceToNext();
    }, 700);
  }, [current, advanceToNext, editing, editSubject, editBody]);

  const handleSkip = useCallback(() => {
    if (!current) return;
    setAnimState("skip");
    setEffectTrigger("skip");
    setSkipped((s) => s + 1);
    setProposed((p) => p + 1);
    setExcludedIds((prev) => [...prev, current.partner_id]);
    setEditing(false);
    setTimeout(() => {
      setEffectTrigger(null);
      advanceToNext();
    }, 600);
  }, [current, advanceToNext]);

  const handleBlacklist = useCallback(async () => {
    if (!current) return;
    setAnimState("blacklist");
    setEffectTrigger("blacklist");
    setBlocked((b) => b + 1);
    setProposed((p) => p + 1);
    setExcludedIds((prev) => [...prev, current.partner_id]);
    setEditing(false);

    // Insert into blacklist_entries
    const { error } = await supabase.from("blacklist_entries").insert({
      company_name: current.company_name,
      country: current.country_name || current.country_code,
      source: "ai_arena",
      status: "active",
    } as any);
    if (error) {
      toast.error(`Errore blacklist: ${error.message}`);
    } else {
      toast.error(`🚫 ${current.company_name} aggiunto alla blacklist`);
    }

    setTimeout(() => {
      setEffectTrigger(null);
      advanceToNext();
    }, 700);
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

  // Pre-session screen
  if (!sessionStarted) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative z-10 text-center space-y-6 max-w-lg"
        >
          <div className="h-20 w-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">AI Arena</h1>
          <p className="text-muted-foreground">
            L'AI ti propone contatti da raggiungere. Tu confermi, modifichi o salti. Zero decisioni, massima velocità.
          </p>

          <div className="bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4 text-left">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Focus</Label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">🌍 Tutti</SelectItem>
                  <SelectItem value="estero">✈️ Estero</SelectItem>
                  <SelectItem value="italia">🇮🇹 Italia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Canale</Label>
              <RadioGroup value={channel} onValueChange={setChannel} className="flex gap-3">
                <div className="flex items-center gap-1.5"><RadioGroupItem value="email" id="ch-email" /><Label htmlFor="ch-email" className="text-sm">Email</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="whatsapp" id="ch-wa" /><Label htmlFor="ch-wa" className="text-sm">WhatsApp</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="linkedin" id="ch-li" /><Label htmlFor="ch-li" className="text-sm">LinkedIn</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Lingua invio</Label>
              <RadioGroup value={sendLanguage} onValueChange={setSendLanguage} className="flex gap-3">
                <div className="flex items-center gap-1.5"><RadioGroupItem value="recipient" id="lang-r" /><Label htmlFor="lang-r" className="text-xs">Destinatario</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="english" id="lang-en" /><Label htmlFor="lang-en" className="text-xs">Inglese</Label></div>
                <div className="flex items-center gap-1.5"><RadioGroupItem value="italian" id="lang-it" /><Label htmlFor="lang-it" className="text-xs">Italiano</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Batch size: {batchSize}</Label>
              <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={1} max={10} step={1} />
            </div>
          </div>

          <Button size="lg" onClick={startSession} className="w-full text-lg h-14">
            <Zap className="h-5 w-5 mr-2" /> Inizia Sessione
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-blue-500/3 pointer-events-none" />

      <ConfirmationEffects trigger={effectTrigger} />
      <SessionSummary open={sessionEnded} stats={sessionStats} onClose={() => window.history.back()} />

      {/* TOP ZONE */}
      <div className="relative z-10 h-[140px] border-b border-border/30 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Timer className="h-5 w-5 text-muted-foreground" />
          <div className="flex items-baseline gap-0.5 font-mono text-2xl font-bold text-foreground">
            <motion.span key={minutes} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{minutes}</motion.span>
            <span className="text-muted-foreground animate-pulse">:</span>
            <motion.span key={seconds} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{seconds}</motion.span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {[
            { label: "Proposti", value: proposed, color: "text-blue-400" },
            { label: "Confermati", value: confirmed, color: "text-green-400" },
            { label: "Saltati", value: skipped, color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <motion.div
                key={value}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className={`text-2xl font-bold ${color}`}
              >
                {value}
              </motion.div>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm"><Settings2 className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Focus</Label>
                <Select value={focus} onValueChange={setFocus}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tutti">Tutti</SelectItem>
                    <SelectItem value="estero">Estero</SelectItem>
                    <SelectItem value="italia">Italia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Batch: {batchSize}</Label>
                <Slider value={[batchSize]} onValueChange={([v]) => setBatchSize(v)} min={1} max={10} step={1} />
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="destructive" size="sm" onClick={endSession}>Fine Sessione</Button>
        </div>
      </div>

      {/* MIDDLE ZONE */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        {loadingSuggestions && !current && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">L'AI sta analizzando i contatti migliori...</p>
          </motion.div>
        )}

        {!loadingSuggestions && !current && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground">
            <Inbox className="h-12 w-12 opacity-40" />
            <p>Nessun contatto disponibile con i filtri selezionati.</p>
          </div>
        )}

        {current && (
          <div className="w-full max-w-3xl space-y-4">
            {/* 3D Card */}
            <ContactCard3D
              contact={{
                company_name: current.company_name,
                contact_name: current.contact_name,
                contact_position: current.contact_position,
                country_code: current.country_code,
                country_name: current.country_name,
                city: current.city,
                email: current.email,
                partner_match: current.partner_match,
                rating: current.rating,
              }}
              animState={animState}
            />

            {/* AI Reasoning + Draft Preview */}
            <AnimatePresence mode="wait">
              <motion.div
                key={current.partner_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-card/60 backdrop-blur-sm border border-border/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  <span>Suggerito perché:</span>
                  <span className="text-foreground">{current.ai_reasoning}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary border-0 text-xs">
                    {LANG_FLAGS[current.target_language] || "🌍"} {channel === "linkedin" ? "LinkedIn" : "Email"} in {current.language_label}
                  </Badge>
                  {channel === "linkedin" && (
                    <Badge variant="outline" className="text-[10px] border-[#0A66C2]/30 text-[#0A66C2]">Max 300 char</Badge>
                  )}
                </div>

                {!editing ? (
                  <div className="bg-background/50 rounded-lg p-3 space-y-2">
                    {channel !== "linkedin" && (
                      <div className="text-xs text-muted-foreground font-mono">Subject: {current.draft_subject}</div>
                    )}
                    <div className="text-sm text-foreground/90 leading-relaxed max-h-32 overflow-y-auto">
                      <TypewriterText text={current.draft_body.replace(/<[^>]*>/g, "")} speed={15} />
                    </div>
                    {channel === "linkedin" && (
                      <div className="text-[10px] text-muted-foreground text-right">
                        {current.draft_body.replace(/<[^>]*>/g, "").length}/300
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {channel !== "linkedin" && (
                      <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Subject" className="text-sm" />
                    )}
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={channel === "linkedin" ? 3 : 4}
                      className="text-sm"
                      maxLength={channel === "linkedin" ? 300 : undefined}
                    />
                    {channel === "linkedin" && (
                      <div className="text-[10px] text-muted-foreground text-right">{editBody.length}/300</div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white h-12 px-6" onClick={handleConfirm}>
                  <Check className="h-5 w-5 mr-2" /> Conferma e Invia
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="outline" className="h-12 px-6 border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={handleEdit}>
                  <Edit3 className="h-5 w-5 mr-2" /> {editing ? "Anteprima" : "Modifica"}
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="ghost" className="h-12 px-6 text-muted-foreground" onClick={handleSkip}>
                  <SkipForward className="h-5 w-5 mr-2" /> Salta
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handleBlacklist}>
                  <Ban className="h-4 w-4 mr-1" /> Mai
                </Button>
              </motion.div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ZONE */}
      <div className="relative z-10 h-[60px] border-t border-border/30 px-6 flex items-center gap-4 shrink-0">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(100, (confirmed / Math.max(proposed, 1)) * 100)}%` }}
              transition={{ type: "spring", stiffness: 100, damping: 20 }}
            />
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {confirmed} confermati su {proposed} proposti
        </span>
      </div>
    </div>
  );
}
