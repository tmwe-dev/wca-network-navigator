/**
 * ManualGroupingTab — Fase 1 Email Intelligence.
 *
 * Layout asimmetrico card-centrico:
 *  - Header compatto (refresh + nuovo gruppo)
 *  - SortBar (toggle + counter)
 *  - Colonna SX (35%, full-height): SenderEmailPreviewPanel
 *  - Colonna DX (65%):
 *      • Search mittente
 *      • Carosello SenderCard (con tutte le azioni dentro)
 *      • GroupGridPanel
 *
 * Auto-pop-up regole dopo drop su gruppo.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Loader2, ArrowUpDown, RefreshCw, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { SenderCard } from "./management/SenderCard";
import { GroupDropZone } from "./management/GroupDropZone";
import { CreateCategoryDialog } from "./management/CreateCategoryDialog";
import { SenderEmailPreviewPanel } from "./management/SenderEmailPreviewPanel";
import { ExportSendersDialog } from "./management/ExportSendersDialog";
import { RulesConfigurationDialog } from "./management/RulesConfigurationDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SenderAnalysis, EmailSenderGroup } from "@/types/email-management";
import { supabase } from "@/integrations/supabase/client";
import { bulkUpdateAutoAction, bulkSetBlocked } from "@/data/emailAddressRules";
import { cn } from "@/lib/utils";

import { useGroupingData } from "./manual-grouping/useGroupingData";
import { useFilterAndSort } from "./manual-grouping/useFilterAndSort";
import { useDragAndDrop } from "./manual-grouping/useDragAndDrop";
import { useGroupAssignment } from "./manual-grouping/useGroupAssignment";
import { useSelectionState } from "./manual-grouping/useSelectionState";

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componenti locali
// ──────────────────────────────────────────────────────────────────────────────

type LetterRange = "all" | "A-D" | "E-L" | "M-P" | "Q-Z";
const LETTER_RANGES: { value: LetterRange; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "A-D", label: "A-D" },
  { value: "E-L", label: "E-L" },
  { value: "M-P", label: "M-P" },
  { value: "Q-Z", label: "Q-Z" },
];

function inLetterRange(name: string, range: LetterRange): boolean {
  if (range === "all") return true;
  const first = name.charAt(0).toUpperCase();
  if (!/[A-Z]/.test(first)) return false;
  const [a, b] = range.split("-");
  return first >= a && first <= b;
}

/**
 * CompactToolbar — riga unica:
 *   [toggle preview] [↻ refresh] [+ Nuovo gruppo] ········ [counter mittenti]
 * Filtri (search/volume/sort/nascondi classificati) sono nella sidebar globale.
 */
