import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Mail, Phone, MapPin, Building2, User, ArrowLeft, ExternalLink, Users, ChevronRight, Shield, Send as SendIcon, Loader2, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryProspects } from "@/data/prospects";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/components/download/theme";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { AssignActivityDialog } from "@/components/partners/AssignActivityDialog";
import type { Prospect } from "@/hooks/useProspects";

import type { ProspectFilters } from "@/components/prospects/ProspectAdvancedFilters";
import { createActivities } from "@/data/activities";

interface ProspectListPanelProps {
  atecoCodes: string[];
  isDark: boolean;
  regionFilter?: string;
  provinceFilter?: string;
  quickSearch?: string;
  advFilters?: ProspectFilters;
}

function formatCurrency(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `€${(n / 1_000).toFixed(0)}K`;
  return `€${n.toFixed(0)}`;
}

function contactQuality(p: Prospect): "complete" | "partial" | "missing" {
  const hasEmail = !!p.email || !!p.pec;
  const hasPhone = !!p.phone;
  if (hasEmail && hasPhone) return "complete";
  if (hasEmail || hasPhone) return "partial";
  return "missing";
}

export function ProspectListPanel({ atecoCodes, isDark, regionFilter, provinceFilter, quickSearch, advFilters }: ProspectListPanelProps) {
  const th = t(isDark);
  const navigate = useAppNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "fatturato" | "dipendenti">("name");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects-by-ateco", atecoCodes, regionFilter, provinceFilter, quickSearch, advFilters],
    queryFn: async () => {
      const data = await queryProspects((query: any) => {
        if (quickSearch && quickSearch.length >= 2) {
          query = query.or(`company_name.ilike.%${quickSearch}%,partita_iva.ilike.%${quickSearch}%,codice_fiscale.ilike.%${quickSearch}%`);
        } else if (atecoCodes.length > 0) {
          query = query.in("codice_ateco", atecoCodes);
        }
        if (regionFilter) query = query.eq("region", regionFilter);
        if (provinceFilter) query = query.eq("province", provinceFilter);
        if (advFilters?.fatturato_min) query = query.gte("fatturato", parseInt(advFilters.fatturato_min) * 1000);
        if (advFilters?.fatturato_max) query = query.lte("fatturato", parseInt(advFilters.fatturato_max) * 1000);
        if (advFilters?.dipendenti_min) query = query.gte("dipendenti", parseInt(advFilters.dipendenti_min));
        if (advFilters?.dipendenti_max) query = query.lte("dipendenti", parseInt(advFilters.dipendenti_max));
        if (advFilters?.anno_fondazione_min) query = query.gte("data_costituzione", `${advFilters.anno_fondazione_min}-01-01`);
        if (advFilters?.anno_fondazione_max) query = query.lte("data_costituzione", `${advFilters.anno_fondazione_max}-12-31`);
        if (advFilters?.has_phone || advFilters?.has_phone_and_email) query = query.not("phone", "is", null);
        if (advFilters?.has_email || advFilters?.has_phone_and_email) query = query.not("email", "is", null);
        return query;
      });
      return data as unknown as Prospect[];
    },
    enabled: atecoCodes.length > 0 || (!!quickSearch && quickSearch.length >= 2),
  });

  const filtered = useMemo(() => {
    let list = prospects || [];
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.company_name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.province?.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case "name": return sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
      case "fatturato": return sorted.sort((a, b) => (b.fatturato || 0) - (a.fatturato || 0));
      case "dipendenti": return sorted.sort((a, b) => (b.dipendenti || 0) - (a.dipendenti || 0));
      default: return sorted;
    }
  }, [prospects, search, sortBy]);

  const selectedProspect = useMemo(() => filtered.find(p => p.id === selectedId), [filtered, selectedId]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const handleSendToWorkspace = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const targets = (filtered || []).filter(p => ids.includes(p.id));
    const withEmail = targets.filter(p => p.email || p.pec);
    if (!withEmail.length) { toast.error("Nessun prospect con email selezionato"); return; }

    setSending(true);
    try {
      const activities = withEmail.map(p => ({
        partner_id: null,
        source_type: "prospect" as const,
        source_id: p.id,
        activity_type: "send_email" as const,
        title: `Email a ${p.company_name}`,
        description: `Prospect: ${p.company_name} - ${p.email || p.pec}`,
        priority: "medium",
        source_meta: {
          company_name: p.company_name,
          email: p.email || p.pec || null,
          country: "Italia",
          country_code: "IT",
          city: p.city || null,
          website: p.website || null,
        },
      }));

      const CHUNK = 50;
      for (let i = 0; i < activities.length; i += CHUNK) {
        await createActivities(activities.slice(i, i + CHUNK));
      }
      toast.success(`${activities.length} attività create nel Workspace`);
      setSelectedIds(new Set());
      navigate("/workspace");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSending(false); }
  }, [selectedIds, filtered, navigate]);

  if (selectedId && selectedProspect) {
    return (
      <div className="h-full overflow-auto">
        <ProspectDetail prospect={selectedProspect} onBack={() => setSelectedId(null)} isDark={isDark} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
            <Input placeholder="Cerca prospect..." value={search} onChange={e => setSearch(e.target.value)} className={`pl-10 h-9 rounded-xl text-sm ${th.input}`} />
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
            <SelectTrigger className={`w-[140px] h-9 rounded-xl text-xs ${th.selTrigger}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={th.selContent}>
              <SelectItem value="name">Nome A-Z</SelectItem>
              <SelectItem value="fatturato">Fatturato ↓</SelectItem>
              <SelectItem value="dipendenti">Dipendenti ↓</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs ${th.dim}`}>
            {isLoading ? "Caricamento..." : `${filtered.length} prospect`}
            {selectedIds.size > 0 && <span className="ml-2 text-primary font-medium">· {selectedIds.size} selezionati</span>}
          </p>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5">
              <Button size="sm" onClick={() => setActivityDialogOpen(true)}
                className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                <ClipboardList className="w-3.5 h-3.5" />
                Attività ({selectedIds.size})
              </Button>
              <Button size="sm" onClick={handleSendToWorkspace} disabled={sending}
                className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendIcon className="w-3.5 h-3.5" />}
                Workspace ({selectedIds.size})
              </Button>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-border divide-y">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-28" /></div>
              ))
            : filtered.map(prospect => {
                const q = contactQuality(prospect);
                const isChecked = selectedIds.has(prospect.id);
                return (
                  <div
                    key={prospect.id}
                    className={cn(
                      "p-3 cursor-pointer transition-all duration-200 group flex items-start gap-2",
                      "hover:bg-muted/30",
                      q === "missing" && "border-l-4 border-l-destructive",
                      q === "partial" && "border-l-4 border-l-primary",
                      q === "complete" && "border-l-4 border-l-emerald-500",
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleSelect(prospect.id)}
                      className="mt-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0" onClick={() => setSelectedId(prospect.id)}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center bg-muted/30`}>
                          <Building2 className={`w-4 h-4 ${th.dim}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${th.h2}`}>{prospect.company_name}</p>
                              <p className={`text-xs truncate ${th.sub}`}>
                                {prospect.city && <span className="font-medium">{prospect.city}</span>}
                                {prospect.province && <span> ({prospect.province})</span>}
                              </p>
                            </div>
                            {prospect.fatturato != null && (
                              <span className={`text-xs font-mono font-bold shrink-0 ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                                {formatCurrency(prospect.fatturato)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <Mail className={cn("w-3.5 h-3.5", (prospect.email || prospect.pec) ? "text-primary" : "text-muted-foreground/20")} />
                            <Phone className={cn("w-3.5 h-3.5", prospect.phone ? "text-primary" : "text-muted-foreground/20")} />
                            {prospect.dipendenti != null && (
                              <span className={`flex items-center gap-0.5 ${th.dim}`}>
                                <Users className="w-3 h-3" />{prospect.dipendenti}
                              </span>
                            )}
                            {prospect.rating_affidabilita && (
                              <span className={`flex items-center gap-0.5 ${th.dim}`}>
                                <Shield className="w-3 h-3" />{prospect.rating_affidabilita}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 shrink-0 mt-1 ${th.dim} opacity-0 group-hover:opacity-100 transition-opacity`} />
                      </div>
                    </div>
                  </div>
                );
              })}
        </div>
      </ScrollArea>

      <AssignActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        partnerIds={Array.from(selectedIds)}
        partnerNames={Object.fromEntries(
          (filtered || []).filter(p => selectedIds.has(p.id)).map(p => [p.id, p.company_name])
        )}
        partnerContactInfo={(filtered || []).filter(p => selectedIds.has(p.id)).map(p => ({
          id: p.id,
          name: p.company_name,
          hasEmail: !!(p.email || p.pec),
          hasPhone: !!p.phone,
        }))}
        sourceType="prospect"
        extraSourceMeta={Object.fromEntries(
          (filtered || []).filter(p => selectedIds.has(p.id)).map(p => [p.id, {
            email: p.email || p.pec || null,
            country: "Italia",
            country_code: "IT",
            city: p.city || null,
            website: p.website || null,
          }])
        )}
        onSuccess={() => setSelectedIds(new Set())}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/* PROSPECT DETAIL                               */
/* ══════════════════════════════════════════════ */

function ProspectDetail({ prospect, onBack, isDark }: { prospect: Prospect; onBack: () => void; isDark: boolean }) {
  const th = t(isDark);
  const navigate = useAppNavigate();

  const { data: contacts = [] } = useQuery({
    queryKey: ["prospect-contacts", prospect.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_contacts" as any)
        .select("*")
        .eq("prospect_id", prospect.id);
      if (error) throw error;
      return data as any[];
    },
  });

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/50 border-white/80"}`}>
      <p className={`text-xs uppercase tracking-wider font-medium ${th.dim}`}>{title}</p>
      {children}
    </div>
  );

  const Field = ({ label, value, href }: { label: string; value?: string | number | null; href?: string }) => {
    if (value == null || value === "") return null;
    return (
      <div className="flex items-center justify-between text-xs py-1">
        <span className={th.dim}>{label}</span>
        {href ? (
          <a href={href} target="_blank" rel="noopener" className={`font-medium hover:underline ${th.body}`}>{value}</a>
        ) : (
          <span className={`font-medium ${th.body}`}>{value}</span>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={`p-1.5 rounded-lg transition-colors ${th.back}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`text-lg font-bold truncate ${th.h2}`}>{prospect.company_name}</h2>
          <p className={`text-sm ${th.sub}`}>
            <MapPin className="w-3.5 h-3.5 inline mr-1" />
            {prospect.city}{prospect.province && ` (${prospect.province})`}{prospect.region && `, ${prospect.region}`}
          </p>
        </div>
        {prospect.website && (
          <Button size="sm" variant="outline" asChild className="h-7 text-xs">
            <a href={prospect.website.startsWith("http") ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </Button>
        )}
      </div>

      {/* Anagrafica */}
      <Section title="Anagrafica">
        <Field label="Partita IVA" value={prospect.partita_iva} />
        <Field label="Codice Fiscale" value={prospect.codice_fiscale} />
        <Field label="Forma Giuridica" value={prospect.forma_giuridica} />
        <Field label="Data Costituzione" value={prospect.data_costituzione} />
        <Field label="Indirizzo" value={[prospect.address, prospect.cap, prospect.city].filter(Boolean).join(", ")} />
        <Field label="Codice ATECO" value={prospect.codice_ateco ? `${prospect.codice_ateco} - ${prospect.descrizione_ateco}` : null} />
      </Section>

      {/* Contatti — azioni interattive */}
      <Section title="Contatti Aziendali">
        {prospect.email && (
          <div className="flex items-center justify-between text-xs py-1">
            <span className={th.dim}>Email</span>
            <button onClick={() => navigate("/email-composer", { state: { prefilledRecipient: { email: prospect.email, company: prospect.company_name } } })} className={`font-medium hover:underline ${th.body} cursor-pointer`}>{prospect.email}</button>
          </div>
        )}
        <Field label="PEC" value={prospect.pec} href={prospect.pec ? `mailto:${prospect.pec}` : undefined} />
        <Field label="Telefono" value={prospect.phone} href={prospect.phone ? `tel:${prospect.phone}` : undefined} />
        <Field label="Sito Web" value={prospect.website} href={prospect.website?.startsWith("http") ? prospect.website : prospect.website ? `https://${prospect.website}` : undefined} />
      </Section>

      {/* Dati Finanziari */}
      <Section title="Dati Finanziari">
        <Field label="Fatturato" value={prospect.fatturato ? formatCurrency(prospect.fatturato) : null} />
        <Field label="Utile" value={prospect.utile ? formatCurrency(prospect.utile) : null} />
        <Field label="Dipendenti" value={prospect.dipendenti} />
        <Field label="Anno Bilancio" value={prospect.anno_bilancio} />
        <Field label="Rating" value={prospect.rating_affidabilita} />
        <Field label="Credit Score" value={prospect.credit_score} />
      </Section>

      {/* Contatti Personali (Management) */}
      {contacts.length > 0 && (
        <Section title={`Management (${contacts.length})`}>
          {contacts.map((c: any) => (
            <div key={c.id} className={`p-2.5 rounded-lg border bg-card/40 border-border`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm font-medium ${th.h2}`}>{c.name}</span>
                {c.role && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{c.role}</span>}
                <div className="flex items-center gap-1 ml-auto">
                  <Mail className={cn("w-3.5 h-3.5", c.email ? "text-primary" : "text-muted-foreground/20")} />
                  <Phone className={cn("w-3.5 h-3.5", c.phone ? "text-primary" : "text-muted-foreground/20")} />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs ml-6 mt-1 flex-wrap">
                {c.email && <button onClick={(e) => { e.stopPropagation(); navigate("/email-composer", { state: { prefilledRecipient: { email: c.email, name: c.name, company: prospect.company_name } } }); }} className={`hover:underline ${th.body} cursor-pointer`}>{c.email}</button>}
                {c.phone && <a href={`tel:${c.phone}`} className={`hover:underline ${th.body}`}>{c.phone}</a>}
                {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noopener" className={`hover:underline ${th.body}`}>LinkedIn</a>}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
