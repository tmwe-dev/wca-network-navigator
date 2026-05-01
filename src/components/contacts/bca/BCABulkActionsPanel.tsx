/**
 * BCABulkActionsPanel — Pannello che sostituisce il dettaglio singolo quando
 * l'utente ha selezionato 2+ biglietti.
 *
 * Mostra:
 *  - Header con conteggi (biglietti, aziende uniche)
 *  - Azioni bulk con badge di eleggibilità (es. K matchati WCA, J con email)
 *  - Anteprima della selezione con remove ×
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Search, Megaphone, Trash2, X, Building2, Mail } from "lucide-react";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface Props {
  cards: BusinessCardWithPartner[];
  onClear: () => void;
  onRemove: (id: string) => void;
  onCockpit: () => void;
  onDeepSearch: () => void;
  onDelete: () => void;
}

export function BCABulkActionsPanel({ cards, onClear, onRemove, onCockpit, onDeepSearch, onDelete }: Props) {
  const stats = useMemo(() => {
    const companies = new Set(cards.map(c => c.company_name).filter(Boolean));
    const matched = cards.filter(c => c.matched_partner_id).length;
    const withEmail = cards.filter(c => c.email).length;
    return { total: cards.length, companies: companies.size, matched, withEmail };
  }, [cards]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-foreground">{stats.total} biglietti selezionati</h2>
          <p className="text-[11px] text-muted-foreground">
            {stats.companies} aziend{stats.companies === 1 ? "a" : "e"} · {stats.matched} matchati · {stats.withEmail} con email
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={onClear}>
          <X className="w-3 h-3" /> Pulisci
        </Button>
      </div>

      {/* Azioni bulk */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Azioni bulk</p>

        <ActionRow
          icon={<ArrowRight className="w-4 h-4 text-primary" />}
          label="Aggiungi tutti al Cockpit"
          badge={`${stats.total}`}
          onClick={onCockpit}
        />
        <ActionRow
          icon={<Search className="w-4 h-4 text-primary" />}
          label="Deep Search batch"
          sub="Solo per i biglietti matchati"
          badge={`${stats.matched}`}
          disabled={stats.matched === 0}
          onClick={onDeepSearch}
        />
        <ActionRow
          icon={<Megaphone className="w-4 h-4 text-amber-400" />}
          label="Crea campagna multi-destinatario"
          sub="Solo contatti con email"
          badge={`${stats.withEmail}`}
          disabled={stats.withEmail === 0}
          onClick={onCockpit}
        />
        <ActionRow
          icon={<Trash2 className="w-4 h-4 text-destructive" />}
          label="Elimina selezionati"
          sub="Soft-delete: recuperabili"
          badge={`${stats.total}`}
          danger
          onClick={onDelete}
        />
      </div>

      {/* Anteprima selezione */}
      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Anteprima selezione</p>
        <div className="space-y-1 max-h-[40vh] overflow-y-auto rounded-lg border border-border/30 bg-muted/10 p-1.5">
          {cards.map(c => (
            <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30 group">
              <Building2 className="w-3 h-3 text-muted-foreground/60 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-foreground truncate">{c.contact_name || "—"}</div>
                <div className="text-[10px] text-muted-foreground truncate">{c.company_name || "—"}</div>
              </div>
              {c.email && <Mail className="w-3 h-3 text-emerald-400/70 shrink-0" />}
              {c.matched_partner_id && <Badge variant="outline" className="text-[8px] h-4 px-1 bg-primary/10 text-primary border-primary/30">WCA</Badge>}
              <button
                onClick={() => onRemove(c.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                aria-label="Rimuovi dalla selezione"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───── Action row ───── */

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  badge?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

function ActionRow({ icon, label, sub, badge, disabled, danger, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all " +
        (disabled
          ? "border-border/20 bg-muted/10 opacity-50 cursor-not-allowed"
          : danger
            ? "border-destructive/20 bg-destructive/[0.04] hover:bg-destructive/10 hover:border-destructive/40"
            : "border-border/40 bg-card/40 hover:bg-primary/[0.06] hover:border-primary/30")
      }
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
      </div>
      {badge && (
        <span className={
          "text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 " +
          (danger ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")
        }>
          {badge}
        </span>
      )}
    </button>
  );
}