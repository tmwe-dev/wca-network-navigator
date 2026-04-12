import { useEffect, useState } from "react";
import {
  Mail, Phone, Smartphone, MapPin, Globe, Star, Building2, Users,
  Warehouse, Calendar, Ship, Plane, Truck, TrainFront, Package, Linkedin,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCountryFlag, resolveCountryCode } from "@/lib/countries";

// Network logo mapping
const NETWORK_LOGOS: Record<string, string> = {
  "wca inter global": "/logos/wca-inter-global.png",
  "wca china global": "/logos/wca-china-global.png",
  "wca first": "/logos/wca-first.png",
  "wca advanced professionals": "/logos/wca-advanced-professionals.png",
  "wca projects": "/logos/wca-projects.png",
  "wca dangerous goods": "/logos/wca-dangerous-goods.png",
  "wca perishables": "/logos/wca-perishables.png",
  "wca time critical": "/logos/wca-time-critical.png",
  "wca pharma": "/logos/wca-pharma.png",
  "wca ecommerce": "/logos/wca-ecommerce.png",
  "wca relocations": "/logos/wca-relocations.png",
  "wca expo": "/logos/wca-expo.png",
  "elite global logistics": "/logos/elite-global-logistics.png",
  "ifc (infinite connections)": "/logos/ifc-infinite-connection.png",
  "lognet global": "/logos/lognet-global.png",
  "gaa (global affinity alliance)": "/logos/gaa-global-affinity.png",
};

function getNetworkLogo(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (NETWORK_LOGOS[key]) return NETWORK_LOGOS[key];
  for (const [k, v] of Object.entries(NETWORK_LOGOS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

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

const SERVICE_ICONS: Record<string, any> = {
  air_freight: Plane,
  ocean_fcl: Ship,
  ocean_lcl: Ship,
  road_freight: Truck,
  rail_freight: TrainFront,
  project_cargo: Package,
};

function isContactComplete(c: CanvasContact): "green" | "orange" | "red" {
  const hasEmail = !!c.email?.trim();
  const hasPhone = !!(c.direct_phone?.trim() || c.mobile?.trim());
  if (hasEmail && hasPhone) return "green";
  if (hasEmail || hasPhone) return "orange";
  return "red";
}

const QUALITY_COLORS = {
  green: "bg-emerald-500",
  orange: "bg-primary",
  red: "bg-destructive",
};

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
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              i < currentIdx
                ? "bg-emerald-500"
                : i === currentIdx
                  ? "bg-primary animate-pulse"
                  : "bg-muted-foreground/20"
            )}
          />
          <span
            className={cn(
              "hidden sm:inline",
              i === currentIdx ? "text-foreground font-medium" : "text-muted-foreground"
            )}
          >
            {p.label}
          </span>
          {i < phases.length - 1 && <span className="text-muted-foreground/30 mx-0.5">→</span>}
        </div>
      ))}
    </div>
  );
}

