import { useState, useMemo } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Search, Sparkles, Settings, Radar, Network, Users, CalendarCheck, X, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useAllActivities } from "@/hooks/useActivities";
import { useProspectStats } from "@/hooks/useProspectStats";
import { UnifiedContactList, type UnifiedContact } from "./shared/UnifiedContactList";
import { ContactDetail } from "./shared/ContactDetail";
import { QuickFilters, type FilterChip } from "./shared/QuickFilters";
import { MiniAgenda } from "./shared/MiniAgenda";
import { StatsBar } from "./shared/StatsBar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TABS = [
  { key: "outreach", label: "Outreach", icon: Radar },
  { key: "network", label: "Network", icon: Network },
  { key: "contatti", label: "Contatti", icon: Users },
] as const;

const FILTER_CHIPS: FilterChip[] = [
  { key: "with-email", label: "Con email" },
  { key: "with-phone", label: "Con telefono" },
  { key: "wca", label: "WCA" },
  { key: "import", label: "Import" },
  { key: "bca", label: "BCA" },
];

function usePartnerContacts() {
  return useQuery({
    queryKey: ["proto-partner-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, first_name, last_name, email, phone, mobile, position, partners(id, company_name, country_code)")
        .limit(200);
      if (error) throw error;
      return ((data || []) as any[]).map((pc) => ({
        id: pc.id,
        name: [pc.first_name, pc.last_name].filter(Boolean).join(" ") || "—",
        company: pc.partners?.company_name || "—",
        email: pc.email || undefined,
        phone: pc.phone || pc.mobile || undefined,
        country: pc.partners?.country_code || undefined,
        origin: "WCA",
        partnerId: pc.partners?.id || null,
      })) as UnifiedContact[];
    },
    staleTime: 60_000,
  });
}

export function FocusFlowShell() {
  const navigate = useAppNavigate();
  const [activeTab, setActiveTab] = useState<string>("outreach");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const { contacts: cockpitRaw = [] } = useCockpitContacts();
  const { data: partnerContacts = [] } = usePartnerContacts();
  const { data: activities = [] } = useAllActivities();
  const { data: _prospectStats } = useProspectStats();

  const cockpitContacts: UnifiedContact[] = useMemo(() =>
    cockpitRaw.map(c => ({
      id: c.id, name: c.name, company: c.company, email: c.email || undefined,
      phone: c.phone || undefined, country: c.country, origin: c.origin,
      linkedinUrl: c.linkedinUrl || undefined, partnerId: c.partnerId,
    })), [cockpitRaw]);

  const allContacts = useMemo(() => {
    switch (activeTab) {
      case "outreach": return cockpitContacts;
      case "network": return partnerContacts;
      case "contatti": return [...cockpitContacts, ...partnerContacts];
      default: return [];
    }
  }, [activeTab, cockpitContacts, partnerContacts]);

  const selectedContact = useMemo(() =>
    allContacts.find(c => c.id === selectedId) || null, [allContacts, selectedId]);

  const openActivities = activities.filter(a => !["completed", "cancelled"].includes(a.status)).length;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header minimal */}
      <header className="h-12 border-b border-border/60 flex items-center gap-3 px-4 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")} aria-label="Indietro">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">WCA Partners</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Impostazioni">
          <Sparkles className="h-4 w-4 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/settings")} aria-label="Impostazioni">
          <Settings className="h-4 w-4" />
        </Button>
      </header>

      {/* AI Spotlight */}
      <div className="px-4 py-3 border-b border-border/40 bg-muted/20">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            placeholder="Cerca partner, scrivi email, trova contatto..."
            className="pl-10 pr-4 h-9 text-sm bg-background border-border/60 rounded-lg"
          />
          {aiQuery && (
            <Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" aria-label="Chiudi"
              onClick={() => setAiQuery("")}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-border/40 px-4 gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSelectedId(null); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <StatsBar stats={[
            { label: "contatti", value: allContacts.length, icon: Users },
            { label: "attività", value: openActivities, icon: CalendarCheck },
          ]} />
        </div>
      </div>

      {/* Quick Filters */}
      <QuickFilters chips={FILTER_CHIPS} active={activeFilters} onChange={setActiveFilters} />

      {/* Master-Detail */}
      <div className="flex-1 flex min-h-0">
        <div className={cn(
          "border-r border-border/40 transition-all",
          selectedId ? "w-[320px]" : "w-full max-w-md"
        )}>
          <UnifiedContactList
            contacts={allContacts}
            selected={selectedId}
            onSelect={c => setSelectedId(c.id)}
            compact={!!selectedId}
          />
        </div>
        {selectedId && (
          <div className="flex-1 flex flex-col min-w-0">
            <ContactDetail
              contact={selectedContact}
              onClose={() => setSelectedId(null)}
              className="flex-1"
            />
            <MiniAgenda className="m-3" />
          </div>
        )}
      </div>

      {/* Footer status */}
      <footer className="h-8 border-t border-border/40 flex items-center justify-between px-4 text-[10px] text-muted-foreground shrink-0">
        <span>Focus Flow — Prototipo A</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Sistema attivo
        </span>
      </footer>
    </div>
  );
}
