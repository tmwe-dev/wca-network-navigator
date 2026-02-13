import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Mail, Phone, Globe, MapPin, Building2, User,
  ArrowLeft, ExternalLink, Euro, Users, FileText, ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { t } from "@/components/download/theme";
import type { Prospect } from "@/hooks/useProspects";

interface ProspectListPanelProps {
  atecoCodes: string[];
  isDark: boolean;
  regionFilter?: string;
  provinceFilter?: string;
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

export function ProspectListPanel({ atecoCodes, isDark, regionFilter, provinceFilter }: ProspectListPanelProps) {
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "fatturato" | "dipendenti">("name");

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects-by-ateco", atecoCodes, regionFilter, provinceFilter],
    queryFn: async () => {
      let query = supabase.from("prospects" as any).select("*").order("company_name");
      if (atecoCodes.length > 0) {
        query = query.in("codice_ateco", atecoCodes);
      }
      if (regionFilter) query = query.eq("region", regionFilter);
      if (provinceFilter) query = query.eq("province", provinceFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Prospect[];
    },
    enabled: atecoCodes.length > 0,
  });

  const filtered = useMemo(() => {
    let list = prospects || [];
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.company_name.toLowerCase().includes(q) ||
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

  // Detail view
  const selectedProspect = useMemo(() => filtered.find(p => p.id === selectedId), [filtered, selectedId]);

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
        <p className={`text-xs ${th.dim}`}>
          {isLoading ? "Caricamento..." : `${filtered.length} prospect`}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className={`${isDark ? "divide-white/[0.06]" : "divide-slate-200/60"} divide-y`}>
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-28" /></div>
              ))
            : filtered.map(prospect => {
                const q = contactQuality(prospect);
                return (
                  <div
                    key={prospect.id}
                    onClick={() => setSelectedId(prospect.id)}
                    className={`p-3 cursor-pointer transition-all duration-200 group ${
                      isDark ? "hover:bg-white/[0.06]" : "hover:bg-sky-50/50"
                    } ${
                      q === "missing" ? "border-l-4 border-l-red-500" :
                      q === "partial" ? "border-l-4 border-l-amber-400" :
                      "border-l-4 border-l-emerald-500"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`}>
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
                          <Mail className={`w-3.5 h-3.5 ${prospect.email || prospect.pec ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200"}`} />
                          <Phone className={`w-3.5 h-3.5 ${prospect.phone ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200"}`} />
                          {prospect.dipendenti != null && (
                            <span className={`flex items-center gap-0.5 ${th.dim}`}>
                              <Users className="w-3 h-3" />{prospect.dipendenti}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 mt-1 ${th.dim} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </div>
                  </div>
                );
              })}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ══════════════════════════════════════════════ */
/* PROSPECT DETAIL                               */
/* ══════════════════════════════════════════════ */

function ProspectDetail({ prospect, onBack, isDark }: { prospect: Prospect; onBack: () => void; isDark: boolean }) {
  const th = t(isDark);

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
    if (!value) return null;
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

      {/* Contatti */}
      <Section title="Contatti Aziendali">
        <Field label="Email" value={prospect.email} href={prospect.email ? `mailto:${prospect.email}` : undefined} />
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

      {/* Contatti Personali */}
      {contacts.length > 0 && (
        <Section title={`Contatti Personali (${contacts.length})`}>
          {contacts.map((c: any) => (
            <div key={c.id} className={`p-2.5 rounded-lg border ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/60 border-slate-200/60"}`}>
              <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${th.dim}`} />
                <span className={`text-sm font-medium ${th.h2}`}>{c.name}</span>
                {c.role && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? "bg-white/[0.06] text-slate-400" : "bg-slate-100 text-slate-500"}`}>{c.role}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs ml-6 mt-1 flex-wrap">
                {c.email && <a href={`mailto:${c.email}`} className={`hover:underline ${th.body}`}>{c.email}</a>}
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
