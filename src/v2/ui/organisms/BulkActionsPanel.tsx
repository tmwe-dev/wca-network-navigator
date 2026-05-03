/**
 * BulkActionsPanel — Pannello destro mostrato quando 2+ aziende sono
 * selezionate dalla CompanyCardList. Clone dell'UX BCA "N selezionati".
 *
 * Logic-less: tutte le azioni sono callback che il consumer collega.
 */
import * as React from "react";
import { X, Plus, Search, Megaphone, Trash2, Building2, Mail, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";

export interface BulkActionsPanelProps {
  selected: CompanyEntity[];
  onClear: () => void;
  onAddToCockpit?: (selected: CompanyEntity[]) => void;
  onDeepSearch?: (selected: CompanyEntity[]) => void;
  onCreateCampaign?: (selected: CompanyEntity[]) => void;
  onSoftDelete?: (selected: CompanyEntity[]) => void;
  onChangeOrigin?: (selected: CompanyEntity[]) => void;
  className?: string;
}

function ActionRow({
  icon: Icon,
  title,
  hint,
  count,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  count: number;
  onClick?: () => void;
  destructive?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all text-left",
        destructive
          ? "border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
          : "border-border/40 hover:border-primary/40 hover:bg-primary/5",
        !onClick && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Icon className={cn("w-4 h-4 flex-shrink-0", destructive ? "text-destructive" : "text-primary")} />
        <div className="min-w-0">
          <div className={cn("text-[12px] font-semibold truncate", destructive ? "text-destructive" : "text-foreground")}>
            {title}
          </div>
          {hint && <div className="text-[10px] text-muted-foreground truncate">{hint}</div>}
        </div>
      </div>
      <span
        className={cn(
          "text-[11px] font-mono px-2 py-0.5 rounded-md flex-shrink-0",
          destructive ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function BulkActionsPanel({
  selected,
  onClear,
  onAddToCockpit,
  onDeepSearch,
  onCreateCampaign,
  onSoftDelete,
  onChangeOrigin,
  className,
}: BulkActionsPanelProps): React.ReactElement {
  const count = selected.length;
  const withEmail = selected.filter((s) => s.channels?.email).length;
  const distinctCompanies = new Set(selected.map((s) => s.id)).size;

  return (
    <div className={cn("flex flex-col h-full bg-card", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{count} selezionati</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {distinctCompanies} aziend{distinctCompanies === 1 ? "a" : "e"} · {withEmail} con email
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground"
          aria-label="Pulisci selezione"
          title="Pulisci selezione"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80 px-1 pb-1.5">
            Azioni bulk
          </div>
          <div className="space-y-1.5">
            <ActionRow
              icon={Plus}
              title="Aggiungi al Cockpit"
              count={count}
              onClick={onAddToCockpit ? () => onAddToCockpit(selected) : undefined}
            />
            <ActionRow
              icon={Search}
              title="Deep Search batch"
              hint="Solo aziende selezionate"
              count={count}
              onClick={onDeepSearch ? () => onDeepSearch(selected) : undefined}
            />
            <ActionRow
              icon={Megaphone}
              title="Crea campagna multi-destinatario"
              hint="Solo contatti con email"
              count={withEmail}
              onClick={onCreateCampaign ? () => onCreateCampaign(selected) : undefined}
            />
            {onChangeOrigin && (
              <ActionRow
                icon={Tag}
                title="Cambia origine"
                hint="Riassegna o crea un gruppo"
                count={count}
                onClick={() => onChangeOrigin(selected)}
              />
            )}
            <ActionRow
              icon={Trash2}
              title="Elimina selezionati"
              hint="Soft-delete: recuperabili"
              count={count}
              onClick={onSoftDelete ? () => onSoftDelete(selected) : undefined}
              destructive
            />
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground/80 px-1 pb-1.5">
            Anteprima selezione
          </div>
          <div className="space-y-1">
            {selected.slice(0, 12).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/30 bg-card/40 text-[11px]"
              >
                <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-foreground truncate flex-1">{c.name}</span>
                {c.channels?.email && <Mail className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
              </div>
            ))}
            {selected.length > 12 && (
              <div className="text-[10px] text-muted-foreground/70 italic px-2 pt-1">
                + altri {selected.length - 12}…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BulkActionsPanel;