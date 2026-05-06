/**
 * CestinonePage — 2-column workspace.
 * Refactor 2026-05-05: monolite (929 LOC) suddiviso in `cestinone/`.
 *  - meta.ts                  → CHANNEL_META / STATUS_META / TRIGGER_META / PARTNER_TYPE_META
 *  - utils.ts                 → minutesUntilTomorrow9 / minutesUntilNextMonday9
 *  - AgentBadge.tsx           → AgentBadge / EmptyPane / CheckRow
 *  - ListRow.tsx              → card lista
 *  - tabs.tsx                 → Preview/Origin/History/Checks/Recipient
 *  - DetailPanel.tsx          → header + tabs + footer azioni
 *  - Toolbar.tsx              → ChipGroup / ChannelDropdown
 *  - useCestinonePageState.ts → state, filtri, bulk, navigation
 */
import * as React from "react";
import { CheckCircle2, Search, Trash2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { ListRow } from "./cestinone/ListRow";
import { DetailPanel } from "./cestinone/DetailPanel";
import { ChipGroup, ChannelDropdown } from "./cestinone/Toolbar";
import { EmptyPane } from "./cestinone/AgentBadge";
import { useCestinonePageState } from "./cestinone/useCestinonePageState";

export function CestinonePage(): React.ReactElement {
  const s = useCestinonePageState();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageTitleHeader icon={Trash2} title="Cestinone" subtitle="conferma, modifica o rinvia" />
      <div className="px-4 py-2 flex flex-wrap items-center gap-3 border-b bg-muted/20">
        <ChipGroup
          value={s.status}
          onChange={(v) => s.setStatus(v as "pending" | "queued")}
          options={[
            { value: "pending", label: `Da approvare (${s.counts.byStatus.pending})` },
            { value: "queued",  label: `In coda (${s.inCodaTotal})` },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <ChannelDropdown value={s.channel} onChange={s.setChannel} counts={s.counts} />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={s.search}
              onChange={(e) => s.setSearch(e.target.value)}
              placeholder="Cerca soggetto, destinatario..."
              className="h-8 pl-7 w-64 text-xs"
            />
          </div>
        </div>
      </div>

      {s.bulkIds.size > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 border-b bg-primary/5 text-xs">
          <Checkbox
            checked={s.bulkIds.size === s.items.length && s.items.length > 0}
            onCheckedChange={s.toggleBulkAll}
            aria-label="Seleziona tutti"
          />
          <span className="font-medium">{s.bulkIds.size} selezionati</span>
          <span className="text-muted-foreground hidden sm:inline">su {s.items.length}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => s.handleBulkSnooze(60)}>
              <Clock className="h-3 w-3" /> Rinvia 1h
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => s.handleBulkSnooze(60 * 24)}>
              <Clock className="h-3 w-3" /> Rinvia 24h
            </Button>
            <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs" onClick={s.handleBulkCancel}>
              <Trash2 className="h-3 w-3" /> Annulla {s.bulkIds.size}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={s.clearBulk}>Deseleziona</Button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(340px,1fr)_minmax(560px,2fr)] overflow-hidden">
        <div className="border-r overflow-y-auto p-2 space-y-2 bg-background">
          {s.items.length > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
              <Checkbox
                checked={s.items.length > 0 && s.bulkIds.size === s.items.length}
                onCheckedChange={s.toggleBulkAll}
                aria-label="Seleziona tutti i visibili"
              />
              <span>Seleziona tutti i {s.items.length} visibili</span>
            </div>
          )}
          {s.isLoading ? (
            <div className="text-sm text-muted-foreground p-6 text-center">Carico...</div>
          ) : s.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground py-16 px-4 text-center">
              <CheckCircle2 className="h-10 w-10 mb-2 text-success/60" />
              <div className="text-sm">Cestinone vuoto.</div>
            </div>
          ) : (
            s.items.map((item) => (
              <ListRow
                key={item.id}
                item={item}
                selected={item.id === s.selected?.id}
                onSelect={() => s.setSelectedId(item.id)}
                departingSoon={s.nextDepartingIds.has(item.id)}
                checked={s.bulkIds.has(item.id)}
                onToggleCheck={() => s.toggleBulk(item.id)}
              />
            ))
          )}
        </div>

        <div className="overflow-hidden bg-background flex flex-col">
          {s.selected ? (
            <DetailPanel
              item={s.selected}
              onConfirm={() => s.handleConfirm(s.selected!)}
              onEdit={() => s.handleEdit(s.selected!)}
              onOpenOrigin={() => s.handleOpenOrigin(s.selected!)}
              onOpenPartner={() => s.handleOpenPartner(s.selected!)}
              onRunSherlock={() => s.handleRunSherlock(s.selected!)}
              onSnooze={(m) => s.handleSnooze(s.selected!, m)}
              onCancel={() => s.handleCancel(s.selected!)}
              canSnooze={s.selected.source === "email_campaign_queue" || s.selected.source === "campaign_jobs"}
            />
          ) : (
            <EmptyPane label="Seleziona una card per vedere il dettaglio." />
          )}
        </div>
      </div>
    </div>
  );
}

export default CestinonePage;
