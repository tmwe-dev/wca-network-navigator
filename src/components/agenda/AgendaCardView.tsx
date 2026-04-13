import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Search, Mail, Phone, User, Building2, MapPin } from "lucide-react";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface PartnerCard {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  wca_id: number | null;
  lead_status: string;
  partner_networks: { network_name: string }[];
  partner_contacts: { name: string; email: string | null; mobile: string | null; title: string | null }[];
}

const leadStatusLabel: Record<string, string> = {
  new: "Nuovo — mai contattato",
  contacted: "Contattato — in attesa di risposta",
  qualified: "Qualificato — lead valido",
  converted: "Convertito — cliente attivo",
  lost: "Perso — opportunità chiusa",
};

export default function AgendaCardView() {
  const [search, setSearch] = useState("");

  const { data: partners, isLoading } = useQuery({
    queryKey: ["agenda-card-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, company_name, city, country_code, country_name, email, phone, website, wca_id, lead_status, partner_networks(network_name), partner_contacts(name, email, mobile, title)")
        .order("updated_at", { ascending: false })
        .limit(200);
      return (data || []) as PartnerCard[];
    },
  });

  const filtered = useMemo(() => {
    if (!partners) return [];
    if (search.length < 2) return partners;
    const q = search.toLowerCase();
    return partners.filter(p =>
      p.company_name.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.country_name?.toLowerCase().includes(q)
    );
  }, [partners, search]);

  const stats = useMemo(() => {
    if (!partners) return { total: 0, withEmail: 0, withPhone: 0, withContacts: 0 };
    return {
      total: partners.length,
      withEmail: partners.filter(p => p.email || p.partner_contacts?.some(c => c.email)).length,
      withPhone: partners.filter(p => p.phone || p.partner_contacts?.some(c => c.mobile)).length,
      withContacts: partners.filter(p => p.partner_contacts?.length > 0).length,
    };
  }, [partners]);

  if (isLoading) {
    return (
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Stats header */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-b border-border/30 glass-panel flex-shrink-0">
          <InfoTooltip content={`${stats.total} partner totali nel database`}>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold">{stats.total}</span>
              <span className="text-[10px] text-muted-foreground">partner</span>
            </div>
          </InfoTooltip>
          <InfoTooltip content={`${stats.withEmail} partner con almeno un indirizzo email`}>
            <div className="flex items-center gap-1.5 text-emerald-500">
              <Mail className="w-3 h-3" />
              <span className="text-[10px] font-medium">{stats.withEmail}</span>
            </div>
          </InfoTooltip>
          <InfoTooltip content={`${stats.withPhone} partner con almeno un numero di telefono`}>
            <div className="flex items-center gap-1.5 text-blue-400">
              <Phone className="w-3 h-3" />
              <span className="text-[10px] font-medium">{stats.withPhone}</span>
            </div>
          </InfoTooltip>
          <InfoTooltip content={`${stats.withContacts} partner con contatti nominativi registrati`}>
            <div className="flex items-center gap-1.5 text-violet-400">
              <User className="w-3 h-3" />
              <span className="text-[10px] font-medium">{stats.withContacts}</span>
            </div>
          </InfoTooltip>
          <div className="ml-auto relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca partner..."
              className="pl-7 h-7 w-48 text-xs bg-muted/30 border-border/30"
            />
          </div>
        </div>

        {/* Cards grid */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(p => {
              const hasEmail = !!(p.email || p.partner_contacts?.some(c => c.email));
              const hasPhone = !!(p.phone || p.partner_contacts?.some(c => c.mobile));
              const contactCount = p.partner_contacts?.length || 0;
              const completeness = [hasEmail, hasPhone, contactCount > 0, !!p.website].filter(Boolean).length;
              const allEmails = [p.email, ...(p.partner_contacts?.map(c => c.email) || [])].filter(Boolean);
              const allPhones = [p.phone, ...(p.partner_contacts?.map(c => c.mobile) || [])].filter(Boolean);

              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-3 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all group"
                >
                  {/* Completeness bar */}
                  <InfoTooltip content={`Completezza dati: ${completeness}/4 (${hasEmail ? "✓" : "✗"} Email, ${hasPhone ? "✓" : "✗"} Tel, ${contactCount > 0 ? "✓" : "✗"} Contatti, ${p.website ? "✓" : "✗"} Sito)`}>
                    <div className="flex gap-0.5 mb-2">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            i < completeness ? "bg-primary/60" : "bg-muted/30"
                          )}
                        />
                      ))}
                    </div>
                  </InfoTooltip>

                  {/* Header */}
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-muted/40 flex items-center justify-center text-xl shrink-0">
                      {getCountryFlag(p.country_code)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                        {p.company_name}
                      </h4>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="w-2.5 h-2.5" />
                        <span className="truncate">{p.city}, {p.country_name}</span>
                      </div>
                    </div>
                    <InfoTooltip content={leadStatusLabel[p.lead_status] || p.lead_status}>
                      <span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] px-1.5 py-0 h-4 shrink-0",
                            p.lead_status === "qualified" && "border-emerald-500/30 text-emerald-500",
                            p.lead_status === "contacted" && "border-blue-500/30 text-blue-500",
                            p.lead_status === "new" && "border-muted-foreground/30 text-muted-foreground"
                          )}
                        >
                          {p.lead_status}
                        </Badge>
                      </span>
                    </InfoTooltip>
                  </div>

                  {/* Networks */}
                  {p.partner_networks?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {p.partner_networks.slice(0, 4).map(n => (
                        <InfoTooltip key={n.network_name} content={`Membro del network ${n.network_name}`}>
                          <span>
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5 bg-muted/20">
                              {n.network_name}
                            </Badge>
                          </span>
                        </InfoTooltip>
                      ))}
                      {p.partner_networks.length > 4 && (
                        <InfoTooltip content={`Altri network: ${p.partner_networks.slice(4).map(n => n.network_name).join(", ")}`}>
                          <span>
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5 bg-muted/20">
                              +{p.partner_networks.length - 4}
                            </Badge>
                          </span>
                        </InfoTooltip>
                      )}
                    </div>
                  )}

                  {/* Data row */}
                  <div className="flex items-center gap-2 text-[10px]">
                    <InfoTooltip content={hasEmail ? `Email: ${allEmails.join(", ")}` : "Nessuna email disponibile"}>
                      <span className={cn("flex items-center gap-1", hasEmail ? "text-emerald-500" : "text-muted-foreground/30")}>
                        <Mail className="w-3 h-3" /> Email
                      </span>
                    </InfoTooltip>
                    <InfoTooltip content={hasPhone ? `Telefono: ${allPhones.join(", ")}` : "Nessun telefono disponibile"}>
                      <span className={cn("flex items-center gap-1", hasPhone ? "text-blue-400" : "text-muted-foreground/30")}>
                        <Phone className="w-3 h-3" /> Tel
                      </span>
                    </InfoTooltip>
                    <InfoTooltip content={contactCount > 0
                      ? `Contatti: ${p.partner_contacts.map(c => `${c.name}${c.title ? ` (${c.title})` : ""}`).join(", ")}`
                      : "Nessun contatto nominativo registrato"
                    }>
                      <span className="ml-auto text-muted-foreground">
                        {contactCount} contatti
                      </span>
                    </InfoTooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
