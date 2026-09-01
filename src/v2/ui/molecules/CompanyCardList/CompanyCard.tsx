/**
 * CompanyCard — card partner secondo la geometria approvata (template
 * `public/design/esplora.html`):
 *
 *   [ identità ]  nome azienda                       ◆score  ⋮
 *   [ logo 48 ]   referente · ruolo
 *   [ bandiera ]  ultimo contatto        stati piatti
 *                 Paese · Città
 *
 * Angolo alto-sinistra = identità, alto-destra = valore + menu,
 * basso = contesto geografico. Nessun grassetto: la gerarchia si fa
 * solo con dimensione e colore. Logic-less, alimentato da `CompanyEntity`.
 */
import * as React from "react";
import {
  Plane,
  MoreVertical,
  Star,
  Mail,
  MessageCircle,
  Phone,
  ExternalLink,
  Search,
  ScanSearch,
  Telescope,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ChannelIcons } from "@/v2/ui/atoms/ChannelIcons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useDirectContactActions } from "@/hooks/useDirectContactActions";
import { toast } from "sonner";
import type { CompanyEntity, CompanyCardListCallbacks } from "./types";
import { useBlacklistedPartnerIds, useBlacklistedCompanyNames } from "@/hooks/useBlacklist";
import { computeRecency, computeEnrichedLabel } from "./CompanyCard.helpers";

export interface CompanyCardProps extends CompanyCardListCallbacks {
  company: CompanyEntity;
  /** True quando l'azienda è multi-selezionata. */
  selected?: boolean;
  /** True quando questa è la card aperta nel pannello dettaglio (single-select). */
  opened?: boolean;
  /** Toggle selezione (checkbox). */
  onToggleSelect?: (id: string) => void;
  /** Layout compatto (pannello stretto). */
  compact?: boolean;
  /** Massimo livello Sherlock completato (1 Scout · 2 Detective · 3 Sherlock). */
  sherlockLevel?: 1 | 2 | 3 | null;
  /** ISO date dell'ultima indagine completata. */
  sherlockCompletedAt?: string | null;
  /** Click sulla bandiera (paese). */
  onCountryClick?: (code: string) => void;
  /** Click sulla città. */
  onCityClick?: (city: string) => void;
}

const SHERLOCK_LABEL: Record<1 | 2 | 3, string> = { 1: "Scout", 2: "Detective", 3: "Sherlock" };

let displayNames: Intl.DisplayNames | null = null;
function nomePaese(code?: string | null): string | null {
  const c = (code || "").trim().toUpperCase();
  if (c.length !== 2) return c || null;
  try {
    displayNames ??= new Intl.DisplayNames(["it"], { type: "region" });
    return displayNames.of(c) ?? c;
  } catch {
    return c;
  }
}

const DOMINI_GENERICI = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "libero.it",
  "icloud.com",
  "qq.com",
  "163.com",
  "naver.com",
]);

function dominioDaEmail(email?: string | null): string | null {
  const d = email?.split("@")[1]?.trim().toLowerCase();
  if (!d || DOMINI_GENERICI.has(d)) return null;
  return d;
}

/** Badge "piatto": testo con pallino colore, nessun riquadro. */
function Flat({
  children,
  tone = "info",
  title,
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "ok" | "danger";
  title?: string;
}): React.ReactElement {
  const dot =
    tone === "warn"
      ? "bg-warning"
      : tone === "ok"
        ? "bg-success"
        : tone === "danger"
          ? "bg-destructive"
          : "bg-primary";
  const text =
    tone === "warn"
      ? "text-warning"
      : tone === "ok"
        ? "text-success"
        : tone === "danger"
          ? "text-destructive"
          : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10.5px] leading-none", text)} title={title}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      {children}
    </span>
  );
}

