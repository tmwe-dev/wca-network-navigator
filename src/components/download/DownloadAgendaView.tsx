import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Mail, Phone, Building2, Globe, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";

interface PartnerRow {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  email: string | null;
  phone: string | null;
  wca_id: number | null;
  partner_networks: { network_name: string }[];
  partner_contacts: { name: string; email: string | null; mobile: string | null }[];
}

export function DownloadAgendaView() {
  const [search, setSearch] = useState("");
  const { data: jobs } = useDownloadJobs();

  const activeJob = useMemo(() => {
    if (!jobs) return null;
    return jobs.find(j => j.status === "running") || jobs.find(j => j.status === "pending") || jobs[0];
  }, [jobs]);

  const processedIds = useMemo(() => {
    if (!activeJob) return [];
    return (activeJob.processed_ids || []) as number[];
  }, [activeJob]);

  const { data: partners } = useQuery({
    queryKey: queryKeys.partners.downloadAgenda(activeJob?.country_code),
    queryFn: async () => {
      if (!activeJob) return [];
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, city, country_code, email, phone, wca_id, partner_networks(network_name), partner_contacts(name, email, mobile)")
        .eq("country_code", activeJob.country_code)
        .order("company_name");
      return (data || []) as PartnerRow[];
    },
    enabled: !!activeJob?.country_code,
  });

  const filtered = useMemo(() => {
    if (!partners) return [];
    if (search.length < 2) return partners;
    const q = search.toLowerCase();
    return partners.filter(p =>
      p.company_name.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  }, [partners, search]);

  const stats = useMemo(() => {
    if (!partners) return { total: 0, withEmail: 0, withPhone: 0, processed: 0 };
    const withEmail = partners.filter(p => p.email || p.partner_contacts?.some(c => c.email)).length;
    const withPhone = partners.filter(p => p.phone || p.partner_contacts?.some(c => c.mobile)).length;
    const processedSet = new Set(processedIds);
    const processed = partners.filter(p => p.wca_id && processedSet.has(p.wca_id)).length;
    return { total: partners.length, withEmail, withPhone, processed };
  }, [partners, processedIds]);

  return (
    <div className="flex flex-col h-full">
      {/* Header stats */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-500">
          <Mail className="w-3 h-3" />
          <span className="text-[10px] font-medium">{stats.withEmail}</span>
        </div>
        <div className="flex items-center gap-1.5 text-blue-400">
          <Phone className="w-3 h-3" />
          <span className="text-[10px] font-medium">{stats.withPhone}</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-400">
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-[10px] font-medium">{stats.processed} elaborati</span>
        </div>
        <div className="ml-auto relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca..."
            className="pl-7 h-7 w-40 text-xs bg-muted/30 border-border/30"
          />
        </div>
      </div>

      {/* Partner list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="divide-y divide-border/20">
          {filtered.map(p => {
            const isProcessed = p.wca_id ? new Set(processedIds).has(p.wca_id) : false;
            const hasEmail = !!(p.email || p.partner_contacts?.some(c => c.email));
            const hasPhone = !!(p.phone || p.partner_contacts?.some(c => c.mobile));
            const contactCount = p.partner_contacts?.length || 0;

            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-xs hover:bg-muted/20 transition-colors",
                  isProcessed && "bg-emerald-500/5"
                )}
              >
                <span className="text-base shrink-0">{getCountryFlag(p.country_code)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{p.company_name}</span>
                    {isProcessed ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                    ) : (
                      <Clock className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                  <span className="text-muted-foreground truncate">{p.city}</span>
                </div>

                {/* Network badges */}
                <div className="flex gap-1 shrink-0">
                  {(p.partner_networks || []).slice(0, 2).map(n => (
                    <Badge key={n.network_name} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                      {n.network_name}
                    </Badge>
                  ))}
                </div>

                {/* Data indicators */}
                <div className="flex gap-1.5 shrink-0">
                  {hasEmail ? (
                    <Mail className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Mail className="w-3 h-3 text-muted-foreground/20" />
                  )}
                  {hasPhone ? (
                    <Phone className="w-3 h-3 text-blue-400" />
                  ) : (
                    <Phone className="w-3 h-3 text-muted-foreground/20" />
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground w-6 text-right shrink-0">
                  {contactCount}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
