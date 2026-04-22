/**
 * OnboardingPage V2
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Check, ChevronRight, MessageCircle, Loader2, Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { createLogger } from "@/lib/log";
import { upsertAppSetting } from "@/data/appSettings";
import { findAgentByUserAndName, createAgent } from "@/data/agents";
import { updateProfileOnboarding } from "@/data/profiles";

const log = createLogger("Onboarding");

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OnboardingStep {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  completed: boolean;
}

const AGENT_TEMPLATES = [
  { name: "Luca", role: "director", emoji: "🧠", desc: "Direttore strategico. Coordina tutti gli agenti e crea piani." },
  { name: "Marco", role: "outreach", emoji: "📧", desc: "Esperto outreach email e primo contatto." },
  { name: "Sara", role: "sales", emoji: "💼", desc: "Esperta vendite e negoziazione." },
  { name: "Robin", role: "support", emoji: "🎯", desc: "Supporto clienti e follow-up." },
];

const COUNTRY_GROUPS = [
  { code: "EU", label: "🇪🇺 Europa", countries: ["IT", "DE", "FR", "ES", "NL", "BE", "AT", "CH", "PL", "CZ"] },
  { code: "ASIA", label: "🌏 Asia", countries: ["CN", "JP", "KR", "IN", "TH", "VN", "MY", "SG", "ID", "PH"] },
  { code: "MENA", label: "🌍 MENA", countries: ["AE", "SA", "TR", "EG", "IL", "QA", "KW", "BH"] },
  { code: "AMERICAS", label: "🌎 Americhe", countries: ["US", "CA", "MX", "BR", "AR", "CL", "CO"] },
  { code: "AFRICA", label: "🌍 Africa", countries: ["ZA", "NG", "KE", "GH", "TZ", "ET"] },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step data
  const [companyName, setCompanyName] = useState("");
  const [businessGoals, setBusinessGoals] = useState("");
  const [currentFocus, setCurrentFocus] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["Luca", "Marco"]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  // AI Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth", { replace: true }); return; }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const steps: OnboardingStep[] = [
    { id: "profile", title: "La tua azienda", subtitle: "Nome, obiettivi e focus", icon: "🏢", completed: currentStep > 0 },
    { id: "regions", title: "Target geografico", subtitle: "Dove vuoi operare", icon: "🌍", completed: currentStep > 1 },
    { id: "agents", title: "Attiva agenti AI", subtitle: "Chi lavora per te", icon: "🤖", completed: currentStep > 2 },
    { id: "confirm", title: "Conferma e avvia", subtitle: "Tutto pronto!", icon: "🚀", completed: currentStep > 3 },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const stepContext = `L'utente è allo step "${steps[currentStep]?.title}". Rispondi brevemente e in italiano per aiutarlo a configurare la piattaforma.`;
      const data = await invokeEdge<Record<string, unknown>>("ai-assistant", { body: {
          messages: [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content })),
          systemPrompt: `Sei l'assistente di onboarding. ${stepContext} Sii conciso (max 3 frasi).`,
        }, context: "Onboarding.ai_assistant" });
      const reply = String(data?.reply || data?.content || "Non riesco a rispondere ora.");
      setChatMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      setChatMessages(prev => [...prev, { role: "assistant", content: "Mi dispiace, errore di connessione. Riprova." }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, currentStep, steps]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [chatMessages]);

  const toggleAgent = (name: string) => {
    setSelectedAgents(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleRegion = (code: string) => {
    setSelectedRegions(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const canProceed = () => {
    if (currentStep === 0) return companyName.trim().length > 0;
    if (currentStep === 1) return selectedRegions.length > 0;
    if (currentStep === 2) return selectedAgents.length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Save settings
      const settings = [
        { key: "ai_company_name", value: companyName },
        { key: "ai_business_goals", value: businessGoals },
        { key: "ai_current_focus", value: currentFocus },
        { key: "ai_target_regions", value: JSON.stringify(selectedRegions) },
      ];
      for (const s of settings) {
        await upsertAppSetting(userId, s.key, s.value);
      }

      // Create selected agents
      for (const template of AGENT_TEMPLATES) {
        if (!selectedAgents.includes(template.name)) continue;
        const existing = await findAgentByUserAndName(userId, template.name);
        if (existing?.id) continue;

        await createAgent({
          user_id: userId,
          name: template.name,
          role: template.role,
          avatar_emoji: template.emoji,
          system_prompt: `Sei ${template.name}, ${template.desc}`,
          is_active: true,
          territory_codes: selectedRegions.flatMap(r => COUNTRY_GROUPS.find(g => g.code === r)?.countries || []),
        });
      }

      // Mark onboarding complete
      await updateProfileOnboarding(userId);

      toast.success("🚀 Piattaforma configurata! Benvenuto.");
      navigate("/", { replace: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {steps.map((s, i) => (
              <span key={s.id} className={cn("flex items-center gap-1", i <= currentStep ? "text-primary font-medium" : "")}>
                {s.completed ? <Check className="w-3 h-3" /> : <span>{s.icon}</span>}
                <span className="hidden sm:inline">{s.title}</span>
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-4">
          {/* Main content */}
          <Card>
            <CardContent className="pt-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {currentStep === 0 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">🏢 La tua azienda</h2>
                        <p className="text-sm text-muted-foreground">Queste info permetteranno all'AI di personalizzare ogni comunicazione.</p>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Nome azienda *</label>
                          <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Es. Global Logistics Srl" className="mt-1" />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Obiettivi di business</label>
                          <Textarea value={businessGoals} onChange={e => setBusinessGoals(e.target.value)} placeholder="Es. Espandere la rete di partner in Europa..." className="mt-1" rows={3} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Focus corrente</label>
                          <Input value={currentFocus} onChange={e => setCurrentFocus(e.target.value)} placeholder="Es. Acquisizione partner in Germania" className="mt-1" />
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">🌍 Target geografico</h2>
                        <p className="text-sm text-muted-foreground">Seleziona le regioni dove vuoi concentrare l'outreach.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {COUNTRY_GROUPS.map(g => (
                          <button
                            key={g.code}
                            onClick={() => toggleRegion(g.code)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border transition-all text-left",
                              selectedRegions.includes(g.code)
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/30"
                            )}
                          >
                            <div>
                              <span className="font-medium text-sm">{g.label}</span>
                              <p className="text-xs text-muted-foreground">{g.countries.length} paesi</p>
                            </div>
                            {selectedRegions.includes(g.code) && <Check className="w-4 h-4 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">🤖 Attiva agenti AI</h2>
                        <p className="text-sm text-muted-foreground">Scegli gli agenti che lavoreranno per te. Potrai aggiungerne altri dopo.</p>
                      </div>
                      <div className="space-y-2">
                        {AGENT_TEMPLATES.map(a => (
                          <button
                            key={a.name}
                            onClick={() => toggleAgent(a.name)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                              selectedAgents.includes(a.name)
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/30"
                            )}
                          >
                            <span className="text-2xl">{a.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{a.name}</span>
                                <Badge variant="outline" className="text-[10px]">{a.role}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{a.desc}</p>
                            </div>
                            {selectedAgents.includes(a.name) && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-semibold">🚀 Tutto pronto!</h2>
                        <p className="text-sm text-muted-foreground">Ecco un riepilogo della tua configurazione.</p>
                      </div>
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Azienda</p>
                          <p className="text-sm font-medium">{companyName}</p>
                          {currentFocus && <p className="text-xs text-muted-foreground">Focus: {currentFocus}</p>}
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Regioni target</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedRegions.map(r => {
                              const g = COUNTRY_GROUPS.find(g => g.code === r);
                              return <Badge key={r} variant="secondary" className="text-xs">{g?.label || r}</Badge>;
                            })}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Agenti attivati</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedAgents.map(a => {
                              const t = AGENT_TEMPLATES.find(t => t.name === a);
                              return <Badge key={a} variant="secondary" className="text-xs">{t?.emoji} {a}</Badge>;
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between mt-6 pt-4 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentStep === 0}
                  onClick={() => setCurrentStep(s => s - 1)}
                >
                  Indietro
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button
                    size="sm"
                    disabled={!canProceed()}
                    onClick={() => setCurrentStep(s => s + 1)}
                    className="gap-1"
                  >
                    Avanti <ChevronRight className="w-3 h-3" />
                  </Button>
                ) : (
                  <Button size="sm" onClick={handleFinish} disabled={saving} className="gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {saving ? "Salvataggio..." : "Avvia piattaforma"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Chat sidebar */}
          <Card className="hidden md:flex flex-col h-[420px]">
            <div className="shrink-0 px-3 py-2 border-b border-border/30 flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold">Assistente AI</span>
            </div>
            <ScrollArea className="flex-1 px-3 py-2" ref={chatRef}>
              {chatMessages.length === 0 && (
                <p className="text-[11px] text-muted-foreground text-center py-4">
                  Hai dubbi? Chiedimi qualsiasi cosa su questo step! 💬
                </p>
              )}
              <div className="space-y-2">
                {chatMessages.map((m, i) => (
                  <div key={i} className={cn("text-xs rounded-lg px-2.5 py-2 max-w-[95%]", m.role === "user" ? "bg-primary/10 ml-auto" : "bg-muted/50")}>
                    {m.content}
                  </div>
                ))}
                {chatLoading && (
                  <div className="bg-muted/50 rounded-lg px-2.5 py-2 text-xs max-w-[95%]">
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Penso...
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="shrink-0 px-2 py-2 border-t border-border/30">
              <form onSubmit={e => { e.preventDefault(); sendChat(); }} className="flex gap-1">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Chiedi all'AI..."
                  className="h-7 text-xs flex-1"
                />
                <Button type="submit" size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={chatLoading || !chatInput.trim()} aria-label="Invia">
                  <Send className="w-3 h-3" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
