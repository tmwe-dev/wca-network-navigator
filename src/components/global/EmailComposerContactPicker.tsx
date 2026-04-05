import { useState, useMemo, useRef } from "react";
import { Search, Users, Globe, CreditCard, UserPlus, ChevronRight, Mail, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMission } from "@/contexts/MissionContext";
import { useQuery } from "@tanstack/react-query";
import { getCountryFlag } from "@/lib/countries";
import type { SelectedRecipient } from "@/contexts/MissionContext";

type PickerTab = "partners" | "contacts" | "bca";

const TABS: { value: PickerTab; label: string; icon: typeof Users }[] = [
  { value: "partners", label: "Partner", icon: Globe },
  { value: "contacts", label: "Contatti", icon: Users },
  { value: "bca", label: "BCA", icon: CreditCard },
];

export function EmailComposerContactPicker() {
  const [tab, setTab] = useState<PickerTab>("partners");
  const [search, setSearch] = useState("");
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const { addRecipient, recipients, removeRecipient } = useMission();
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldSearch = search.length >= 3 || !!selectedCountry;

  // Country stats
  const { data: countryStats = [] } = useQuery({
    queryKey: ["picker-country-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("country_code")
        .not("country_code", "is", null);
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach(r => { const cc = r.country_code!; counts[cc] = (counts[cc] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({ code, count, flag: getCountryFlag(code) }));
    },
  });

  // Partners search
  const { data: partners = [] } = useQuery({
    queryKey: ["picker-partners", search, selectedCountry],
    enabled: tab === "partners" && shouldSearch,
    queryFn: async () => {
      let q = supabase
        .from("partners")
        .select("id, company_name, country_code, city");
      if (search.length >= 3) q = q.ilike("company_name", `%${search}%`);
      if (selectedCountry) q = q.eq("country_code", selectedCountry);
      const { data } = await q.order("company_name").limit(50);
      return data || [];
    },
  });

  // Partner contacts (when expanded)
  const { data: partnerContacts = [] } = useQuery({
    queryKey: ["picker-partner-contacts", expandedPartner],
    enabled: !!expandedPartner,
    queryFn: async () => {
      const { data } = await supabase
        .from("partner_contacts")
        .select("id, name, email, title")
        .eq("partner_id", expandedPartner!)
        .order("is_primary", { ascending: false });
      return data || [];
    },
  });

  // Imported contacts search
  const { data: contacts = [] } = useQuery({
    queryKey: ["picker-contacts", search],
    enabled: tab === "contacts" && shouldSearch,
    queryFn: async () => {
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, country")
        .or(`name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(30);
      return data || [];
    },
  });

  // Business cards search
  const { data: bcaCards = [] } = useQuery({
    queryKey: ["picker-bca", search],
    enabled: tab === "bca" && shouldSearch,
    queryFn: async () => {
      const { data } = await supabase
        .from("business_cards")
        .select("id, contact_name, company_name, email, location, matched_partner_id")
        .or(`contact_name.ilike.%${search}%,company_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(30);
      return data || [];
    },
  });

  const isSelected = (partnerId: string, contactId?: string) => {
    return recipients.some(r =>
      r.partnerId === partnerId && (contactId ? r.contactId === contactId : !r.contactId)
    );
  };

  const handleSelectPartner = (p: typeof partners[0]) => {
    if (isSelected(p.id)) return;
    addRecipient({
      partnerId: p.id,
      companyName: p.company_name || "",
      email: null,
      city: p.city || "",
      countryName: p.country_code || "",
      isEnriched: false,
    });
  };

  const handleSelectContact = (partnerId: string, companyName: string, c: typeof partnerContacts[0]) => {
    if (isSelected(partnerId, c.id)) return;
    addRecipient({
      partnerId,
      companyName,
      contactId: c.id,
      contactName: c.name,
      email: c.email,
      city: "",
      countryName: "",
      isEnriched: !!c.email,
    });
  };

  const handleSelectImported = (c: typeof contacts[0]) => {
    if (isSelected(c.id)) return;
    addRecipient({
      partnerId: c.id,
      companyName: c.company_name || "",
      contactName: c.name || undefined,
      email: c.email,
      city: "",
      countryName: c.country || "",
      isEnriched: !!c.email,
    });
  };

  const handleSelectBca = (c: typeof bcaCards[0]) => {
    const pid = c.matched_partner_id || c.id;
    if (isSelected(pid)) return;
    addRecipient({
      partnerId: pid,
      companyName: c.company_name || "",
      contactName: c.contact_name || undefined,
      email: c.email,
      city: c.location || "",
      countryName: "",
      isEnriched: !!c.email,
    });
  };

  return (
    <div className="space-y-3">
      {/* Selected recipients */}
      {recipients.length > 0 && (
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <UserPlus className="w-3 h-3" /> Selezionati ({recipients.length})
          </label>
          <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto">
            {recipients.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
                {r.contactName || r.companyName}
                {r.email && <Mail className="w-2.5 h-2.5 opacity-60" />}
                <button onClick={() => removeRecipient(i)} className="hover:text-destructive">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setSearch(""); setExpandedPartner(null); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border",
              tab === t.value
                ? "bg-primary/15 border-primary/30 text-primary"
                : "border-border/40 text-muted-foreground hover:bg-muted/40"
            )}
          >
            <t.icon className="w-3 h-3" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca (min. 3 caratteri)..."
          className="h-8 text-xs bg-muted/30 border-border/40 pl-8"
        />
      </div>

      {/* Results */}
      <ScrollArea className="max-h-[400px]">
        {!shouldSearch && (
          <p className="text-[11px] text-muted-foreground text-center py-4">
            Digita almeno 3 caratteri per cercare
          </p>
        )}

        {/* Partners */}
        {tab === "partners" && shouldSearch && (
          <div className="space-y-0.5">
            {partners.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Nessun risultato</p>}
            {partners.map(p => (
              <div key={p.id}>
                <button
                  onClick={() => setExpandedPartner(expandedPartner === p.id ? null : p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all hover:bg-muted/40",
                    expandedPartner === p.id && "bg-muted/30"
                  )}
                >
                  <ChevronRight className={cn("w-3 h-3 transition-transform", expandedPartner === p.id && "rotate-90")} />
                  <span className="flex-1 text-left truncate font-medium">{p.company_name}</span>
                  {p.country_code && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{p.country_code}</Badge>}
                  {!isSelected(p.id) && (
                    <button
                      onClick={e => { e.stopPropagation(); handleSelectPartner(p); }}
                      className="text-[9px] text-primary hover:underline"
                    >
                      +Azienda
                    </button>
                  )}
                  {isSelected(p.id) && <Badge className="text-[8px] h-3.5 px-1 bg-primary/20 text-primary border-0">✓</Badge>}
                </button>
                {expandedPartner === p.id && partnerContacts.length > 0 && (
                  <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-primary/20 pl-2">
                    {partnerContacts.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectContact(p.id, p.company_name || "", c)}
                        disabled={isSelected(p.id, c.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-all",
                          isSelected(p.id, c.id) ? "opacity-50" : "hover:bg-primary/5"
                        )}
                      >
                        <span className="flex-1 text-left truncate">{c.name}</span>
                        {c.title && <span className="text-muted-foreground truncate max-w-[80px]">{c.title}</span>}
                        {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                        {isSelected(p.id, c.id)
                          ? <span className="text-primary text-[9px]">✓</span>
                          : <span className="text-primary text-[9px]">+</span>
                        }
                      </button>
                    ))}
                  </div>
                )}
                {expandedPartner === p.id && partnerContacts.length === 0 && (
                  <p className="ml-7 text-[10px] text-muted-foreground py-1">Nessun contatto</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Imported contacts */}
        {tab === "contacts" && shouldSearch && (
          <div className="space-y-0.5">
            {contacts.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Nessun risultato</p>}
            {contacts.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectImported(c)}
                disabled={isSelected(c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                  isSelected(c.id) ? "opacity-50 bg-muted/20" : "hover:bg-muted/40"
                )}
              >
                <span className="flex-1 text-left truncate font-medium">{c.name || c.company_name}</span>
                {c.company_name && c.name && <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{c.company_name}</span>}
                {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                {isSelected(c.id) ? <span className="text-primary text-[9px]">✓</span> : <span className="text-primary text-[9px]">+</span>}
              </button>
            ))}
          </div>
        )}

        {/* BCA */}
        {tab === "bca" && shouldSearch && (
          <div className="space-y-0.5">
            {bcaCards.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-3">Nessun risultato</p>}
            {bcaCards.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectBca(c)}
                disabled={isSelected(c.matched_partner_id || c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                  isSelected(c.matched_partner_id || c.id) ? "opacity-50 bg-muted/20" : "hover:bg-muted/40"
                )}
              >
                <span className="flex-1 text-left truncate font-medium">{c.contact_name || c.company_name}</span>
                {c.company_name && c.contact_name && <span className="text-muted-foreground text-[10px] truncate max-w-[100px]">{c.company_name}</span>}
                {c.email && <Mail className="w-3 h-3 text-primary/60" />}
                {isSelected(c.matched_partner_id || c.id) ? <span className="text-primary text-[9px]">✓</span> : <span className="text-primary text-[9px]">+</span>}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
