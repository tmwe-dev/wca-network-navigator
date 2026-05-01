/**
 * CompanyCard — header azienda + grid sub-card dei contatti annidati.
 * Logic-less, alimentato da `CompanyEntity`.
 */
import * as React from "react";
import { ChevronDown, ChevronRight, Plane, Trophy, MoreHorizontal, Star, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EntityRow, type EntityRowTone } from "@/v2/ui/atoms/EntityRow";
import { ContactSubCard } from "./ContactSubCard";
import type { CompanyEntity, CompanyCardListCallbacks, CompanySource } from "./types";

function sourceTone(source: CompanySource): EntityRowTone {
  if (source === "wca") return "wca";
  if (source === "crm") return "crm";
  if (source === "bca") return "bca";
  return "neutral";
}

export interface CompanyCardProps extends CompanyCardListCallbacks {
  company: CompanyEntity;
  /** True quando la card è aperta (contatti visibili). */
  expanded: boolean;
  /** Toggle apertura. */
  onToggleExpand: (id: string) => void;
  /** True quando l'azienda è multi-selezionata. */
  selected?: boolean;
  /** Toggle selezione (checkbox). */
  onToggleSelect?: (id: string) => void;
}

export function CompanyCard({
  company,
  expanded,
  onToggleExpand,
  onOpenCompany,
  onOpenContact,
  selected,
  onToggleSelect,
}: CompanyCardProps): React.ReactElement {
  const { name, city, countryCode, badge, contacts, contactsCount, meta, source, score, primaryContact, channels, hasBca, leadStatus, isFavorite, lastInteractionAt, bcaCount } = company;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const tone = sourceTone(source);

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
      {leadStatusBadge}
      {isFavorite && (
        <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
      )}
      {meta?.holding && (
        <span title="In circuito di attesa">
          <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-pulse" />
        </span>
      )}
      <span
        className={cn(
          "ml-auto inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0 rounded flex-shrink-0",
          recency.tone === "ok" && "text-emerald-500",
          recency.tone === "warn" && "text-amber-500",
          recency.tone === "alert" && "text-destructive",
          recency.tone === "muted" && "text-muted-foreground/50"
        )}
        title={lastInteractionAt ? `Ultimo contatto: ${new Date(lastInteractionAt).toLocaleString()}` : "Mai contattato"}
      >
        <Clock className="w-2.5 h-2.5" /> {recency.label}
      </span>
    </>
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
        expanded && "ring-1 ring-border/40 bg-card/20",
        selected && "ring-1 ring-primary/60 bg-primary/[0.05]"
      )}
    >
      <EntityRow
        tone={tone}
        countryCode={countryCode}
        selected={selected}
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
        chevronSlot={
          <button
            type="button"
            onClick={() => onToggleExpand(company.id)}
            className="p-0.5 rounded hover:bg-muted/40 text-muted-foreground"
            aria-label={expanded ? "Comprimi" : "Espandi"}
          >
            <Chevron className="w-3.5 h-3.5" />
          </button>
        }
        titleSlot={titleSlot}
        subTitleSlot={subTitleSlot}
        city={city}
        channels={channels}
        score={score ?? null}
        actionsSlot={
          <button
            type="button"
            onClick={() => onOpenCompany?.(company)}
            className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
            aria-label="Apri dettaglio"
            title="Apri dettaglio"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        }
        onClick={() => onOpenCompany?.(company)}
      />

      {/* Sub-cards contatti */}
      {expanded && (
        <div className="px-3 py-2 border-t border-border/30">
          {contacts === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Array.from({ length: Math.min(contactsCount || 2, 4) }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 rounded-lg border border-border/40 bg-muted/20 animate-pulse"
                />
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-[11px] text-muted-foreground/70 italic px-1 py-2">
              Nessun contatto · Apri l'azienda per aggiungerne uno
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {contacts.map((c) => (
                <ContactSubCard
                  key={c.id}
                  contact={c}
                  company={company}
                  onOpen={onOpenContact}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompanyCard;