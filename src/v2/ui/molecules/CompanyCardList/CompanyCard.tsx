/**
 * CompanyCard — header azienda + grid sub-card dei contatti annidati.
 * Logic-less, alimentato da `CompanyEntity`.
 */
import * as React from "react";
import { Plane, Trophy, MoreHorizontal, Star, Clock, Mail, MessageCircle, Phone, ExternalLink, Search, ScanSearch, Telescope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EntityRow, type EntityRowTone } from "@/v2/ui/atoms/EntityRow";
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

function sourceTone(source: CompanySource): EntityRowTone {
  if (source === "wca") return "wca";
  if (source === "crm") return "crm";
  if (source === "bca") return "bca";
  return "neutral";
}

export interface CompanyCardProps extends CompanyCardListCallbacks {
  company: CompanyEntity;
  /** True quando l'azienda è multi-selezionata. */
  selected?: boolean;
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
  onToggleSelect,
  compact = false,
  sherlockLevel = null,
  sherlockCompletedAt = null,
  onCountryClick,
  onCityClick,
}: CompanyCardProps): React.ReactElement {
  const { name, city, countryCode, badge, contactsCount, meta, source, score, primaryContact, channels, hasBca, leadStatus, isFavorite, lastInteractionAt, bcaCount, origin, enrichedAt, logoUrl, primaryEmail, primaryPhone } = company;
  const tone = sourceTone(source);
  const { handleSendEmail, handleSendWhatsApp } = useDirectContactActions();

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
      qualified: { label: "Qualificato", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
      holding: { label: "In attesa", cls: "bg-primary/15 text-primary border-primary/30" },
      archived: { label: "Archiviato", cls: "bg-muted/40 text-muted-foreground border-border/40" },
      blacklisted: { label: "Blacklist", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    };
    const m = map[leadStatus];
    if (!m) return null;
    return (
      <Badge variant="outline" className={cn("text-[9px] flex-shrink-0 px-1 py-0 h-4", m.cls)}>
        {m.label}
      </Badge>
    );
  })();

  const titleSlot = (
    <>
      {logoFromMeta && (
        <img
          src={logoFromMeta}
          alt=""
          loading="lazy"
          className="w-4 h-4 rounded-sm object-contain bg-background border border-border/40 flex-shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <span className="truncate text-foreground">{name || "—"}</span>
      {badge && (
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] flex-shrink-0 px-1 py-0 h-4",
            badge.tone === "wca" && "bg-primary/15 text-primary border-primary/30",
            badge.tone === "primary" && "bg-primary/15 text-primary border-primary/30",
            badge.tone === "neutral" && "bg-muted/40 text-muted-foreground border-border/40"
          )}
        >
          {badge.label}
        </Badge>
      )}
      {meta?.wcaYears != null && (
        <Badge variant="outline" className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-amber-500/10 text-amber-500 border-amber-500/30 gap-0.5">
          <Trophy className="w-2.5 h-2.5" />
          {meta.wcaYears}
        </Badge>
      )}
      {hasBca && (
        <Badge variant="outline" className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
          BCA{bcaCount && bcaCount > 1 ? ` ${bcaCount}` : ""}
        </Badge>
      )}
      {isCustomer && (
        <Badge variant="outline" className="text-[9px] flex-shrink-0 px-1 py-0 h-4 bg-emerald-500/20 text-emerald-500 border-emerald-500/40 font-semibold">
          Cliente
        </Badge>
      )}
      {leadStatusBadge}
      {sherlockLevel && (
        <SherlockLevelBadge level={sherlockLevel} completedAt={sherlockCompletedAt} />
      )}
      {isFavorite && (
        <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
      )}
      {meta?.holding && (
        <span title="In circuito di attesa">
          <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-pulse" />
        </span>
      )}
    </>
  );

  const recencySlot = (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0 rounded flex-shrink-0",
        recency.tone === "ok" && "text-emerald-500",
        recency.tone === "warn" && "text-amber-500",
        recency.tone === "alert" && "text-destructive",
        recency.tone === "muted" && "text-muted-foreground/50"
      )}
      title={lastInteractionAt ? `Ultimo contatto: ${new Date(lastInteractionAt).toLocaleString()}` : "Mai contattato"}
    >
      <Clock className="w-2.5 h-2.5" /> {recency.label}
    </span>
  );

  const subTitleSlot = primaryContact ? (
    <>
      <span className="truncate font-medium text-foreground/70">{primaryContact.name}</span>
      {primaryContact.role && (
        <>
          <span className="text-muted-foreground/40">·</span>
          <span className="truncate">{primaryContact.role}</span>
        </>
      )}
      {contactsCount > 1 && (
        <span className="text-muted-foreground/60 flex-shrink-0">+{contactsCount - 1}</span>
      )}
      {(origin || enrichedLabel || firstEmail || firstPhone) && (
        <span className="text-muted-foreground/40 flex-shrink-0">·</span>
      )}
      {origin && (
        <span className="text-[10px] text-muted-foreground/70 truncate flex-shrink-0" title={`Origine: ${origin}`}>
          {origin}
        </span>
      )}
      {enrichedLabel && (
        <span className="text-[10px] text-emerald-500/80 flex-shrink-0" title={enrichedAt ? `Ultima Deep Search: ${new Date(enrichedAt).toLocaleString()}` : undefined}>
          {enrichedLabel}
        </span>
      )}
      {firstEmail && (
        <a
          href={`mailto:${firstEmail}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-primary hover:underline flex-shrink-0 inline-flex items-center gap-0.5"
          title={firstEmail}
        >
          <Mail className="w-2.5 h-2.5" />
        </a>
      )}
      {firstPhone && (
        <a
          href={`tel:${firstPhone.replace(/[^0-9+]/g, "")}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] text-chart-3 hover:underline flex-shrink-0 inline-flex items-center gap-0.5"
          title={firstPhone}
        >
          <Phone className="w-2.5 h-2.5" />
        </a>
      )}
    </>
  ) : (
    <span className="italic text-muted-foreground/50">
      {contactsCount === 0 ? "Nessun referente" : `${contactsCount} contatt${contactsCount === 1 ? "o" : "i"}`}
    </span>
  );

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden transition-all",
        selected && "ring-1 ring-primary/60 bg-primary/[0.05]"
      )}
    >
      <EntityRow
        tone={tone}
        countryCode={countryCode}
        selected={selected}
        compact={compact}
        onCountryClick={onCountryClick}
        onCityClick={onCityClick}
        checkboxSlot={
          onToggleSelect ? (
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect(company.id)}
              aria-label={`Seleziona ${company.name}`}
              className="h-3.5 w-3.5"
            />
          ) : undefined
        }
        titleSlot={titleSlot}
        subTitleSlot={subTitleSlot}
        city={city}
        channels={channels}
        score={score ?? null}
        recencySlot={recencySlot}
        actionsSlot={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                aria-label="Azioni rapide"
                title="Azioni rapide"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {primaryContactFull?.name || company.name}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onMenuEmail} disabled={!firstEmail}>
                <Mail className="w-3.5 h-3.5 mr-2 text-primary" /> Invia email
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMenuWhatsApp} disabled={!firstPhone}>
                <MessageCircle className="w-3.5 h-3.5 mr-2 text-emerald-500" /> WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMenuCall} disabled={!firstPhone}>
                <Phone className="w-3.5 h-3.5 mr-2 text-chart-3" /> Chiama
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onMenuOpen}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Apri dettaglio
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Deep Search
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("sherlock-launch", {
                      detail: { partnerId: company.id, level: 1 },
                    })
                  );
                }}
              >
                <Search className="w-3.5 h-3.5 mr-2 text-muted-foreground" /> Scout
                <span className="ml-auto text-[10px] text-muted-foreground">~30s</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("sherlock-launch", {
                      detail: { partnerId: company.id, level: 2 },
                    })
                  );
                }}
              >
                <ScanSearch className="w-3.5 h-3.5 mr-2 text-primary" /> Detective
                <span className="ml-auto text-[10px] text-muted-foreground">~2min</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(
                    new CustomEvent("sherlock-launch", {
                      detail: { partnerId: company.id, level: 3 },
                    })
                  );
                }}
              >
                <Telescope className="w-3.5 h-3.5 mr-2 text-amber-500" /> Sherlock
                <span className="ml-auto text-[10px] text-muted-foreground">~5min</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        onClick={() => onOpenCompany?.(company)}
      />
    </div>
  );
}

export default CompanyCard;