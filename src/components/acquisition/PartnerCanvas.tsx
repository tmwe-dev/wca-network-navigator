import { MapPin, Globe, Star, Building2, Warehouse, Calendar, Users, Truck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCountryFlag, resolveCountryCode } from "@/lib/countries";
import { usePartnerCanvas } from "./partner-canvas/usePartnerCanvas";
import { CanvasContactList } from "./partner-canvas/CanvasContactList";
import { CanvasServiceGrid } from "./partner-canvas/CanvasServiceGrid";
import { CanvasNetworkBadges } from "./partner-canvas/CanvasNetworkBadges";

export interface CanvasContact {
  name: string;
  title?: string;
  email?: string;
  direct_phone?: string;
  mobile?: string;
}

export type ContactSource = "server" | "extension" | "none";

export interface CanvasData {
  company_name: string;
  city: string;
  country_code: string;
  country_name: string;
  logo_url?: string;
  contacts: CanvasContact[];
  services: string[];
  key_markets: string[];
  key_routes: Array<{ from: string; to: string }>;
  networks: string[];
  rating?: number;
  warehouse_sqm?: number;
  employees?: number;
  founded?: string;
  fleet?: string;
  linkedin_links: Array<{ name: string; url: string }>;
  website?: string;
  profile_description?: string;
  contactSource?: ContactSource;
}

export type CanvasPhase = "idle" | "downloading" | "extracting" | "enriching" | "deep_search" | "complete";

interface PartnerCanvasProps {
  data: CanvasData | null;
  phase: CanvasPhase;
  isAnimatingOut: boolean;
}

function PhaseIndicator({ phase }: { phase: CanvasPhase }) {
  const phases = [
    { key: "downloading", label: "Download" },
    { key: "extracting", label: "Contatti Privati" },
    { key: "enriching", label: "Arricchimento" },
    { key: "deep_search", label: "Deep Search" },
    { key: "complete", label: "Completato" },
  ];
  const currentIdx = phases.findIndex((p) => p.key === phase);
  return (
    <div className="flex items-center gap-1 text-[10px]">
      {phases.map((p, i) => (
        <div key={p.key} className="flex items-center gap-1">
          <div className={cn("w-2 h-2 rounded-full transition-colors", i < currentIdx ? "bg-emerald-500" : i === currentIdx ? "bg-primary animate-pulse" : "bg-muted-foreground/20")} />
          <span className={cn("hidden sm:inline", i === currentIdx ? "text-foreground font-medium" : "text-muted-foreground")}>{p.label}</span>
          {i < phases.length - 1 && <span className="text-muted-foreground/30 mx-0.5">→</span>}
        </div>
      ))}
    </div>
  );
}

export function PartnerCanvas({ data, phase, isAnimatingOut }: PartnerCanvasProps) {
  const { show } = usePartnerCanvas(data);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground/50">
        <div className="text-center space-y-3">
          <div className="text-4xl">📋</div>
          <p className="text-sm">Seleziona paesi e avvia l'acquisizione</p>
          <p className="text-xs text-muted-foreground/40">Il documento si costruirà qui</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 p-4 overflow-auto transition-all duration-500", isAnimatingOut && "scale-90 opacity-0")}>
      <div className={cn(
        "rounded-2xl border p-5 space-y-4 transition-all duration-500",
        phase === "complete" ? "border-emerald-500/30 bg-emerald-500/[0.06] shadow-lg shadow-emerald-500/[0.08]"
          : phase !== "idle" ? "border-primary/40 bg-primary/[0.04] shadow-lg shadow-primary/[0.08]"
          : "border-border bg-card/40"
      )}>
        <div className="flex items-center justify-between">
          <PhaseIndicator phase={phase} />
          {phase !== "idle" && phase !== "complete" && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
        </div>

        {/* Header */}
        <div className={cn("transition-all duration-500", show("header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
          <div className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-4">
            <div className="flex items-center justify-center min-h-[64px]">
              {data.logo_url ? <img src={data.logo_url} alt="" className="max-h-16 max-w-full object-contain" /> : <Building2 className="w-10 h-10 text-muted-foreground/30" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{data.company_name}</h2>
                {data.rating != null && data.rating > 0 && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <span className="text-sm font-bold text-primary">{data.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className="text-xl">{getCountryFlag(data.country_code)}</span>
                <MapPin className="w-3.5 h-3.5" /><span className="font-medium">{data.city}</span><span>• {data.country_name}</span>
              </div>
              {data.website && <div className="flex items-center gap-1.5 mt-1 text-xs text-primary"><Globe className="w-3 h-3" /><span className="truncate">{data.website}</span></div>}
            </div>
          </div>
        </div>

        <CanvasContactList contacts={data.contacts} phase={phase} contactSource={data.contactSource} visible={show("contacts")} />
        <CanvasServiceGrid services={data.services} visible={show("services")} />

        {/* Markets & Routes */}
        {(data.key_markets.length > 0 || data.key_routes.length > 0) && (
          <div className={cn("transition-all duration-500", show("markets") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
            {data.key_markets.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Mercati Principali</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.key_markets.map((m, i) => { const code = resolveCountryCode(m); return <span key={i} className="text-lg" title={m}>{code ? getCountryFlag(code) : "🌍"}</span>; })}
                </div>
              </>
            )}
            {data.key_routes.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Routing</h3>
                <div className="flex flex-wrap gap-2">
                  {data.key_routes.map((r, i) => { const fromCode = resolveCountryCode(r.from); const toCode = resolveCountryCode(r.to); return <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs">{fromCode ? getCountryFlag(fromCode) : r.from}<span className="text-muted-foreground">➔</span>{toCode ? getCountryFlag(toCode) : r.to}</span>; })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Corporate */}
        {(data.warehouse_sqm || data.employees || data.founded || data.fleet) && (
          <div className={cn("transition-all duration-500", show("corporate") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dati Aziendali</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.warehouse_sqm && <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs"><Warehouse className="w-4 h-4 text-primary" /><div><div className="font-bold">{data.warehouse_sqm.toLocaleString()} mq</div><div className="text-muted-foreground">Magazzini</div></div></div>}
              {data.employees && <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs"><Users className="w-4 h-4 text-primary" /><div><div className="font-bold">{data.employees.toLocaleString()}</div><div className="text-muted-foreground">Dipendenti</div></div></div>}
              {data.founded && <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs"><Calendar className="w-4 h-4 text-primary" /><div><div className="font-bold">{data.founded}</div><div className="text-muted-foreground">Fondazione</div></div></div>}
              {data.fleet && <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs"><Truck className="w-4 h-4 text-primary" /><div><div className="font-bold">{data.fleet}</div><div className="text-muted-foreground">Flotta</div></div></div>}
            </div>
          </div>
        )}

        <CanvasNetworkBadges networks={data.networks} linkedinLinks={data.linkedin_links} showNetworks={show("networks")} showLinkedin={show("linkedin")} />
      </div>
    </div>
  );
}
