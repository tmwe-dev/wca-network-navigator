/**
 * CompanyCard — header azienda + grid sub-card dei contatti annidati.
 * Logic-less, alimentato da `CompanyEntity`.
 */
import * as React from "react";
import { ChevronDown, ChevronRight, Building2, Brain, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OptimizedImage } from "@/components/shared/OptimizedImage";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import { ContactSubCard } from "./ContactSubCard";
import type { CompanyEntity, CompanyCardListCallbacks } from "./types";

export interface CompanyCardProps extends CompanyCardListCallbacks {
  company: CompanyEntity;
  /** True quando la card è aperta (contatti visibili). */
  expanded: boolean;
  /** Toggle apertura. */
  onToggleExpand: (id: string) => void;
}

export function CompanyCard({
  company,
  expanded,
  onToggleExpand,
  onOpenCompany,
  onOpenContact,
}: CompanyCardProps): React.ReactElement {
  const { name, city, countryCode, badge, contacts, contactsCount, meta, source } = company;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  const headerToneMatched =
    badge?.tone === "wca" || source === "wca";

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden transition-all",
        headerToneMatched
          ? "border-primary/30 bg-primary/[0.03]"
          : "border-border/60 bg-card/40"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30">
        <button
          type="button"
          onClick={() => onToggleExpand(company.id)}
          className="flex-shrink-0 p-1 rounded hover:bg-muted/40 text-muted-foreground"
          aria-label={expanded ? "Comprimi" : "Espandi"}
        >
          <Chevron className="w-3.5 h-3.5" />
        </button>
        <div
          className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border",
            headerToneMatched
              ? "border-primary/30 bg-primary/10"
              : "border-border/40 bg-muted/30"
          )}
        >
          {meta?.logoUrl ? (
            <OptimizedImage
              src={meta.logoUrl}
              alt=""
              className="w-7 h-7 rounded object-contain"
            />
          ) : (
            <Building2
              className={cn(
                "w-4 h-4",
                headerToneMatched ? "text-primary/60" : "text-muted-foreground/40"
              )}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => onOpenCompany?.(company)}
          className="flex-1 min-w-0 text-left group"
        >
          <div className="flex items-center gap-2">
            {countryCode && (
              <span className="text-lg leading-none flex-shrink-0">
                {countryCodeToFlag(countryCode)}
              </span>
            )}
            <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary">
              {name || "—"}
            </span>
            {badge && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] flex-shrink-0",
                  badge.tone === "wca" &&
                    "bg-primary/15 text-primary border-primary/30",
                  badge.tone === "primary" &&
                    "bg-primary/15 text-primary border-primary/30",
                  badge.tone === "neutral" &&
                    "bg-muted/40 text-muted-foreground border-border/40"
                )}
              >
                {badge.label}
              </Badge>
            )}
            {meta?.holding && (
              <span title="In circuito di attesa">
                <Plane className="w-3.5 h-3.5 text-primary flex-shrink-0 animate-pulse" />
              </span>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
            {city && <span className="truncate">{city}</span>}
            <span>·</span>
            <span>
              {contactsCount} contatt{contactsCount === 1 ? "o" : "i"}
            </span>
            {meta?.wcaYears != null && (
              <>
                <span>·</span>
                <span className="text-primary/70">{meta.wcaYears} anni WCA</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Sub-cards contatti */}
      {expanded && (
        <div className="p-3">
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