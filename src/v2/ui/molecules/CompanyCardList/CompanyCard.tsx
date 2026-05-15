/**
 * CompanyCard — card partner ordinata, con dati separati per area visiva.
 * Logic-less, alimentato da `CompanyEntity`.
 */
import * as React from "react";
import {
  Plane,
  Trophy,
  MoreHorizontal,
  Star,
  Clock,
  Mail,
  MessageCircle,
  Phone,
  ExternalLink,
  Search,
  ScanSearch,
  Telescope,
  ShieldAlert,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EntityRowFlag } from "@/v2/ui/atoms/EntityRowFlag";
import { ChannelIcons } from "@/v2/ui/atoms/ChannelIcons";
import { ScorePill } from "@/v2/ui/atoms/ScorePill";
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
import type { CompanyEntity, CompanyCardListCallbacks, CompanySource } from "./types";
import { SherlockLevelBadge } from "@/v2/ui/atoms/SherlockLevelBadge";
import { useBlacklistedPartnerIds, useBlacklistedCompanyNames } from "@/hooks/useBlacklist";

const CARD_BORDER: Record<CompanySource, string> = {
  wca: "border-primary/30 hover:border-primary/55",
  crm: "border-chart-2/30 hover:border-chart-2/55",
  bca: "border-success/30 hover:border-success/55",
};

const CARD_STRIPE: Record<CompanySource, string> = {
  wca: "from-primary/85 to-primary/25",
  crm: "from-chart-2/85 to-chart-2/25",
  bca: "from-success/85 to-success/25",
};

