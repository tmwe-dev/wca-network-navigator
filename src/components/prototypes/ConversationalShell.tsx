import { useState, useMemo, useCallback } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Sparkles, Network, Mail, Users, CalendarCheck, Settings, ArrowLeft, Send, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useAllActivities } from "@/hooks/useActivities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UnifiedContactList, type UnifiedContact } from "./shared/UnifiedContactList";
import { ContactDetail } from "./shared/ContactDetail";
import { MiniAgenda } from "./shared/MiniAgenda";

type PanelType = "none" | "contacts" | "outreach" | "agenda" | "email";

const SHORTCUTS = [
  { key: "contacts" as PanelType, icon: Users, label: "Contatti" },
  { key: "outreach" as PanelType, icon: Network, label: "Network" },
  { key: "email" as PanelType, icon: Mail, label: "Email" },
  { key: "agenda" as PanelType, icon: CalendarCheck, label: "Agenda" },
];

function usePartnerContactsList() {
  return useQuery({
    queryKey: ["proto-conv-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_contacts")
        .select("id, first_name, last_name, email, phone, partners(id, company_name, country_code)")
        .order("created_at", { ascending: false })
        .limit(150);
      return (data || []).map((pc: any) => ({
        id: pc.id,
        name: [pc.first_name, pc.last_name].filter(Boolean).join(" ") || "—",
        company: pc.partners?.company_name || "—",
        email: pc.email || undefined,
        phone: pc.phone || undefined,
        country: pc.partners?.country_code || undefined,
        origin: "WCA",
        partnerId: pc.partners?.id || null,
      })) as UnifiedContact[];
    },
    staleTime: 60_000,
  });
}

interface HistoryEntry {
  id: string;
  text: string;
  timestamp: Date;
  type: "query" | "action";
}

export function ConversationalShell() {
  const navigate = useAppNavigate();
  const [prompt, setPrompt] = useState("");
  const [activePanel, setActivePanel] = useState<PanelType>("none");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const { contacts: cockpitRaw = [] } = useCockpitContacts();
  const { data: partnerContacts = [] } = usePartnerContactsList();
  const { data: activities = [] } = useAllActivities();

  const cockpitContacts: UnifiedContact[] = useMemo(() =>
    cockpitRaw.map(c => ({
      id: c.id, name: c.name, company: c.company, email: c.email || undefined,
      phone: c.phone || undefined, country: c.country, origin: c.origin,
      linkedinUrl: c.linkedinUrl || undefined, partnerId: c.partnerId,
    })), [cockpitRaw]);

  const allContacts = useMemo(() => [...cockpitContacts, ...partnerContacts], [cockpitContacts, partnerContacts]);

  const handlePromptSubmit = useCallback(async () => {
    if (!prompt.trim()) return;
    const q = prompt.trim().toLowerCase();
    
    setHistory(prev => [...prev, { id: crypto.randomUUID(), text: prompt, timestamp: new Date(), type: "query" }]);
    setIsProcessing(true);

    // Simple intent detection for prototype
    await new Promise(r => setTimeout(r, 600));
    
    if (q.includes("contatt") || q.includes("partner") || q.includes("network")) {
      setActivePanel("contacts");
      setAiResponse(`Mostro ${allContacts.length} contatti. Usa i filtri per affinare la ricerca.`);
    } else if (q.includes("email") || q.includes("scriv") || q.includes("invi")) {
      setActivePanel("email");
      setAiResponse("Pannello email attivato. Seleziona un contatto per comporre.");
    } else if (q.includes("agenda") || q.includes("attivit") || q.includes("scadenz")) {
      setActivePanel("agenda");
      setAiResponse(`Hai ${activities.filter(a => !["completed", "cancelled"].includes(a.status)).length} attività aperte.`);
    } else if (q.includes("outreach") || q.includes("cockpit")) {
      setActivePanel("outreach");
      setAiResponse(`${cockpitContacts.length} contatti nel cockpit pronti per l'outreach.`);
    } else {
      setAiResponse("Prova a chiedermi di mostrare contatti, aprire l'agenda o gestire l'outreach.");
    }

    setIsProcessing(false);
    setPrompt("");
  }, [prompt, allContacts.length, cockpitContacts.length, activities]);

  const openActivities = activities.filter(a => !["completed", "cancelled"].includes(a.status)).length;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Minimal header */}
      <header className="h-11 border-b border-border/60 flex items-center px-4 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold ml-2">WCA Partners</span>
        <span className="ml-2 text-[10px] text-muted-foreground">Conversational — Prototipo C</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/settings")}>
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      {/* AI Prompt area */}
      <div className="px-4 py-5 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="max-w-xl mx-auto space-y-3">
          <div className="flex items-center gap-2 justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Cosa vuoi fare?</h1>
          </div>
          <form onSubmit={e => { e.preventDefault(); handlePromptSubmit(); }} className="relative">
            <Input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Mostra partner italiani, scrivi email a..."
              className="pr-10 h-10 text-sm bg-background"
              disabled={isProcessing}
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-8 w-8"
              disabled={isProcessing || !prompt.trim()}
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />}
            </Button>
          </form>
          {aiResponse && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 text-xs text-foreground/80">
              <Sparkles className="h-3 w-3 text-primary inline mr-1.5" />
              {aiResponse}
            </div>
          )}
        </div>
      </div>

      {/* Projected Panel */}
      <div className="flex-1 min-h-0 px-4 pb-3">
        {activePanel === "none" && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Scrivi un comando o usa le scorciatoie in basso</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Mostra contatti recenti", "Apri agenda", "Outreach Italia"].map(s => (
                  <button
                    key={s}
                    onClick={() => { setPrompt(s); }}
                    className="px-3 py-1.5 rounded-full text-[11px] bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(activePanel === "contacts" || activePanel === "outreach") && (
          <div className="flex h-full rounded-xl border border-border/60 overflow-hidden bg-card">
            <div className={cn("border-r border-border/40", selectedId ? "w-[300px]" : "flex-1 max-w-sm")}>
              <UnifiedContactList
                contacts={activePanel === "outreach" ? cockpitContacts : allContacts}
                selected={selectedId}
                onSelect={c => setSelectedId(c.id)}
              />
            </div>
            {selectedId && (
              <ContactDetail
                contact={allContacts.find(c => c.id === selectedId) || null}
                onClose={() => setSelectedId(null)}
                className="flex-1"
              />
            )}
          </div>
        )}

        {activePanel === "agenda" && (
          <div className="max-w-xl mx-auto">
            <MiniAgenda />
          </div>
        )}

        {activePanel === "email" && (
          <div className="h-full flex items-center justify-center rounded-xl border border-border/60 bg-card">
            <div className="text-center text-sm text-muted-foreground p-6">
              <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p>Seleziona un contatto per comporre un'email</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setActivePanel("contacts")}>
                Vai ai contatti
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Shortcuts + History footer */}
      <div className="border-t border-border/60 shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            {SHORTCUTS.map(s => (
              <button
                key={s.key}
                onClick={() => { setActivePanel(s.key); setSelectedId(null); }}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors",
                  activePanel === s.key
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <s.icon className="h-4 w-4" />
                <span className="text-[9px] font-medium">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <History className="h-3 w-3" />
            {history.length} azioni
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-1" />
            live
          </div>
        </div>
      </div>
    </div>
  );
}