export function CompanyCard({
  company,
  onOpenCompany,
  selected,
  opened,
  onToggleSelect,
  compact = false,
  sherlockLevel = null,
  sherlockCompletedAt = null,
  onCountryClick,
  onCityClick,
}: CompanyCardProps): React.ReactElement {
  const {
    name,
    city,
    countryCode,
    badge,
    contactsCount,
    meta,
    score,
    primaryContact,
    channels,
    hasBca,
    leadStatus,
    isFavorite,
    lastInteractionAt,
    bcaCount,
    origin,
    enrichedAt,
    logoUrl,
    primaryEmail,
    primaryPhone,
  } = company;
  const { handleSendEmail, handleSendWhatsApp } = useDirectContactActions();

  // Blacklist (set globali in cache, no N+1).
  const { data: blacklistIds } = useBlacklistedPartnerIds();
  const { data: blacklistNames } = useBlacklistedCompanyNames();
  const isBlacklisted =
    (!!blacklistIds && blacklistIds.has(String(company.id))) ||
    (!!blacklistNames && !!name && blacklistNames.has(name.toLowerCase().trim()));

  const primaryContactFull = company.contacts?.[0];
  const firstEmail = primaryContactFull?.email || primaryEmail || null;
  const firstPhone = primaryContactFull?.phone || primaryPhone || null;

  const [logoFailed, setLogoFailed] = React.useState(false);
  const [flagFailed, setFlagFailed] = React.useState(false);
  // Solo loghi certi: nessuna favicon indovinata dal dominio.
  const logoSrc = meta?.logoUrl ?? logoUrl ?? null;


  const iso = (countryCode || "").trim().toLowerCase();
  const paese = nomePaese(countryCode);
  const isCustomer = leadStatus === "converted";
  const enrichedLabel = React.useMemo(() => computeEnrichedLabel(enrichedAt), [enrichedAt]);
  const recency = React.useMemo(() => computeRecency(lastInteractionAt), [lastInteractionAt]);

  const onMenuEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstEmail) {
      toast.error("Nessuna email disponibile per il contatto principale");
      return;
    }
    handleSendEmail({
      email: firstEmail,
      name: primaryContactFull?.name,
      company: company.name,
      partnerId: company.id,
      contactId: primaryContactFull?.id,
    });
  };

  const onMenuWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstPhone) {
      toast.error("Nessun numero disponibile per il contatto principale");
      return;
    }
    handleSendWhatsApp({
      phone: firstPhone,
      contactName: primaryContactFull?.name,
      companyName: company.name,
      contactId: primaryContactFull?.id,
      partnerId: company.id,
      sourceType: "partner",
    });
  };

  const onMenuCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!firstPhone) {
      toast.error("Nessun numero disponibile");
      return;
    }
    window.open(`tel:${firstPhone.replace(/[^0-9+]/g, "")}`, "_blank");
  };

  const onMenuOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCompany?.(company);
  };

  const leadLabel = (() => {
    const map: Record<string, string> = {
      contacted: "Contattato",
      qualified: "Qualificato",
      holding: "In attesa",
      archived: "Archiviato",
      blacklisted: "Blacklist",
    };
    return leadStatus ? (map[leadStatus] ?? null) : null;
  })();

  /** Stati piatti: max 3 visibili, il resto in «+N» (tutti quando la card è aperta). */
  const statiTutti: Array<{ key: string; node: React.ReactNode; title: string }> = [
    badge ? { key: "src", node: <Flat key="src">{badge.label}</Flat>, title: badge.label } : null,
    isBlacklisted
      ? {
          key: "bl",
          node: (
            <Flat key="bl" tone="danger" title="Azienda presente nella blacklist WCA World">
              Blacklist
            </Flat>
          ),
          title: "Blacklist",
        }
      : null,
    isCustomer ? { key: "cli", node: <Flat key="cli" tone="ok">Cliente</Flat>, title: "Cliente" } : null,
    leadLabel
      ? {
          key: "lead",
          node: (
            <Flat key="lead" tone={leadStatus === "holding" ? "warn" : "info"}>
              {leadLabel}
            </Flat>
          ),
          title: leadLabel,
        }
      : null,
    meta?.wcaYears != null
      ? {
          key: "years",
          node: (
            <Flat key="years" title={`${meta.wcaYears} anni di membership WCA`}>
              {meta.wcaYears} anni
            </Flat>
          ),
          title: `${meta.wcaYears} anni WCA`,
        }
      : null,
    hasBca
      ? {
          key: "bca",
          node: (
            <Flat key="bca" title="Biglietti da visita collegati">
              BCA{bcaCount && bcaCount > 1 ? ` ${bcaCount}` : ""}
            </Flat>
          ),
          title: "BCA",
        }
      : null,
    sherlockLevel
      ? {
          key: "sherlock",
          node: (
            <Flat
              key="sherlock"
              title={sherlockCompletedAt ? `Deep Search: ${new Date(sherlockCompletedAt).toLocaleString()}` : undefined}
            >
              {SHERLOCK_LABEL[sherlockLevel]}
            </Flat>
          ),
          title: SHERLOCK_LABEL[sherlockLevel],
        }
      : null,
    opened && enrichedLabel ? { key: "ds", node: <Flat key="ds" tone="ok">{enrichedLabel}</Flat>, title: enrichedLabel } : null,
    opened && origin ? { key: "org", node: <Flat key="org">{origin}</Flat>, title: origin } : null,
  ].filter(Boolean) as Array<{ key: string; node: React.ReactNode; title: string }>;

  const maxStati = opened ? statiTutti.length : compact ? 2 : 3;
  const statiVisibili = statiTutti.slice(0, maxStati);
  const statiNascosti = statiTutti.slice(maxStati);

  return (
    <article
      onClick={() => onOpenCompany?.(company)}
      className={cn(
        "group relative flex cursor-pointer gap-3.5 rounded-2xl border border-border/60 bg-card/70 transition-all",
        compact ? "p-3" : "p-3.5",
        "hover:border-primary/50 hover:shadow-[0_0_40px_-14px_hsl(var(--primary)/0.35)]",
        selected && "border-primary/70 bg-primary/[0.06]",
        opened && "border-primary bg-primary/[0.08]",
      )}
    >
      {/* Colonna identità: larghezza = logo, bandiera centrata sotto. */}
      <div className={cn("flex shrink-0 flex-col items-center gap-2", compact ? "w-9" : "w-12")}>
        {onToggleSelect && (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect(company.id)}
              aria-label={`Seleziona ${company.name}`}
              className="h-4 w-4"
            />
          </div>
        )}
        {logoSrc && !logoFailed && (
          <span
            className={cn(
              "flex items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-background",
              compact ? "h-9 w-9" : "h-12 w-12",
            )}
            aria-hidden="true"
          >
            <img
              src={logoSrc}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain p-1.5"
              onError={() => setLogoFailed(true)}
            />
          </span>
        )}

        {iso && !flagFailed ? (
          onCountryClick ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCountryClick(countryCode!);
              }}
              title={`Filtra per paese ${paese ?? ""}`}
              aria-label={`Filtra per paese ${paese ?? ""}`}
              className="rounded-[3px] transition-all hover:ring-1 hover:ring-primary/50"
            >
              <img
                src={`https://flagcdn.com/60x45/${iso}.png`}
                alt=""
                loading="lazy"
                onError={() => setFlagFailed(true)}
                className="h-[22px] w-[30px] rounded-[3px] border border-border/70 object-cover"
              />
            </button>
          ) : (
            <img
              src={`https://flagcdn.com/60x45/${iso}.png`}
              alt=""
              loading="lazy"
              onError={() => setFlagFailed(true)}
              className="h-[22px] w-[30px] rounded-[3px] border border-border/70 object-cover"
            />
          )
        ) : null}
      </div>

      {/* Angolo alto-destra: score + menu. */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        {score != null && !Number.isNaN(score) && (
          <span
            className="inline-flex h-[22px] items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-2 text-[12px] leading-none text-primary"
            title={`Score ${Math.round(score)}/100`}
          >
            <span className="text-[9px] opacity-80">◆</span>
            {Math.round(score)}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
              aria-label="Azioni rapide"
              title="Azioni rapide"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-[10px] font-normal uppercase text-muted-foreground">
              {primaryContactFull?.name || company.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMenuEmail} disabled={!firstEmail}>
              <Mail className="mr-2 h-3.5 w-3.5 text-primary" /> Invia email
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMenuWhatsApp} disabled={!firstPhone}>
              <MessageCircle className="mr-2 h-3.5 w-3.5 text-success" /> WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMenuCall} disabled={!firstPhone}>
              <Phone className="mr-2 h-3.5 w-3.5 text-chart-3" /> Chiama
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onMenuOpen}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Apri dettaglio
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-normal uppercase text-muted-foreground">
              Deep Search
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("sherlock-launch", { detail: { partnerId: company.id, level: 1 } }));
              }}
            >
              <Search className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Scout
              <span className="ml-auto text-[10px] text-muted-foreground">~30s</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("sherlock-launch", { detail: { partnerId: company.id, level: 2 } }));
              }}
            >
              <ScanSearch className="mr-2 h-3.5 w-3.5 text-primary" /> Detective
              <span className="ml-auto text-[10px] text-muted-foreground">~2min</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("sherlock-launch", { detail: { partnerId: company.id, level: 3 } }));
              }}
            >
              <Telescope className="mr-2 h-3.5 w-3.5 text-warning" /> Sherlock
              <span className="ml-auto text-[10px] text-muted-foreground">~5min</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Corpo dati: una sola colonna allineata a sinistra. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2 pr-[86px]">
          <h3 className="min-w-0 flex-1 truncate text-[13.5px] font-normal leading-tight text-foreground">
            {name || "—"}
          </h3>
          {isFavorite && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}
          {meta?.holding && (
            <span title="In circuito di attesa">
              <Plane className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </span>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className="min-w-0 truncate">
            {primaryContact
              ? `${primaryContact.name}${primaryContact.role ? ` · ${primaryContact.role}` : ""}`
              : contactsCount === 0
                ? "Nessun referente"
                : `${contactsCount} contatt${contactsCount === 1 ? "o" : "i"}`}
          </span>
          {primaryContact && contactsCount > 1 && (
            <span className="shrink-0 text-[10.5px] text-muted-foreground">+{contactsCount - 1}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 pt-0.5">
          <span
            className={cn(
              "inline-flex h-[21px] items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 text-[10.5px] leading-none",
              recency.tone === "ok" && "text-success",
              recency.tone === "warn" && "text-warning",
              recency.tone === "alert" && "text-destructive",
              recency.tone === "muted" && "text-muted-foreground",
            )}
            title={
              lastInteractionAt ? `Ultimo contatto: ${new Date(lastInteractionAt).toLocaleString()}` : "Mai contattato"
            }
          >
            {channels && <ChannelIcons {...channels} size="sm" className="gap-1" />}
            ultimo contatto {recency.label}
          </span>
          <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
            {statiVisibili.map((s) => s.node)}
            {statiNascosti.length > 0 && (
              <span className="text-[10.5px] text-muted-foreground" title={statiNascosti.map((s) => s.title).join(" · ")}>
                +{statiNascosti.length}
              </span>
            )}
          </span>
        </div>

        <div className="mt-auto flex items-baseline gap-2 pt-1.5 text-[11px] text-foreground">
          <span className="truncate">{paese ?? "—"}</span>
          {city &&
            (onCityClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCityClick(city);
                }}
                className="truncate text-muted-foreground transition-colors hover:text-primary"
                title={`Filtra per città ${city}`}
              >
                {city}
              </button>
            ) : (
              <span className="truncate text-muted-foreground">{city}</span>
            ))}
        </div>
      </div>
    </article>
  );
}

export default CompanyCard;