const BADGE_BASE = "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold leading-none";
const CHIP_BASE = "inline-flex h-6 min-w-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium leading-none";

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
    source,
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

  const logoFromMeta = meta?.logoUrl ?? logoUrl ?? null;
  const isCustomer = leadStatus === "converted";
  const enrichedLabel = React.useMemo(() => {
    if (!enrichedAt) return null;
    const t = new Date(enrichedAt).getTime();
    if (Number.isNaN(t)) return null;
    const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
    if (days < 1) return "DS oggi";
    if (days < 30) return `DS ${days}g fa`;
    if (days < 365) return `DS ${Math.floor(days / 30)}mes fa`;
    return `DS ${Math.floor(days / 365)}a fa`;
  }, [enrichedAt]);

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

  const recency = React.useMemo(() => {
    if (!lastInteractionAt) return { label: "mai", tone: "muted" as const };
    const t = new Date(lastInteractionAt).getTime();
    if (Number.isNaN(t)) return { label: "mai", tone: "muted" as const };
    const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
    if (days < 1) return { label: "oggi", tone: "ok" as const };
    if (days < 7) return { label: `${days}g fa`, tone: "ok" as const };
    if (days < 30) return { label: `${days}g fa`, tone: "warn" as const };
    if (days < 90) return { label: `${days}g fa`, tone: "warn" as const };
    return { label: `${days}g fa`, tone: "alert" as const };
  }, [lastInteractionAt]);

  const leadStatusBadge = (() => {
    if (!leadStatus || leadStatus === "new") return null;
    const map: Record<string, { label: string; cls: string }> = {
      contacted: { label: "Contattato", cls: "bg-chart-2/15 text-chart-2 border-chart-2/30" },
      qualified: { label: "Qualificato", cls: "bg-success/15 text-success border-success/30" },
      holding: { label: "In attesa", cls: "bg-primary/15 text-primary border-primary/30" },
      archived: { label: "Archiviato", cls: "bg-muted/40 text-muted-foreground border-border/40" },
      blacklisted: { label: "Blacklist", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    };
    const m = map[leadStatus];
    if (!m) return null;
    return (
      <Badge variant="outline" className={cn(BADGE_BASE, m.cls)}>
        {m.label}
      </Badge>
    );
  })();

  const sourceBadgesSlot = (
    <div className="flex flex-wrap justify-start gap-1.5">
      {badge && (
        <Badge
          variant="outline"
          className={cn(
            BADGE_BASE,
            badge.tone === "wca" && "bg-primary/15 text-primary border-primary/30",
            badge.tone === "primary" && "bg-primary/15 text-primary border-primary/30",
            badge.tone === "neutral" && "bg-muted/40 text-muted-foreground border-border/40"
          )}
        >
          {badge.label}
        </Badge>
      )}
      {meta?.wcaYears != null && (
        <Badge variant="outline" className={cn(BADGE_BASE, "bg-warning/10 text-warning border-warning/30")}>
          <Trophy className="h-3 w-3" />
          {meta.wcaYears}
        </Badge>
      )}
      {hasBca && (
        <Badge variant="outline" className={cn(BADGE_BASE, "bg-success/10 text-success border-success/30")}>
          BCA{bcaCount && bcaCount > 1 ? ` ${bcaCount}` : ""}
        </Badge>
      )}
    </div>
  );

  const statusBadgesSlot = (
    <div className="flex flex-wrap justify-end gap-1.5">
      {isBlacklisted && (
        <Badge
          variant="outline"
          className={cn(BADGE_BASE, "bg-destructive/15 text-destructive border-destructive/40")}
          title="Azienda presente nella blacklist WCA World"
        >
          <ShieldAlert className="h-3 w-3" />
          Blacklist
        </Badge>
      )}
      {isCustomer && (
        <Badge variant="outline" className={cn(BADGE_BASE, "bg-success/20 text-success border-success/40")}>
          Cliente
        </Badge>
      )}
      {leadStatusBadge}
      {sherlockLevel && <SherlockLevelBadge level={sherlockLevel} completedAt={sherlockCompletedAt} />}
      {isFavorite && <Star className="h-4 w-4 shrink-0 fill-warning text-warning" />}
      {meta?.holding && (
        <span title="In circuito di attesa">
          <Plane className="h-4 w-4 shrink-0 animate-pulse text-primary" />
        </span>
      )}
    </div>
  );

  const recencySlot = (
    <span
      className={cn(
        BADGE_BASE,
        "bg-muted/20",
        recency.tone === "ok" && "text-success border-success/30",
        recency.tone === "warn" && "text-warning border-warning/30",
        recency.tone === "alert" && "text-destructive border-destructive/30",
        recency.tone === "muted" && "text-muted-foreground/70 border-border/50"
      )}
      title={lastInteractionAt ? `Ultimo contatto: ${new Date(lastInteractionAt).toLocaleString()}` : "Mai contattato"}
    >
      <Clock className="h-3 w-3" />
      {recency.label}
    </span>
  );

  const contactSlot = primaryContact ? (
    <div className="grid min-w-0 gap-2 rounded-md border border-border/50 bg-muted/15 px-2.5 py-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]">
      <div className="min-w-0">
        <span className="block text-[10px] font-semibold leading-none text-muted-foreground/75">Contatto</span>
        <span className="mt-1 block truncate text-[13px] font-semibold leading-tight text-foreground/90">
          {primaryContact.name}
        </span>
      </div>
      <div className="min-w-0">
        <span className="block text-[10px] font-semibold leading-none text-muted-foreground/75">Ruolo</span>
        <span className="mt-1 block truncate text-[12px] leading-tight text-muted-foreground">
          {primaryContact.role || "—"}
        </span>
      </div>
      {contactsCount > 1 && (
        <span className="self-end rounded-md border border-border/50 bg-muted/30 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
          +{contactsCount - 1}
        </span>
      )}
    </div>
  ) : (
    <div className="rounded-md border border-border/45 bg-muted/15 px-2.5 py-2 text-[12px] italic text-muted-foreground/60">
      {contactsCount === 0 ? "Nessun referente" : `${contactsCount} contatt${contactsCount === 1 ? "o" : "i"}`}
    </div>
  );

  const contactMethodsSlot = (firstEmail || firstPhone) && (
    <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
      {firstEmail && (
        <a
          href={`mailto:${firstEmail}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(CHIP_BASE, "border-primary/25 bg-primary/10 text-primary hover:border-primary/50")}
          title={firstEmail}
        >
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{firstEmail}</span>
        </a>
      )}
      {firstPhone && (
        <a
          href={`tel:${firstPhone.replace(/[^0-9+]/g, "")}`}
          onClick={(e) => e.stopPropagation()}
          className={cn(CHIP_BASE, "border-chart-3/25 bg-chart-3/10 text-chart-3 hover:border-chart-3/50")}
          title={firstPhone}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{firstPhone}</span>
        </a>
      )}
    </div>
  );

  const metaSlot = (city || enrichedLabel || origin) && (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {city &&
        (onCityClick ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCityClick(city);
            }}
            className={cn(CHIP_BASE, "max-w-[180px] border-border/55 bg-muted/35 text-foreground/80 hover:border-primary/45 hover:text-primary")}
            title={`Filtra per città ${city}`}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{city}</span>
          </button>
        ) : (
          <span className={cn(CHIP_BASE, "max-w-[180px] border-border/55 bg-muted/35 text-foreground/80")}>
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{city}</span>
          </span>
        ))}
      {enrichedLabel && (
        <span
          className={cn(CHIP_BASE, "border-success/25 bg-success/10 text-success")}
          title={enrichedAt ? `Ultima Deep Search: ${new Date(enrichedAt).toLocaleString()}` : undefined}
        >
          {enrichedLabel}
        </span>
      )}
      {origin && (
        <span className={cn(CHIP_BASE, "max-w-[150px] border-border/45 bg-muted/25 text-muted-foreground")} title={`Origine: ${origin}`}>
          <span className="truncate">{origin}</span>
        </span>
      )}
    </div>
  );

  const countryNode = (
    <EntityRowFlag countryCode={countryCode} size={compact ? "md" : "lg"} />
  );

  return (
    <article
      onClick={() => onOpenCompany?.(company)}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card/70 shadow-sm transition-all",
        compact ? "p-2.5" : "p-3",
        CARD_BORDER[source],
        selected && "ring-1 ring-primary/50 bg-primary/[0.05]",
        opened && "ring-1 ring-primary/70 border-primary/70 bg-primary/[0.07] shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
      )}
    >
      <div className={cn("absolute left-0 top-0 h-full w-1 bg-gradient-to-b", CARD_STRIPE[source])} />

      <div className={cn("grid min-w-0 gap-3", compact ? "grid-cols-[42px_minmax(0,1fr)_32px]" : "grid-cols-[64px_minmax(0,1fr)_minmax(128px,auto)]")}>
        <div className="flex flex-col items-center gap-2 pl-1">
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
          {onCountryClick && countryCode ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCountryClick(countryCode);
              }}
              className="rounded-md transition-all hover:ring-1 hover:ring-primary/45"
              aria-label={`Filtra per paese ${countryCode}`}
              title={`Filtra per paese ${countryCode}`}
            >
              {countryNode}
            </button>
          ) : (
            countryNode
          )}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex min-w-0 items-start gap-2">
              {logoFromMeta && (
                <img
                  src={logoFromMeta}
                  alt=""
                  loading="lazy"
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-md border border-border/50 bg-background object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <h3 className="min-w-0 flex-1 truncate text-[17px] font-extrabold uppercase leading-tight text-foreground">
                {name || "—"}
              </h3>
            </div>
            {compact && (
              <div className="space-y-1.5">
                {sourceBadgesSlot}
                {statusBadgesSlot}
              </div>
            )}
          </div>

          {contactSlot}
          {contactMethodsSlot}
          {metaSlot}

          {compact && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-border/35 pt-2">
              {recencySlot}
              <ScorePill value={score ?? null} className="h-5 rounded-md px-1.5 text-[10px]" />
              {channels && <ChannelIcons {...channels} size="md" className="gap-1.5" />}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col items-end justify-between gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                aria-label="Azioni rapide"
                title="Azioni rapide"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
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
              <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground">
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

          {!compact && (
            <div className="flex min-w-[128px] flex-col items-end gap-1.5">
              {sourceBadgesSlot}
              {statusBadgesSlot}
            </div>
          )}

          {!compact && (
            <div className="flex min-w-[128px] flex-col items-end gap-1.5 border-t border-border/35 pt-2">
              <div className="flex flex-wrap justify-end gap-1.5">
                {recencySlot}
                <ScorePill value={score ?? null} className="h-5 rounded-md px-1.5 text-[10px]" />
              </div>
              {channels && <ChannelIcons {...channels} size="md" className="justify-end gap-1.5" />}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default CompanyCard;
