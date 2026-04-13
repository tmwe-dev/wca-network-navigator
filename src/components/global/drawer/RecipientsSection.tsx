import { Input } from "@/components/ui/input";
import { Search, Building2, Mail, Users, Plus, X, Sparkles } from "lucide-react";
import { useMission } from "@/contexts/MissionContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  search: string;
  setSearch: (s: string) => void;
}

export function RecipientsSection({ search, setSearch }: Props) {
  const m = useMission();

  const { data: searchResults = [] } = useQuery({
    queryKey: ["mission-recipient-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const q = `%${search}%`;
      const { data, error } = await supabase
        .from("partners")
        .select("id, company_name, country_name, city, email, enriched_at")
        .or(`company_name.ilike.${q},city.ilike.${q},country_name.ilike.${q}`)
        .order("company_name")
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const handleAdd = (p: Record<string, unknown>) => {
    m.addRecipient({
      partnerId: p.id as string,
      companyName: p.company_name as string,
      email: p.email as string | undefined,
      city: p.city as string | undefined,
      countryName: p.country_name as string | undefined,
      countryCode: (p.country_code as string) || undefined,
      isEnriched: !!p.enriched_at,
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 flex items-center justify-center">
          <Users className="w-4 h-4 text-emerald-500" />
        </div>
        <span className="text-sm font-bold text-foreground">Destinatari</span>
        {m.recipients.length > 0 && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">{m.recipients.length}</span>
        )}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca azienda..." className="h-9 text-xs pl-9 border-border/40 bg-muted/10" />
      </div>
      {search.length >= 2 && searchResults.length > 0 && (
        <div className="max-h-[160px] overflow-y-auto space-y-0.5 rounded-lg border border-border/20 p-1">
          {searchResults.map((p) => (
            <button key={p.id} onClick={() => handleAdd(p as unknown as Record<string, unknown>)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary/5 transition-colors text-left">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{p.company_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{p.city}, {p.country_name}</p>
              </div>
              {p.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
              <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
      {m.recipients.length > 0 && (
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {m.recipients.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/15 border border-border/15 group">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{r.companyName}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.city}, {r.countryName}</p>
              </div>
              {r.email && <Mail className="w-3 h-3 text-emerald-500 shrink-0" />}
              {r.isEnriched && <Sparkles className="w-3 h-3 text-primary shrink-0" />}
              <button onClick={() => m.removeRecipient(i)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded">
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
          <button onClick={m.clearRecipients} className="w-full text-center text-[10px] text-destructive hover:underline py-1">Rimuovi tutti</button>
        </div>
      )}
    </div>
  );
}
