/**
 * SuggestionCard — card mittente estratta da AISuggestionsTab (pure UI).
 * Nessuna modifica di comportamento: stessa firma, stessi handler, stessa estetica.
 */
import { memo, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  Sparkles, Check, X, Loader2, Mail, Wand2, ArrowRight,
} from "lucide-react";
import { Settings2 } from "lucide-react";
import { getFlagFromDomain, getDomainFaviconUrl } from "@/lib/domainUtils";
import { deriveSenderDisplayName } from "@/lib/senderDisplayName";
import type { EmailSenderGroup } from "@/types/email-management";
import { cn } from "@/lib/utils";
import { DeepSearchEmailButton } from "@/v2/ui/organisms/sherlock/DeepSearchEmailButton";

export interface AddressRow {
  id: string;
  email_address: string;
  display_name: string | null;
  email_count: number;
  company_name?: string | null;
  domain?: string | null;
  group_id: string | null;
  group_name: string | null;
  group_color: string | null;
  group_icon: string | null;
  ai_suggested_group: string | null;
  ai_suggestion_confidence?: number | null;
}

function getDomain(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : email;
}

function getInitials(name: string): string {
  const parts = (name || "?").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

interface CardProps {
  row: AddressRow;
  groups: EmailSenderGroup[];
  isSelected: boolean;
  isFocused: boolean;
  isRemoving: boolean;
  onToggleSelect: (email: string) => void;
  onFocus: (row: AddressRow) => void;
  onAnalyzeOne: (row: AddressRow) => void;
  onAccept: (row: AddressRow) => void;
  onIgnore: (row: AddressRow) => void;
  onAssign: (row: AddressRow, groupId: string) => void;
  onOpenActions: (row: AddressRow) => void;
  busy: boolean;
}

export const SuggestionCard = memo(function SuggestionCard({
  row, groups, isSelected, isFocused, isRemoving, onToggleSelect, onFocus, onAnalyzeOne, onAccept, onIgnore, onAssign, onOpenActions, busy,
}: CardProps) {
  const [faviconError, setFaviconError] = useState(false);
  const domain = row.domain || getDomain(row.email_address);
  const flag = getFlagFromDomain(domain);
  const faviconUrl = getDomainFaviconUrl(domain);
  const company = row.company_name || row.display_name || deriveSenderDisplayName(row.email_address);
  const initials = getInitials(company);

  const suggestedGroup = useMemo(
    () => groups.find((g) => g.nome_gruppo === row.ai_suggested_group),
    [groups, row.ai_suggested_group],
  );
  const currentGroup = useMemo(
    () => groups.find((g) => g.id === row.group_id),
    [groups, row.group_id],
  );

  const accent = currentGroup?.colore
    || suggestedGroup?.colore
    || (row.email_count > 100 ? "hsl(var(--destructive))" : "hsl(var(--primary))");

  return (
    <Card
      className={cn(
        "border-l-4 transition-all hover:shadow-md cursor-pointer",
        "transition-[opacity,transform,max-height,margin,padding] duration-300 ease-out overflow-hidden",
        isFocused && "ring-2 ring-primary shadow-md",
        isSelected && "border-2 border-primary bg-primary/5",
        isRemoving && "opacity-0 scale-95 -translate-y-1 max-h-0 my-0 py-0 border-0 pointer-events-none",
      )}
      style={{ borderLeftColor: accent }}
      onClick={() => onFocus(row)}
    >
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2.5">
          {faviconUrl && !faviconError ? (
            <img
              src={faviconUrl}
              alt=""
              className="h-10 w-10 rounded-md flex-shrink-0 object-contain bg-background border border-border/50"
              loading="lazy"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary leading-none">{initials}</span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div
              className="font-semibold text-sm text-foreground leading-snug break-words capitalize"
              title={company}
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {company}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-foreground mt-0.5">
              {flag && (
                <span className="text-sm leading-none flex-shrink-0" title={domain}>
                  {flag}
                </span>
              )}
              <span className="truncate" title={row.email_address}>{row.email_address}</span>
            </div>
          </div>

          <div className="flex items-baseline gap-1 flex-shrink-0">
            <Mail className="h-3 w-3 text-muted-foreground self-center" />
            <span className="text-base font-bold text-primary leading-none">
              {row.email_count}
            </span>
          </div>
        </div>

        {row.ai_suggested_group ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFocus(row);
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-left"
          >
            <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-primary leading-none">
                Suggerimento AI
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                {suggestedGroup?.icon && <span>{suggestedGroup.icon}</span>}
                <span className="text-xs font-semibold text-foreground truncate leading-tight">
                  {row.ai_suggested_group}
                </span>
              </div>
            </div>
          </button>
        ) : null}

        {currentGroup ? (
          <Badge
            variant="secondary"
            className="gap-1 text-[11px] py-0.5 h-6 px-2 self-start"
            style={{
              backgroundColor: (currentGroup.colore || "#666") + "22",
              color: currentGroup.colore || undefined,
              borderColor: (currentGroup.colore || "#666") + "55",
            }}
          >
            <span>{currentGroup.icon}</span>
            <Check className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{currentGroup.nome_gruppo}</span>
          </Badge>
        ) : !row.ai_suggested_group ? (
          <div className="text-[11px] text-muted-foreground italic px-1">
            Nessuna classificazione — assegna un gruppo
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 pt-2 mt-1">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(row.email_address)}
            onClick={(event) => event.stopPropagation()}
            className="h-4 w-4 flex-shrink-0"
            aria-label="Seleziona address"
          />

          <Select onValueChange={(gId) => onAssign(row, gId)} disabled={busy}>
            <SelectTrigger
              className="h-8 w-auto gap-1 px-2 text-xs border border-border/60 bg-background hover:bg-muted/40 shadow-none [&>svg:last-child]:opacity-70"
              aria-label={currentGroup ? "Cambia gruppo" : "Assegna gruppo"}
              title={currentGroup ? "Cambia gruppo" : "Assegna gruppo"}
            >
              <Wand2 className="h-3.5 w-3.5 text-primary" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  <span className="mr-1.5">{g.icon}</span>{g.nome_gruppo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 gap-1"
            onClick={(event) => {
              event.stopPropagation();
              onOpenActions(row);
            }}
            disabled={busy}
            title="Azioni e regole"
          >
            <Settings2 className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">Azioni</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2.5 gap-1"
            onClick={(event) => {
              event.stopPropagation();
              onAnalyzeOne(row);
            }}
            disabled={busy}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs">AI</span>
          </Button>

          <div onClick={(e) => e.stopPropagation()} className="inline-flex">
            <DeepSearchEmailButton
              email={row.email_address}
              source={{ displayName: row.display_name, companyName: row.company_name ?? undefined }}
              size="sm"
              variant="outline"
              className="h-8 px-2.5 gap-1"
              label="Deep"
            />
          </div>

          {row.ai_suggested_group && !currentGroup && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-8 px-2.5 gap-1"
                onClick={() => onAccept(row)}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                <span className="text-xs">Accetta</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={cn("h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10")}
                onClick={() => onIgnore(row)}
                disabled={busy}
                title="Ignora suggerimento AI"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});