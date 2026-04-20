/**
 * ForgeRecipientPicker — slim picker for the Email Forge lab.
 * 3 tabs (Partner WCA / Contatto importato / BCA) + ricerca + country filter.
 * Single-selection callback.
 *
 * Build with direct queries (NOT EmailComposerContactPicker) per evitare
 * di trascinare MissionContext/composer side-effects nel Lab.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, Globe, Users, CreditCard, X, Loader2 } from "lucide-react";
import { WCA_COUNTRIES_MAP } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";

export type ForgeRecipientSource = "partner" | "contact" | "bca" | "manual";

export interface ForgeRecipient {
  source: ForgeRecipientSource;
  /** ID of the source row (partner.id / imported_contacts.id / business_cards.id). */
  recordId: string;
  /** partner_id usable to wire generate-email (matched_partner_id for BCA, partner.id for partner, null for contact). */
  partnerId: string | null;
  /** contact_id (imported_contacts.id) when applicable. */
  contactId: string | null;
  companyName: string;
  contactName: string | null;
  email: string | null;
  countryCode: string | null;
  countryName: string | null;
}

interface Props {
  value: ForgeRecipient | null;
  onChange: (r: ForgeRecipient | null) => void;
}

export function ForgeRecipientPicker({ value, onChange }: Props) {
  const [tab, setTab] = React.useState<"partner" | "contact" | "bca">("partner");
  const [search, setSearch] = React.useState("");
  const [country, setCountry] = React.useState<string | null>(null);

  const debounced = useDebounced(search, 250);

  // Limite dinamico: con filtro paese o ricerca → 1000 (rispetta cap Supabase di default)
  // Senza filtri → 100 (lista iniziale leggera)
  const partnerLimit = country || debounced.length >= 2 ? 1000 : 100;
  const contactLimit = country || debounced.length >= 2 ? 1000 : 100;
  const bcaLimit = debounced.length >= 2 ? 1000 : 100;

  const partnersQuery = useQuery({
    queryKey: ["forge-picker", "partners", debounced, country, partnerLimit],
    enabled: tab === "partner",
    queryFn: async () => {
      let q = supabase
        .from("partners")
        .select("id, company_name, country_code, city, email", { count: "exact" })
        .eq("is_active", true)
        .order("company_name", { ascending: true })
        .limit(partnerLimit);
      if (debounced.length >= 2) q = q.ilike("company_name", `%${debounced}%`);
      if (country) q = q.eq("country_code", country);
      const { data, count } = await q;
      return { rows: data ?? [], total: count ?? (data?.length ?? 0) };
    },
  });

  const contactsQuery = useQuery({
    queryKey: ["forge-picker", "contacts", debounced, country, contactLimit],
    enabled: tab === "contact",
    queryFn: async () => {
      let q = supabase
        .from("imported_contacts")
        .select("id, name, company_name, email, country, position", { count: "exact" })
        .order("name", { ascending: true })
        .limit(contactLimit);
      if (debounced.length >= 2) {
        q = q.or(`name.ilike.%${debounced}%,company_name.ilike.%${debounced}%,email.ilike.%${debounced}%`);
      }
      if (country) {
        const cn = WCA_COUNTRIES_MAP[country]?.name;
        if (cn) q = q.ilike("country", `%${cn}%`);
      }
      const { data, count } = await q;
      return { rows: data ?? [], total: count ?? (data?.length ?? 0) };
    },
  });

  const bcaQuery = useQuery({
    queryKey: ["forge-picker", "bca", debounced, country, bcaLimit],
    enabled: tab === "bca",
    queryFn: async () => {
      let q = supabase
        .from("business_cards")
        .select("id, contact_name, company_name, email, location, matched_partner_id", { count: "exact" })
        .order("company_name", { ascending: true })
        .limit(bcaLimit);
      if (debounced.length >= 2) {
        q = q.or(`contact_name.ilike.%${debounced}%,company_name.ilike.%${debounced}%,email.ilike.%${debounced}%`);
      }
      const { data, count } = await q;
      return { rows: data ?? [], total: count ?? (data?.length ?? 0) };
    },
  });

  const handleClear = () => onChange(null);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-2 text-xs space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{value.companyName || "(senza azienda)"}</div>
              {value.contactName && (
                <div className="text-muted-foreground truncate">{value.contactName}</div>
              )}
              {value.email && (
                <div className="text-muted-foreground truncate text-[10px]">{value.email}</div>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                <SourceBadge source={value.source} />
                {value.countryCode && (
                  <span>{getCountryFlag(value.countryCode)} {value.countryCode}</span>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={handleClear} title="Cambia">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground">
          Nessun destinatario selezionato — l'email userà solo i campi manuali sotto.
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-7 w-full grid grid-cols-3">
          <TabsTrigger value="partner" className="text-[10px] h-6"><Globe className="w-3 h-3 mr-1" />Partner</TabsTrigger>
          <TabsTrigger value="contact" className="text-[10px] h-6"><Users className="w-3 h-3 mr-1" />Contatti</TabsTrigger>
          <TabsTrigger value="bca" className="text-[10px] h-6"><CreditCard className="w-3 h-3 mr-1" />BCA</TabsTrigger>
        </TabsList>

        <div className="relative mt-2">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca (≥2 caratteri)…"
            className="h-7 text-xs pl-7"
          />
        </div>

        {tab === "partner" && (
          <CountryFilter selected={country} onChange={setCountry} />
        )}

        <TabsContent value="partner" className="mt-2 max-h-[260px] overflow-auto space-y-1">
          {partnersQuery.isLoading && <LoadingRow />}
          {partnersQuery.data?.length === 0 && <EmptyRow />}
          {partnersQuery.data?.map((p) => (
            <ResultRow
              key={p.id}
              title={p.company_name || "(senza nome)"}
              subtitle={[p.city, p.country_code].filter(Boolean).join(" · ")}
              meta={p.email ?? undefined}
              flag={p.country_code ? getCountryFlag(p.country_code) : undefined}
              onClick={() => onChange({
                source: "partner",
                recordId: p.id,
                partnerId: p.id,
                contactId: null,
                companyName: p.company_name || "",
                contactName: null,
                email: p.email,
                countryCode: p.country_code,
                countryName: p.country_code ? WCA_COUNTRIES_MAP[p.country_code]?.name ?? null : null,
              })}
            />
          ))}
        </TabsContent>

        <TabsContent value="contact" className="mt-2 max-h-[260px] overflow-auto space-y-1">
          {contactsQuery.isLoading && <LoadingRow />}
          {contactsQuery.data?.length === 0 && <EmptyRow />}
          {contactsQuery.data?.map((c) => (
            <ResultRow
              key={c.id}
              title={c.name || c.company_name || "(senza nome)"}
              subtitle={[c.company_name, c.position].filter(Boolean).join(" · ")}
              meta={c.email ?? undefined}
              onClick={() => onChange({
                source: "contact",
                recordId: c.id,
                partnerId: null,
                contactId: c.id,
                companyName: c.company_name || "",
                contactName: c.name,
                email: c.email,
                countryCode: null,
                countryName: c.country,
              })}
            />
          ))}
        </TabsContent>

        <TabsContent value="bca" className="mt-2 max-h-[260px] overflow-auto space-y-1">
          {bcaQuery.isLoading && <LoadingRow />}
          {bcaQuery.data?.length === 0 && <EmptyRow />}
          {bcaQuery.data?.map((c) => (
            <ResultRow
              key={c.id}
              title={c.contact_name || c.company_name || "(senza nome)"}
              subtitle={[c.company_name, c.location].filter(Boolean).join(" · ")}
              meta={c.email ?? undefined}
              onClick={() => onChange({
                source: "bca",
                recordId: c.id,
                partnerId: c.matched_partner_id ?? null,
                contactId: null,
                companyName: c.company_name || "",
                contactName: c.contact_name,
                email: c.email,
                countryCode: null,
                countryName: c.location,
              })}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourceBadge({ source }: { source: ForgeRecipientSource }) {
  const map: Record<ForgeRecipientSource, string> = {
    partner: "Partner WCA",
    contact: "Contatto",
    bca: "Biglietto",
    manual: "Manuale",
  };
  return (
    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-medium">
      {map[source]}
    </span>
  );
}

function ResultRow({ title, subtitle, meta, flag, onClick }: { title: string; subtitle?: string; meta?: string; flag?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded border border-border/40 bg-card hover:border-primary/50 hover:bg-primary/5 px-2 py-1.5 transition-colors"
    >
      <div className="flex items-start gap-1.5">
        {flag && <span className="text-sm leading-none mt-0.5">{flag}</span>}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium truncate">{title}</div>
          {subtitle && <div className="text-[10px] text-muted-foreground truncate">{subtitle}</div>}
          {meta && <div className="text-[10px] text-muted-foreground/80 truncate">{meta}</div>}
        </div>
      </div>
    </button>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-4 text-[10px] text-muted-foreground gap-1.5">
      <Loader2 className="w-3 h-3 animate-spin" /> Caricamento…
    </div>
  );
}

function EmptyRow() {
  return (
    <div className="text-center py-4 text-[10px] text-muted-foreground">
      Nessun risultato — affina la ricerca.
    </div>
  );
}

function CountryFilter({ selected, onChange }: { selected: string | null; onChange: (c: string | null) => void }) {
  const codes = ["IT", "FR", "DE", "ES", "GB", "US", "CN", "IN", "BR", "AE"];
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {selected && (
        <button
          onClick={() => onChange(null)}
          className="px-1.5 py-0.5 text-[9px] rounded border border-primary/40 bg-primary/10 text-primary"
        >
          Tutti ✕
        </button>
      )}
      {codes.map((c) => (
        <button
          key={c}
          onClick={() => onChange(selected === c ? null : c)}
          className={`px-1.5 py-0.5 text-[10px] rounded border ${
            selected === c
              ? "border-primary bg-primary/10 text-primary"
              : "border-border/40 hover:border-border bg-card"
          }`}
        >
          {getCountryFlag(c)} {c}
        </button>
      ))}
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