function CompactToolbar({
  showPreview, onTogglePreview,
  onRefresh, isRefreshing,
  onCreateGroup,
  visibleCount, totalCount, classifiedCount, selectedCount,
}: {
  showPreview: boolean;
  onTogglePreview: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreateGroup: () => void;
  visibleCount: number;
  totalCount: number;
  classifiedCount: number;
  selectedCount: number;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={onTogglePreview}
              aria-label={showPreview ? "Nascondi anteprima" : "Mostra anteprima"}
            >
              {showPreview
                ? <PanelLeftClose className="h-4 w-4" />
                : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{showPreview ? "Nascondi anteprima email" : "Mostra anteprima email"}</TooltipContent>
        </Tooltip>

        {onRefresh && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label="Aggiorna mittenti"
                className="h-8 w-8 flex-shrink-0"
              >
                {isRefreshing
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <RefreshCw className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Aggiorna mittenti</TooltipContent>
          </Tooltip>
        )}

        <Button variant="outline" size="sm" onClick={onCreateGroup} className="h-8 flex-shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Nuovo gruppo
        </Button>

        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          <span className="font-semibold text-foreground">{visibleCount}</span>
          <span> / {totalCount} mittenti</span>
          <span className="mx-1.5 opacity-50">·</span>
          {classifiedCount} classificati
          {selectedCount > 0 && (
            <>
              <span className="mx-1.5 opacity-50">·</span>
              <span className="text-primary font-semibold">{selectedCount} selezionati</span>
            </>
          )}
        </span>
      </div>
    </TooltipProvider>
  );
}

function GroupGridPanel(props: {
  groups: EmailSenderGroup[];
  visibleGroups: EmailSenderGroup[];
  groupSortOption: "alpha" | "count";
  onGroupSortChange: (s: "alpha" | "count") => void;
  letterRange: LetterRange;
  onLetterRangeChange: (r: LetterRange) => void;
  hoveredGroupId: string | null;
  highlightedGroupName: string | null;
  assignedByGroup: Map<string, Array<{ id: string; email_address: string; display_name: string | null; company_name: string | null; domain: string | null }>>;
  reloadAssignedRules: () => void;
  loadData: () => void;
  selectedCount: number;
  onBulkAssign: (group: { id: string; nome_gruppo: string }) => void;
}) {
  const { groups, visibleGroups, groupSortOption, onGroupSortChange,
    letterRange, onLetterRangeChange, hoveredGroupId, highlightedGroupName,
    assignedByGroup, reloadAssignedRules, loadData, selectedCount, onBulkAssign } = props;
  return (
    <div className="flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Gruppi ({visibleGroups.length}{letterRange !== "all" ? `/${groups.length}` : ""})
        </span>
        <Select value={groupSortOption} onValueChange={(v) => onGroupSortChange(v as "alpha" | "count")}>
          <SelectTrigger className="w-[140px] h-8">
            <ArrowUpDown className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alpha">A → Z</SelectItem>
            <SelectItem value="count">Per contatti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/10 flex-shrink-0 overflow-x-auto">
        {LETTER_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onLetterRangeChange(r.value)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors",
              letterRange === r.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-3 grid gap-3 content-start grid-cols-1 md:grid-cols-2">
          {visibleGroups.map((group) => (
            <GroupDropZone
              key={group.id}
              group={group}
              onRefresh={loadData}
              isHovered={hoveredGroupId === group.id}
              isHighlighted={highlightedGroupName === group.nome_gruppo}
              rules={assignedByGroup.get(group.nome_gruppo) || []}
              onRulesChanged={reloadAssignedRules}
              selectedCount={selectedCount}
              onBulkAssign={onBulkAssign}
            />
          ))}
          {groups.length === 0 && (
            <p className="text-muted-foreground text-center w-full py-12">Nessun gruppo — creane uno</p>
          )}
          {groups.length > 0 && visibleGroups.length === 0 && (
            <p className="text-muted-foreground text-center w-full py-12 col-span-full">
              Nessun gruppo nel range selezionato
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Orchestrator
// ──────────────────────────────────────────────────────────────────────────────

export default function ManualGroupingTab() {
  const {
    senders, setSenders, classifiedSenders,
    groups, setGroups, isLoading, isPopulating,
    loadData, populateAddressRules,
    assignedByGroup, reloadAssignedRules,
  } = useGroupingData();

  const allSenders = useMemo<SenderAnalysis[]>(
    () => [...senders, ...classifiedSenders],
    [senders, classifiedSenders],
  );

  const {
    searchQuery,
    groupSortOption, setGroupSortOption,
    sortedSenders, sortedGroups,
  } = useFilterAndSort(allSenders, groups);

  const { activeDrag, setActiveDrag, hoveredGroupId, handleDragEnd } = useDragAndDrop();
  const { assignToGroup, bulkAssignGroup } = useGroupAssignment(groups, setSenders);
  const { selectedSenders, setSelectedSenders, toggleSenderSelection, getSelectedSenderObjects } =
    useSelectionState();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [previewSender, setPreviewSender] = useState<SenderAnalysis | null>(null);
  const [highlightedGroupName, setHighlightedGroupName] = useState<string | null>(null);
  const [exportSenderEmails, setExportSenderEmails] = useState<string[]>([]);
  const [showExportDialog, setShowExportDialog] = useState(false);
  /** Quando valorizzato, apre RulesConfigurationDialog per questi mittenti.
   *  Setato (a) dall'icona Regole sulla card (b) automaticamente dopo un drop su gruppo. */
  const [rulesDialogSenders, setRulesDialogSenders] = useState<string[] | null>(null);
  const [rulesDialogContext, setRulesDialogContext] = useState<string>("");
  const [letterRange, setLetterRange] = useState<LetterRange>("all");
  const [showPreview, setShowPreview] = useState(true);

  // Auto-focus primo sender quando lista cambia o nessuno selezionato.
  useEffect(() => {
    if (sortedSenders.length === 0) {
      if (previewSender !== null) setPreviewSender(null);
      return;
    }
    const stillVisible = previewSender && sortedSenders.some((s) => s.email === previewSender.email);
    if (!stillVisible) setPreviewSender(sortedSenders[0]);
  }, [sortedSenders, previewSender]);

  const visibleGroups = useMemo(
    () => sortedGroups.filter((g) => inLetterRange(g.nome_gruppo, letterRange)),
    [sortedGroups, letterRange],
  );

  const handleAiChipClick = useCallback((groupName: string) => {
    setHighlightedGroupName(groupName);
    setTimeout(() => {
      setHighlightedGroupName((curr) => (curr === groupName ? null : curr));
    }, 2500);
  }, []);

  const openRulesDialog = useCallback((emails: string[], contextLabel: string) => {
    setRulesDialogSenders(emails);
    setRulesDialogContext(contextLabel);
  }, []);

  const handleBulkAssignFromGroup = useCallback(
    async (group: { id: string; nome_gruppo: string }) => {
      const selObjs = getSelectedSenderObjects(allSenders);
      if (selObjs.length === 0) return;
      try {
        await bulkAssignGroup(selObjs, group.nome_gruppo, group.id);
        const emails = selObjs.map((s) => s.email);
        setSelectedSenders(new Set());
        await loadData();
        // Auto-apertura dialog regole per i mittenti appena associati.
        openRulesDialog(emails, `${emails.length} mittenti → ${group.nome_gruppo}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore associazione");
      }
    },
    [allSenders, getSelectedSenderObjects, bulkAssignGroup, setSelectedSenders, loadData, openRulesDialog],
  );

  const handleCreateCategory = async (data: {
    nome_gruppo: string;
    descrizione?: string;
    colore: string;
    icon: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("email_sender_groups")
      .insert({ ...data, user_id: user.id, sort_order: groups.length })
      .select()
      .single();
    if (error) { toast.error("Errore creazione"); throw error; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setGroups((prev) => [...prev, created as any]);
    toast.success(`${data.nome_gruppo} creato`);
  };

  const handleDragStartLocal = (sender: SenderAnalysis) => setActiveDrag(sender);

  const handleDragEndLocal = async (clientX: number, clientY: number) => {
    const targetGroupId = handleDragEnd(clientX, clientY);
    if (!targetGroupId || !activeDrag) return;
    const group = groups.find((g) => g.id === targetGroupId);
    if (!group) return;
    try {
      await assignToGroup(activeDrag, group.nome_gruppo, targetGroupId);
      // Auto-apertura del dialog regole per il mittente appena trascinato.
      openRulesDialog([activeDrag.email], `${activeDrag.companyName} → ${group.nome_gruppo}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore associazione");
    }
  };

  // ── Callback delle azioni rapide della card ─────────────────────────────────
  const withUser = async <T,>(fn: (uid: string) => Promise<T>): Promise<T | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessione scaduta"); return null; }
    return fn(user.id);
  };

  const onCardOpenRules = useCallback((s: SenderAnalysis) => {
    openRulesDialog([s.email], s.companyName);
  }, [openRulesDialog]);

  const onCardMarkRead = useCallback(async (s: SenderAnalysis) => {
    try {
      await withUser((uid) =>
        bulkUpdateAutoAction(uid, [s.email], "mark_read", { also_mark_read: true }),
      );
      toast.success(`${s.companyName}: segna come letto attivato`);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }, [loadData]);

  const onCardDelete = useCallback(async (s: SenderAnalysis) => {
    try {
      await withUser((uid) => bulkUpdateAutoAction(uid, [s.email], "delete"));
      toast.success(`${s.companyName}: regola di eliminazione impostata`);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }, [loadData]);

  const onCardBlock = useCallback(async (s: SenderAnalysis) => {
    try {
      await withUser((uid) => bulkSetBlocked(uid, [s.email], true));
      toast.success(`${s.companyName} bloccato (spam IMAP attivato)`);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }, [loadData]);

  const onCardExport = useCallback((s: SenderAnalysis) => {
    setExportSenderEmails([s.email]);
    setShowExportDialog(true);
  }, []);

  const onCardAnalyzeAI = useCallback((s: SenderAnalysis) => {
    toast.info(`Analisi AI di ${s.companyName} — in arrivo`);
  }, []);

  const onCardAcceptAiSuggestion = useCallback(
    async (s: SenderAnalysis, groupName: string) => {
      const target = groups.find((g) => g.nome_gruppo === groupName);
      if (!target) {
        toast.error(`Gruppo "${groupName}" non trovato`);
        return;
      }
      try {
        await assignToGroup(s, target.nome_gruppo, target.id);
        toast.success(`${s.companyName} associato a ${target.nome_gruppo}`);
        await loadData();
        openRulesDialog([s.email], `${s.companyName} → ${target.nome_gruppo}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore associazione");
      }
    },
    [groups, assignToGroup, loadData, openRulesDialog],
  );
  // ────────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Analisi mittenti…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <CompactToolbar
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((v) => !v)}
        onRefresh={populateAddressRules}
        isRefreshing={isPopulating}
        onCreateGroup={() => setShowCreateDialog(true)}
        visibleCount={sortedSenders.length}
        totalCount={allSenders.length}
        classifiedCount={classifiedSenders.length}
        selectedCount={selectedSenders.size}
      />

      {/* Layout 3 colonne resizable: [Preview opzionale] | [Sender cards verticali] | [Gruppi] */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 rounded-lg border"
      >
        {/* COL 1 — Anteprima mail (nascondibile) */}
        {showPreview && (
          <>
            <ResizablePanel defaultSize={32} minSize={20} maxSize={55}>
              <div className="h-full flex flex-col overflow-hidden">
                <SenderEmailPreviewPanel
                  senderEmail={previewSender?.email ?? null}
                  companyName={previewSender?.companyName ?? null}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
          </>
        )}

        {/* COL 2 — Sender cards in COLONNA verticale */}
        <ResizablePanel defaultSize={showPreview ? 30 : 40} minSize={20}>
          <div className="h-full flex flex-col overflow-hidden border-l-0">
            <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Mittenti ({sortedSenders.length})
              </span>
            </div>
            {sortedSenders.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">
                {searchQuery ? "Nessun risultato" : "Nessun mittente"}
              </p>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
                {sortedSenders.map((sender) => (
                  <SenderCard
                    key={sender.email}
                    sender={sender}
                    onDragStart={handleDragStartLocal}
                    onDragEnd={handleDragEndLocal}
                    isSelected={selectedSenders.has(sender.email)}
                    onToggleSelect={toggleSenderSelection}
                    onAiChipClick={handleAiChipClick}
                    isFocused={previewSender?.email === sender.email}
                    onFocusRequest={(s) => setPreviewSender(s)}
                    onOpenRules={onCardOpenRules}
                    onMarkRead={onCardMarkRead}
                    onDelete={onCardDelete}
                    onExport={onCardExport}
                    onBlock={onCardBlock}
                    onAnalyzeAI={onCardAnalyzeAI}
                    onAcceptAiSuggestion={onCardAcceptAiSuggestion}
                  />
                ))}
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* COL 3 — Griglia gruppi (resizable, supporta 2 colonne quando largo) */}
        <ResizablePanel defaultSize={showPreview ? 38 : 60} minSize={25}>
          <div className="h-full flex flex-col overflow-hidden p-2">
            <GroupGridPanel
              groups={groups}
              visibleGroups={visibleGroups}
              groupSortOption={groupSortOption}
              onGroupSortChange={setGroupSortOption}
              letterRange={letterRange}
              onLetterRangeChange={setLetterRange}
              hoveredGroupId={hoveredGroupId}
              highlightedGroupName={highlightedGroupName}
              assignedByGroup={assignedByGroup}
              reloadAssignedRules={reloadAssignedRules}
              loadData={loadData}
              selectedCount={selectedSenders.size}
              onBulkAssign={handleBulkAssignFromGroup}
            />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <CreateCategoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateCategory}
        existingNames={groups.map((g) => g.nome_gruppo)}
      />

      <ExportSendersDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        senderEmails={exportSenderEmails}
      />

      <RulesConfigurationDialog
        open={rulesDialogSenders !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRulesDialogSenders(null);
            setRulesDialogContext("");
          }
        }}
        senderEmails={rulesDialogSenders ?? []}
        contextLabel={rulesDialogContext}
        onSaved={() => loadData()}
      />
    </div>
  );
}
