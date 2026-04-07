import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, MessageCircle, Send, CheckCircle2, ArrowLeft, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MissionStepRenderer, TOTAL_STEPS, type MissionStepData } from "@/components/missions/MissionStepRenderer";
import ReactMarkdown from "react-markdown";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const LAURA_VOICE_ID = "FGY2WhTYpPnrIDTdsKH5";

/** Extract first 2 sentences from markdown text for conversational TTS */
function extractVoiceSummary(text: string): string {
  const clean = text.replace(/[#*_`~\[\]()>|]/g, "").replace(/\n+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return clean.slice(0, 200);
  return sentences.slice(0, 2).join(" ").trim();
}

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

export default function MissionBuilder() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [stepData, setStepData] = useState<MissionStepData>({ channel: "email", schedule: "immediate" });
  const [missionTitle, setMissionTitle] = useState("");

  // Stats from DB
  const [countryStats, setCountryStats] = useState<{ code: string; name: string; count: number; withEmail: number }[]>([]);
  const [agentsList, setAgentsList] = useState<{ id: string; name: string; emoji: string; territories: string[] }[]>([]);

  // Chat state
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Voice
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastSpokenIdxRef = useRef(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speech = useContinuousSpeech((text) => setChatInput(text));

  // Load stats on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Country stats from partners
      const { data: partners } = await supabase
        .from("partners")
        .select("country_code, country_name, email")
        .eq("is_active", true);

      if (partners) {
        const map = new Map<string, { code: string; name: string; count: number; withEmail: number }>();
        for (const p of partners) {
          const code = p.country_code || "??";
          const entry = map.get(code) || { code, name: p.country_name || code, count: 0, withEmail: 0 };
          entry.count++;
          if (p.email) entry.withEmail++;
          map.set(code, entry);
        }
        const sorted = Array.from(map.values()).sort((a, b) => b.count - a.count);
        setCountryStats(sorted);
      }

      // Agents
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, avatar_emoji, territory_codes, is_active")
        .eq("user_id", session.user.id)
        .eq("is_active", true);

      if (agents) {
        setAgentsList(agents.map(a => ({
          id: a.id,
          name: a.name,
          emoji: a.avatar_emoji,
          territories: (a.territory_codes || []) as string[],
        })));
      }

      // Welcome message from AI
      setMessages([{
        role: "assistant",
        content: `🎯 **Benvenuto nel Mission Builder!**\n\nSono qui per aiutarti a creare una missione di outreach. Ho trovato **${partners?.length || 0} partner** nel tuo database.\n\nSeleziona i paesi target nel pannello a sinistra, oppure chiedimi qualsiasi cosa — posso analizzare i tuoi dati e suggerirti la strategia migliore.`,
      }]);
    })();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // TTS on new assistant messages (conversational summary only)
  useEffect(() => {
    if (!voiceEnabled || isChatLoading || messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last.role !== "assistant" || lastIdx <= lastSpokenIdxRef.current) return;
    lastSpokenIdxRef.current = lastIdx;
    const summary = extractVoiceSummary(last.content);
    if (summary.length < 5 || summary.startsWith("⚠️")) return;
    // Fire-and-forget TTS
    (async () => {
      try {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        const resp = await fetch(TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ text: summary, voiceId: LAURA_VOICE_ID }),
        });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; };
        await audio.play();
      } catch (e) { console.warn("[MissionBuilder] TTS playback failed:", e); }
    })();
  }, [messages, isChatLoading, voiceEnabled]);

  // Stop audio on unmount
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // Auto-send when speech stops
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (prevListeningRef.current && !speech.listening && chatInput.trim()) {
      sendChat(chatInput);
    }
    prevListeningRef.current = speech.listening;
  }, [speech.listening]);

  // Send chat message
  const sendChat = useCallback(async (text: string) => {
    if (!text.trim() || isChatLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          context: { currentPage: "/mission-builder", missionStep: currentStep, missionData: stepData },
        }),
      });

      let assistantContent = "";
      const contentType = resp.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await resp.json();
        assistantContent = data.content || data.error || "Nessuna risposta";
      } else if (resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            } catch { /* malformed SSE JSON chunk, skip */ }
          }
        }
      }

      if (assistantContent) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
          return [...prev, { role: "assistant", content: assistantContent }];
        });
      }
    } catch (e) {
      console.error("Mission chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Errore di connessione. Riprova." }]);
    }

    setIsChatLoading(false);
  }, [messages, isChatLoading, currentStep, stepData]);

  // Complete step
  const handleStepComplete = useCallback(async () => {
    if (currentStep === TOTAL_STEPS - 1) {
      // Launch mission
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { toast.error("Sessione scaduta"); return; }

        const totalContacts = stepData.batching?.batches.reduce((s, b) => s + b.count, 0) || 0;
        const title = missionTitle || `Missione ${new Date().toLocaleDateString("it-IT")}`;

        const { data: mission, error } = await supabase.from("outreach_missions" as any).insert({
          user_id: session.user.id,
          title,
          status: stepData.schedule === "immediate" ? "active" : "draft",
          target_filters: stepData.targets || {},
          channel: stepData.channel || "email",
          total_contacts: totalContacts,
          agent_assignments: stepData.agents || [],
          schedule_config: { type: stepData.schedule, date: stepData.scheduleDate },
          metadata: {
            deepSearch: stepData.deepSearch || {},
            communication: stepData.communication || {},
            attachments: stepData.attachments || {},
            toneConfig: stepData.toneConfig || {},
          },
        }).select().single();

        if (error) throw error;

        toast.success(`🚀 Missione "${title}" creata con ${totalContacts} contatti!`);

        // If immediate, insert contacts into cockpit_queue
        if (stepData.schedule === "immediate" && stepData.targets?.countries?.length) {
          const { data: partners } = await supabase
            .from("partners")
            .select("id")
            .in("country_code", stepData.targets.countries)
            .eq("is_active", true)
            .limit(totalContacts);

          if (partners?.length) {
            const queueItems = partners.map(p => ({
              user_id: session.user.id,
              source_type: "mission",
              source_id: (mission as any).id,
              partner_id: p.id,
              status: "queued",
            }));

            await supabase.from("cockpit_queue").insert(queueItems);
            toast.success(`📋 ${partners.length} contatti inseriti nel cockpit`);
          }
        }

        navigate("/outreach");
      } catch (e: any) {
        toast.error("Errore nella creazione: " + (e.message || "Riprova"));
      }
      return;
    }

    setCompletedSteps(prev => [...prev, currentStep]);
    setCurrentStep(prev => prev + 1);
  }, [currentStep, stepData, missionTitle, navigate]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Rocket className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <input
            value={missionTitle}
            onChange={e => setMissionTitle(e.target.value)}
            placeholder="Nome missione..."
            className="bg-transparent text-lg font-semibold text-foreground outline-none w-full placeholder:text-muted-foreground/50"
          />
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`w-6 h-1.5 rounded-full transition-all ${
                completedSteps.includes(i) ? "bg-primary" : i === currentStep ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Steps */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Completed steps archive */}
          <AnimatePresence>
            {completedSteps.map(i => (
              <motion.div
                key={`done-${i}`}
                initial={{ opacity: 1, height: "auto" }}
                animate={{ opacity: 0.5, height: 40 }}
                className="bg-muted/30 rounded-lg px-4 flex items-center gap-2 overflow-hidden"
              >
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs text-muted-foreground truncate">
                  Step {i + 1} completato
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Current step */}
          <AnimatePresence mode="wait">
            <MissionStepRenderer
              key={currentStep}
              stepIndex={currentStep}
              data={stepData}
              onChange={setStepData}
              onComplete={handleStepComplete}
              stats={{ countries: countryStats }}
              agentsList={agentsList}
            />
          </AnimatePresence>
        </div>

        {/* Right: AI Chat */}
        <div className="w-[380px] border-l border-border flex flex-col bg-muted/10">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">Assistente Missione</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => { setVoiceEnabled(v => !v); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }}
              title={voiceEnabled ? "Disattiva voce" : "Attiva voce"}
            >
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border"
                  }`}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {isChatLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border rounded-xl px-3 py-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce [animation-delay:0.3s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-3 border-t border-border">
            {speech.listening && speech.interimText && (
              <div className="text-xs text-primary mb-2 animate-pulse truncate">🎙 {speech.interimText}</div>
            )}
            <div className="flex gap-2">
              <Textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
                placeholder={speech.listening ? "🎙 Sto ascoltando…" : "Chiedi all'AI..."}
                className="min-h-[40px] max-h-[80px] resize-none text-sm"
                rows={1}
              />
              {speech.hasSpeechAPI && (
                <Button
                  size="icon"
                  variant={speech.listening ? "default" : "outline"}
                  onClick={speech.toggle}
                  className={speech.listening ? "animate-pulse" : ""}
                >
                  {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              )}
              <Button size="icon" onClick={() => sendChat(chatInput)} disabled={isChatLoading || !chatInput.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
