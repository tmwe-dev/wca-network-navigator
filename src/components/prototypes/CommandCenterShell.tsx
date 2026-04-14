import { useState, useMemo } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Home, Users, Radar, CalendarCheck, Settings, Search, ArrowLeft, Activity, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCockpitContacts } from "@/hooks/useCockpitContacts";
import { useAllActivities } from "@/hooks/useActivities";
import { useProspectStats } from "@/hooks/useProspectStats";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useDailyBriefing } from "@/hooks/useDailyBriefing";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { countActivePartners } from "@/data/partners";
import { MiniAgenda } from "./shared/MiniAgenda";
import { UnifiedContactList, type UnifiedContact } from "./shared/UnifiedContactList";
import { ContactDetail } from "./shared/ContactDetail";

const NAV_ITEMS = [
  { key: "home", icon: Home, label: "Home" },
  { key: "contatti", icon: Users, label: "Contatti" },
  { key: "outreach", icon: Radar, label: "Outreach" },
  { key: "agenda", icon: CalendarCheck, label: "Agenda" },
  { key: "settings", icon: Settings, label: "Impostazioni" },
] as const;

function usePartnerCount() {
  return useQuery({
    queryKey: ["proto-partner-count"],
    queryFn: async () => {
      const count = await countActivePartners();
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

function useRecentContacts() {
  return useQuery({
    queryKey: ["proto-recent-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_contacts")
        .select("id, first_name, last_name, email, phone, partners(id, company_name, country_code)")
        .order("created_at", { ascending: false })
        .limit(100);
      return ((data || []) as any[]).map((pc) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON/dynamic type
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

function WidgetCard({ title, children, icon: Icon, className }: { title: string; children: React.ReactNode; icon: typeof Activity; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function CommandCenterShell() {
  const navigate = useAppNavigate();
  const [section, setSection] = useState<string>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { contacts: cockpitRaw = [] } = useCockpitContacts();
  const { data: activities = [] } = useAllActivities();
  const { data: jobs = [] } = useDownloadJobs();
  const { data: briefing } = useDailyBriefing();
  const { data: partnerCount = 0 } = usePartnerCount();
  const { data: recentContacts = [] } = useRecentContacts();
  const { data: prospectStats } = useProspectStats();

  const cockpitContacts: UnifiedContact[] = useMemo(() =>
    cockpitRaw.map(c => ({
      id: c.id, name: c.name, company: c.company, email: c.email || undefined,
      phone: c.phone || undefined, country: c.country, origin: c.origin,
      linkedinUrl: c.linkedinUrl || undefined, partnerId: c.partnerId,
    })), [cockpitRaw]);

  const openActivities = activities.filter(a => !["completed", "cancelled"].includes(a.status)).length;
  const activeJobs = jobs.filter(j => ["pending", "running"].includes(j.status)).length;

  return (
    <div className="h-screen flex bg-background text-foreground">
      {/* Icon sidebar */}
      <aside className="w-14 border-r border-border/60 flex flex-col items-center py-3 gap-1 shrink-0 bg-muted/20">
        <Button variant="ghost" size="icon" className="h-9 w-9 mb-2" aria-label="Indietro" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            onClick={() => { setSection(item.key); setSelectedId(null); }}
            title={item.label}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              section === item.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <item.icon className="h-4 w-4" />
          </button>
        ))}
        <div className="mt-auto">
          <button
            onClick={() => setSection("search")}
            className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              section === "search" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title="Cerca"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-11 border-b border-border/40 flex items-center px-4 shrink-0">
          <span className="text-sm font-semibold">
            {NAV_ITEMS.find(n => n.key === section)?.label || "Cerca"}
          </span>
          <span className="ml-2 text-[10px] text-muted-foreground">Command Center — Prototipo B</span>
        </header>

        <ScrollArea className="flex-1">
          {section === "home" && (
            <div className="p-4 space-y-4 max-w-4xl mx-auto">
              {/* Briefing */}
              <WidgetCard title="Briefing AI" icon={Sparkles}>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {briefing?.summary || "Caricamento briefing..."}
                </p>
              </WidgetCard>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pipeline */}
                <WidgetCard title="Pipeline Outreach" icon={Radar}>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Contatti nel cockpit</span>
                      <span className="font-semibold">{cockpitRaw.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Con email pronta</span>
                      <span className="font-semibold">{cockpitRaw.filter(c => c.email).length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Attività aperte</span>
                      <span className="font-semibold">{openActivities}</span>
                    </div>
                    {activeJobs > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Download attivi</span>
                        <span className="font-semibold text-primary">{activeJobs}</span>
                      </div>
                    )}
                  </div>
                </WidgetCard>

                {/* Agenda oggi */}
                <MiniAgenda />
              </div>

              {/* Contatti recenti */}
              <WidgetCard title="Contatti recenti" icon={Users}>
                <div className="space-y-1.5">
                  {recentContacts.slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between text-xs py-1">
                      <div>
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-muted-foreground ml-2">{c.company}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{c.country}</span>
                    </div>
                  ))}
                </div>
              </WidgetCard>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Partner", value: partnerCount },
                  { label: "Prospect", value: prospectStats?.total ?? 0 },
                  { label: "Attività", value: openActivities },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-border/60 bg-card p-3 text-center">
                    <div className="text-lg font-bold text-foreground">{s.value}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === "contatti" && (
            <div className="flex h-[calc(100vh-3rem)] min-h-0">
              <div className={cn("border-r border-border/40", selectedId ? "w-[320px]" : "flex-1 max-w-md")}>
                <UnifiedContactList
                  contacts={[...cockpitContacts, ...recentContacts]}
                  selected={selectedId}
                  onSelect={c => setSelectedId(c.id)}
                />
              </div>
              {selectedId && (
                <ContactDetail
                  contact={[...cockpitContacts, ...recentContacts].find(c => c.id === selectedId) || null}
                  onClose={() => setSelectedId(null)}
                  className="flex-1"
                />
              )}
            </div>
          )}

          {section === "outreach" && (
            <div className="flex h-[calc(100vh-3rem)] min-h-0">
              <div className={cn("border-r border-border/40", selectedId ? "w-[320px]" : "flex-1 max-w-md")}>
                <UnifiedContactList
                  contacts={cockpitContacts}
                  selected={selectedId}
                  onSelect={c => setSelectedId(c.id)}
                />
              </div>
              {selectedId && (
                <ContactDetail
                  contact={cockpitContacts.find(c => c.id === selectedId) || null}
                  onClose={() => setSelectedId(null)}
                  className="flex-1"
                />
              )}
            </div>
          )}

          {section === "agenda" && (
            <div className="p-4 max-w-2xl mx-auto">
              <MiniAgenda />
            </div>
          )}

          {section === "settings" && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <Settings className="h-8 w-8 mx-auto mb-3 text-muted-foreground/40" />
              <p>Le impostazioni sono accessibili dalla versione completa</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/settings")}>
                Vai alle impostazioni
              </Button>
            </div>
          )}

          {section === "search" && (
            <div className="p-4 max-w-2xl mx-auto">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Ricerca globale..."
                  className="pl-10 h-9"
                  autoFocus
                />
              </div>
              <UnifiedContactList
                contacts={[...cockpitContacts, ...recentContacts]}
                selected={selectedId}
                onSelect={c => setSelectedId(c.id)}
              />
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Slide-in detail (on larger screens) */}
    </div>
  );
}
