import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Mail, Phone, ArrowUpDown } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { queryKeys } from "@/lib/queryKeys";

interface PartnerRow {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  phone: string | null;
  lead_status: string;
  updated_at: string;
  partner_networks: { network_name: string }[];
  partner_contacts: { name: string; email: string | null; mobile: string | null }[];
}

type SortKey = "company_name" | "country_name" | "updated_at";

export default function AgendaListView() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);

  const { data: partners, isLoading } = useQuery({
    queryKey: queryKeys.partners.agendaList(),
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, city, country_code, country_name, email, phone, lead_status, updated_at, partner_networks(network_name), partner_contacts(name, email, mobile)")
        .order("updated_at", { ascending: false })
        .limit(500);
      return (data || []) as PartnerRow[];
    },
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    if (!partners) return [];
    let list = partners;
    if (search.length >= 2) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.company_name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.country_name?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const valA = a[sortKey] || "";
      const valB = b[sortKey] || "";
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }, [partners, search, sortKey, sortAsc]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 flex-shrink-0">
        <span className="text-xs font-bold text-muted-foreground">{filtered.length} righe</span>
        <div className="ml-auto relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca..."
            className="pl-7 h-7 w-48 text-xs bg-muted/30 border-border/30"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent text-[10px]">
              <TableHead className="w-8" />
              <TableHead className="cursor-pointer" onClick={() => toggleSort("company_name")}>
                <span className="flex items-center gap-1">Azienda <ArrowUpDown className="w-3 h-3" /></span>
              </TableHead>
              <TableHead>Città</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("country_name")}>
                <span className="flex items-center gap-1">Paese <ArrowUpDown className="w-3 h-3" /></span>
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tel</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Contatti</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="cursor-pointer" onClick={() => toggleSort("updated_at")}>
                <span className="flex items-center gap-1">Aggiorn. <ArrowUpDown className="w-3 h-3" /></span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => {
              const hasEmail = !!(p.email || p.partner_contacts?.some(c => c.email));
              const hasPhone = !!(p.phone || p.partner_contacts?.some(c => c.mobile));
              return (
                <TableRow key={p.id} className="text-[11px] hover:bg-muted/20">
                  <TableCell className="py-1.5">{getCountryFlag(p.country_code)}</TableCell>
                  <TableCell className="py-1.5 font-medium truncate max-w-[180px]">{p.company_name}</TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">{p.city}</TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">{p.country_name}</TableCell>
                  <TableCell className="py-1.5">
                    {hasEmail ? <Mail className="w-3.5 h-3.5 text-emerald-500" /> : <Mail className="w-3.5 h-3.5 text-muted-foreground/20" />}
                  </TableCell>
                  <TableCell className="py-1.5">
                    {hasPhone ? <Phone className="w-3.5 h-3.5 text-blue-400" /> : <Phone className="w-3.5 h-3.5 text-muted-foreground/20" />}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex gap-1">
                      {(p.partner_networks || []).slice(0, 2).map(n => (
                        <Badge key={n.network_name} variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                          {n.network_name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5 text-center">{p.partner_contacts?.length || 0}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className={cn(
                      "text-[8px] px-1.5 py-0 h-4",
                      p.lead_status === "qualified" && "border-emerald-500/30 text-emerald-500",
                      p.lead_status === "first_touch_sent" && "border-blue-500/30 text-blue-500",
                    )}>
                      {p.lead_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-muted-foreground text-[10px]">
                    {p.updated_at ? format(new Date(p.updated_at), "dd/MM") : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
