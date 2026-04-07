import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket, Send, ArrowLeft, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MissionStepData } from "@/components/missions/MissionStepRenderer";
import { extractWidgets, MissionWidgetRenderer, type WidgetConfig } from "@/components/missions/MissionChatWidgets";
import ReactMarkdown from "react-markdown";
import { useContinuousSpeech } from "@/hooks/useContinuousSpeech";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const LAURA_VOICE_ID = "FGY2WhTYpPnrIDTdsKH5";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;

function extractVoiceSummary(text: string): string {
  const clean = text.replace(/[#*_`~\[\]()>|]/g, "").replace(/\n+/g, " ").replace(/\[WIDGET:[^\]]+\]/g, "").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return clean.slice(0, 200);
  return sentences.slice(0, 2).join(" ").trim();
}

type Msg = { role: "user" | "assistant"; content: string; widgets?: WidgetConfig[] };

export default function MissionBuilder() {
  const navigate = useNavigate();
  const [stepData, setStepData] = useState<MissionStepData>({ channel: "email", schedule: "immediate" });
  const [missionTitle, setMissionTitle] = useState("");

  // Stats from DB
  const [countryStats, setCountryStats] = useState<{ code: string; name: string; count: number; withEmail: number }[]>([]);

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

  // Load stats + welcome
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load ALL partners using iterative range() to avoid 1000-row limit
      const allPartners: { country_code: string | null; country_name: string | null; email: string | null }[] = [];
      const BATCH = 2000;
      let from = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("partners")
          .select("country_code, country_name, email")
          .eq("is_active", true)
          .range(from, from + BATCH - 1);
        if (!batch || batch.length === 0) break;
        allPartners.push(...batch);
        if (batch.length < BATCH) break;
        from += BATCH;
      }

      const map = new Map<string, { code: string; name: string; count: number; withEmail: number }>();
      for (const p of allPartners) {
        const code = p.country_code || "??";
        const entry = map.get(code) || { code, name: p.country_name || code, count: 0, withEmail: 0 };
        entry.count++;
        if (p.email) entry.withEmail++;
        map.set(code, entry);
      }
      setCountryStats(Array.from(map.values()).sort((a, b) => b.count - a.count));

      // AI-driven welcome with REAL numbers
      const totalPartners = allPartners.length;
      const totalCountries = map.size;
      const totalWithEmail = allPartners.filter(p => p.email).length;

      setMessages([{
        role: "assistant",
        content: `🎯 **Benvenuto!** Sono qui per aiutarti a creare la tua missione.\n\nNel tuo database ci sono **${totalPartners.toLocaleString("it-IT")} partner attivi** in **${totalCountries} paesi** (di cui **${totalWithEmail.toLocaleString("it-IT")}** con email).\n\nCosa vuoi fare? Puoi dirmi ad esempio:\n- *"Contatta i partner in Germania e Francia via email"*\n- *"Fai deep search sui contatti senza profilo in Europa"*\n- *"Prepara una campagna WhatsApp per i top-rated"*\n\nOppure semplicemente parlami del tuo obiettivo e ti guido io.`,
      }]);
    })();
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // TTS
  useEffect(() => {
    if (!voiceEnabled || isChatLoading || messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last.role !== "assistant" || lastIdx <= lastSpokenIdxRef.current) return;
    lastSpokenIdxRef.current = lastIdx;
    const summary = extractVoiceSummary(last.content);
    if (summary.length < 5 || summary.startsWith("⚠️")) return;
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
      } catch {}
    })();
  }, [messages, isChatLoading, voiceEnabled]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // Auto-send on speech stop
  const prevListeningRef = useRef(false);
  useEffect(() => {
    if (prevListeningRef.current && !speech.listening && chatInput.trim()) {
      sendChat(chatInput);
    }
    prevListeningRef.current = speech.listening;
  }, [speech.listening]);

  // Send chat
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
          context: {
            currentPage: "/mission-builder",
            missionData: stepData,
            countryStats: countryStats.slice(0, 30),
          },
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
            } catch {}
          }
        }
      }

      // Extract widgets from final content
      const { cleanText, widgets } = extractWidgets(assistantContent);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: cleanText, widgets } : m);
        return [...prev, { role: "assistant", content: cleanText, widgets }];
      });
    } catch (e) {
      console.error("Mission chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Errore di connessione. Riprova." }]);
    }

    setIsChatLoading(false);
  }, [messages, isChatLoading, stepData, countryStats]);

  // Launch mission
  const launchMission = useCallback(async () => {
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
  }, [stepData, missionTitle, navigate]);

  // Progress calculation
  const filledFields = [
    stepData.targets?.countries?.length,
    stepData.channel,
    stepData.batching?.batches?.length,
    stepData.deepSearch?.enabled !== undefined,
    stepData.communication?.templateMode,
  ].filter(Boolean).length;
  const progressPct = Math.round((filledFields / 5) * 100);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Rocket className="w-5 h-5 text-primary" />
        <input
          value={missionTitle}
          onChange={e => setMissionTitle(e.target.value)}
          placeholder="Nome missione..."
          className="bg-transparent text-lg font-semibold text-foreground outline-none flex-1 placeholder:text-muted-foreground/50"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => { setVoiceEnabled(v => !v); if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }}
          title={voiceEnabled ? "Disattiva voce" : "Attiva voce"}
        >
          {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
        </Button>
        {/* Progress bar */}
        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{progressPct}%</span>
      </div>

      {/* Full-width chat */}
      <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              }`}>
                {m.role === "assistant" ? (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.widgets && m.widgets.length > 0 && (
                      <MissionWidgetRenderer
                        widgets={m.widgets}
                        stepData={stepData}
                        onChange={setStepData}
                        countryStats={countryStats}
                        onLaunch={launchMission}
                      />
                    )}
                  </>
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

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-border max-w-2xl mx-auto w-full">
        {speech.listening && speech.interimText && (
          <div className="text-xs text-primary mb-2 animate-pulse truncate">🎙 {speech.interimText}</div>
        )}
        <div className="flex gap-2">
          {speech.hasSpeechAPI && (
            <Button
              size="icon"
              variant={speech.listening ? "default" : "outline"}
              onClick={speech.toggle}
              className={`flex-shrink-0 ${speech.listening ? "animate-pulse" : ""}`}
            >
              {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
          )}
          <Textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
            placeholder={speech.listening ? "🎙 Sto ascoltando…" : "Descrivi la tua missione..."}
            className="min-h-[40px] max-h-[80px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={() => sendChat(chatInput)}
            disabled={isChatLoading || !chatInput.trim()}
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