export function PartnerCanvas({ data, phase, isAnimatingOut }: PartnerCanvasProps) {
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVisibleSections(new Set());
    if (!data) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const sections = ["header", "contacts", "services", "markets", "corporate", "networks", "linkedin"];
    sections.forEach((section, i) => {
      timers.push(setTimeout(() => {
        setVisibleSections((prev) => new Set(prev).add(section));
      }, 200 + i * 300));
    });

    return () => timers.forEach(clearTimeout);
  }, [data?.company_name]);

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

  const show = (s: string) => visibleSections.has(s);

  return (
    <div
      className={cn(
        "flex-1 p-4 overflow-auto transition-all duration-500",
        isAnimatingOut && "scale-90 opacity-0"
      )}
    >
      <div
        className={cn(
          "rounded-2xl border p-5 space-y-4 transition-all duration-500",
          phase === "complete"
            ? "border-emerald-500/30 bg-emerald-500/[0.06] shadow-lg shadow-emerald-500/[0.08]"
            : phase === "extracting"
              ? "border-primary/40 bg-primary/[0.04] shadow-lg shadow-primary/[0.08]"
              : phase !== "idle"
                ? "border-primary/40 bg-primary/[0.04] shadow-lg shadow-primary/[0.08]"
                : "border-border bg-card/40"
        )}
      >
        {/* Phase indicator */}
        <div className="flex items-center justify-between">
          <PhaseIndicator phase={phase} />
          {phase !== "idle" && phase !== "complete" && (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          )}
        </div>

        {/* HEADER */}
        <div
          className={cn(
            "transition-all duration-500",
            show("header") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <div className="grid grid-cols-[minmax(80px,1fr)_2fr] gap-4">
            <div className="flex items-center justify-center min-h-[64px]">
              {data.logo_url ? (
                <img src={data.logo_url} alt="" className="max-h-16 max-w-full object-contain" />
              ) : (
                <Building2 className="w-10 h-10 text-muted-foreground/30" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">{data.company_name}</h2>
                {data.rating != null && data.rating > 0 && (
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                    <Star className="w-4 h-4 text-primary fill-primary" />
                    <span className="text-sm font-bold text-primary">
                      {data.rating.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span className="text-xl">{getCountryFlag(data.country_code)}</span>
                <MapPin className="w-3.5 h-3.5" />
                <span className="font-medium">{data.city}</span>
                <span>• {data.country_name}</span>
              </div>
              {data.website && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-primary">
                  <Globe className="w-3 h-3" />
                  <span className="truncate">{data.website}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CONTACTS */}
        {data.contacts.length === 0 && show("contacts") && (
          phase === "extracting" || phase === "downloading" ? (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary font-semibold flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Estrazione contatti in corso...
            </div>
          ) : phase === "complete" ? (
            <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-xs text-destructive font-semibold">
              ⚠️ Nessun contatto trovato — dati incompleti
            </div>
          ) : null
        )}
        {data.contacts.length > 0 && (
          <div
            className={cn(
              "transition-all duration-500",
              show("contacts") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            {(() => {
              const completeCount = data.contacts.filter((c) => isContactComplete(c) === "green").length;
              const total = data.contacts.length;
              const allComplete = completeCount === total;
              return (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Contatti
                    </h3>
                    {data.contactSource && data.contactSource !== "none" && (
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        data.contactSource === "extension"
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "bg-muted text-muted-foreground border border-border"
                      )}>
                        {data.contactSource === "extension" ? "🔌 Extension" : "☁️ Server"}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-[11px] font-bold px-2.5 py-1 rounded-full",
                    allComplete
                      ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
                      : completeCount === 0
                        ? "bg-destructive/20 text-destructive border border-destructive/30"
                        : "bg-primary/20 text-primary border border-primary/30"
                  )}>
                    {completeCount}/{total} completi
                  </span>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.contacts.slice(0, 6).map((c, i) => {
                const quality = isContactComplete(c);
                return (
                <div
                  key={i}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg text-xs border",
                    quality === "green"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : quality === "orange"
                        ? "bg-primary/10 border-primary/30"
                        : "bg-destructive/15 border-destructive/30"
                  )}
                >
                  <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", QUALITY_COLORS[quality])} title={quality === "green" ? "Completo" : quality === "orange" ? "Parziale" : "Mancante"} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.title && (
                      <div className="text-muted-foreground truncate">{c.title}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                      {c.email && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      )}
                      {c.direct_phone && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="w-3 h-3" /> {c.direct_phone}
                        </span>
                      )}
                      {c.mobile && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Smartphone className="w-3 h-3" /> {c.mobile}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SERVICES */}
        {data.services.length > 0 && (
          <div
            className={cn(
              "transition-all duration-500",
              show("services") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Servizi
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {data.services.map((s) => {
                const Icon = SERVICE_ICONS[s] || Package;
                return (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border text-muted-foreground bg-muted border-border"
                  >
                    <Icon className="w-3 h-3" />
                    {s.replace(/_/g, " ")}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* MARKETS & ROUTING */}
        {(data.key_markets.length > 0 || data.key_routes.length > 0) && (
          <div
            className={cn(
              "transition-all duration-500",
              show("markets") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            {data.key_markets.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Mercati Principali
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.key_markets.map((m, i) => {
                    const code = resolveCountryCode(m);
                    return (
                      <span key={i} className="text-lg" title={m}>
                        {code ? getCountryFlag(code) : "🌍"}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
            {data.key_routes.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Routing
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.key_routes.map((r, i) => {
                    const fromCode = resolveCountryCode(r.from);
                    const toCode = resolveCountryCode(r.to);
                    return (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs"
                      >
                        {fromCode ? getCountryFlag(fromCode) : r.from}
                        <span className="text-muted-foreground">➔</span>
                        {toCode ? getCountryFlag(toCode) : r.to}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* CORPORATE DATA */}
        {(data.warehouse_sqm || data.employees || data.founded || data.fleet) && (
          <div
            className={cn(
              "transition-all duration-500",
              show("corporate") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Dati Aziendali
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {data.warehouse_sqm && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                  <Warehouse className="w-4 h-4 text-primary" />
                  <div>
                    <div className="font-bold">{data.warehouse_sqm.toLocaleString()} mq</div>
                    <div className="text-muted-foreground">Magazzini</div>
                  </div>
                </div>
              )}
              {data.employees && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                  <Users className="w-4 h-4 text-primary" />
                  <div>
                    <div className="font-bold">{data.employees.toLocaleString()}</div>
                    <div className="text-muted-foreground">Dipendenti</div>
                  </div>
                </div>
              )}
              {data.founded && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                  <Calendar className="w-4 h-4 text-primary" />
                  <div>
                    <div className="font-bold">{data.founded}</div>
                    <div className="text-muted-foreground">Fondazione</div>
                  </div>
                </div>
              )}
              {data.fleet && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs">
                  <Truck className="w-4 h-4 text-primary" />
                  <div>
                    <div className="font-bold">{data.fleet}</div>
                    <div className="text-muted-foreground">Flotta</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* NETWORKS */}
        {data.networks.length > 0 && (
          <div
            className={cn(
              "transition-all duration-500",
              show("networks") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Network WCA
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.networks.map((net) => {
                const logo = getNetworkLogo(net);
                return (
                  <div key={net} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border text-xs">
                    {logo && <img src={logo} alt="" className="w-5 h-5 object-contain" />}
                    <span className="text-muted-foreground">{net}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LINKEDIN */}
        {data.linkedin_links.length > 0 && (
          <div
            className={cn(
              "transition-all duration-500",
              show("linkedin") ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              LinkedIn
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.linkedin_links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                  <Linkedin className="w-3 h-3" />
                  {l.name}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
