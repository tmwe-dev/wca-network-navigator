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
import { Loader2, ArrowUpDown, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, RefreshCw, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { toast } from "sonner";
import { SenderCard } from "./management/SenderCard";
import { GroupDropZone } from "./management/GroupDropZone";
import { CreateCategoryDialog } from "./management/CreateCategoryDialog";
import { SenderEmailPreviewPanel } from "./management/SenderEmailPreviewPanel";
import { ExportSendersDialog } from "./management/ExportSendersDialog";
import { SenderActionsDialog } from "./management/SenderActionsDialog";
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

// CompactToolbar rimosso: toggle preview spostato accanto a "Mittenti",
// refresh + nuovo gruppo spostati nell'header del pannello "Gruppi".

type GroupSort = "alpha-asc" | "alpha-desc" | "count-desc" | "count-asc";

const GROUP_SORT_CYCLE: Record<GroupSort, GroupSort> = {
  "alpha-asc": "alpha-desc",
  "alpha-desc": "count-desc",
  "count-desc": "count-asc",
  "count-asc": "alpha-asc",
};

const GROUP_SORT_META: Record<GroupSort, { label: string; Icon: typeof ArrowUpDown }> = {
  "alpha-asc":  { label: "A → Z",        Icon: ArrowDownAZ },
  "alpha-desc": { label: "Z → A",        Icon: ArrowUpAZ },
  "count-desc": { label: "Più contatti", Icon: ArrowDown01 },
  "count-asc":  { label: "Meno contatti", Icon: ArrowUp01 },
};

function GroupGridPanel(props: {
  groups: EmailSenderGroup[];
  visibleGroups: EmailSenderGroup[];
  groupSortOption: GroupSort;
  onGroupSortChange: (s: GroupSort) => void;
  letterRange: LetterRange;
  onLetterRangeChange: (r: LetterRange) => void;
  hoveredGroupId: string | null;
  highlightedGroupName: string | null;
  assignedByGroup: Map<string, Array<{ id: string; email_address: string; display_name: string | null; company_name: string | null; domain: string | null }>>;
  reloadAssignedRules: () => void;
  loadData: () => void;
  selectedCount: number;
  onBulkAssign: (group: { id: string; nome_gruppo: string }) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreateGroup: () => void;
  onPartnerClick: (sender: SenderAnalysis) => void;
}) {
  const { groups, visibleGroups, groupSortOption, onGroupSortChange,
    letterRange, onLetterRangeChange, hoveredGroupId, highlightedGroupName,
    assignedByGroup, reloadAssignedRules, loadData, selectedCount, onBulkAssign,
    onRefresh, isRefreshing, onCreateGroup, onPartnerClick } = props;
  const sortMeta = GROUP_SORT_META[groupSortOption];
  const SortIcon = sortMeta.Icon;
  return (
    <div className="flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Gruppi ({visibleGroups.length}{letterRange !== "all" ? `/${groups.length}` : ""})
        </span>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onGroupSortChange(GROUP_SORT_CYCLE[groupSortOption])}
                  aria-label="Cambia ordinamento gruppi"
                >
                  <SortIcon className="h-3.5 w-3.5 mr-1.5" />
                  {sortMeta.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Click per ciclare A→Z, Z→A, più/meno contatti</TooltipContent>
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
                    className="h-8 w-8"
                  >
                    {isRefreshing
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aggiorna mittenti</TooltipContent>
              </Tooltip>
            )}
            <Button variant="outline" size="sm" onClick={onCreateGroup} className="h-8">
              <Plus className="h-4 w-4 mr-1" />
              Nuovo gruppo
            </Button>
          </div>
        </TooltipProvider>
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
        {/* Una card per riga: layout più leggibile, niente confusione tra
         *  due colonne quando si trascinano mittenti. */}
        <div className="p-3 grid gap-3 content-start grid-cols-1">
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
              onPartnerClick={onPartnerClick}
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
  /** Quando valorizzato, apre SenderActionsDialog per questo mittente.
   *  Setato (a) dall'icona Azioni sulla card (b) automaticamente dopo un drop su gruppo. */
  const [actionsDialogSender, setActionsDialogSender] = useState<SenderAnalysis | null>(null);
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

  const openActionsDialog = useCallback((sender: SenderAnalysis) => {
    setActionsDialogSender(sender);
  }, []);

  const handleBulkAssignFromGroup = useCallback(
    async (group: { id: string; nome_gruppo: string }) => {
      const selObjs = getSelectedSenderObjects(allSenders);
      if (selObjs.length === 0) return;
      try {
        await bulkAssignGroup(selObjs, group.nome_gruppo, group.id);
        setSelectedSenders(new Set());
        await loadData();
        // Skippabile: mostra toast con CTA per configurare azioni se serve.
        toast.success(`${selObjs.length} mittenti → ${group.nome_gruppo}`, {
          action: { label: "Configura azioni", onClick: () => openActionsDialog(selObjs[0]) },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore associazione");
      }
    },
    [allSenders, getSelectedSenderObjects, bulkAssignGroup, setSelectedSenders, loadData, openActionsDialog],
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
    const dragged = activeDrag;
    try {
      await assignToGroup(dragged, group.nome_gruppo, targetGroupId);
      // Skippabile: niente popup forzata, solo toast con CTA.
      toast.success(`${dragged.companyName} → ${group.nome_gruppo}`, {
        action: { label: "Configura azioni", onClick: () => openActionsDialog(dragged) },
      });
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
    openActionsDialog(s);
  }, [openActionsDialog]);

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
        await loadData();
        toast.success(`${s.companyName} → ${target.nome_gruppo}`, {
          action: { label: "Configura azioni", onClick: () => openActionsDialog(s) },
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore associazione");
      }
    },
    [groups, assignToGroup, loadData, openActionsDialog],
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
              <div className="flex items-center gap-2 min-w-0">
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => setShowPreview((v) => !v)}
                        aria-label={showPreview ? "Nascondi anteprima" : "Mostra anteprima"}
                      >
                        {showPreview
                          ? <PanelLeftClose className="h-3.5 w-3.5" />
                          : <PanelLeftOpen className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showPreview ? "Nascondi anteprima email" : "Mostra anteprima email"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="text-xs font-medium text-muted-foreground truncate">
                  Mittenti ({sortedSenders.length})
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                <span className="font-semibold text-foreground">{sortedSenders.length}</span>
                <span> / {allSenders.length}</span>
                <span className="mx-1 opacity-50">·</span>
                {classifiedSenders.length} classificati
                {selectedSenders.size > 0 && (
                  <>
                    <span className="mx-1 opacity-50">·</span>
                    <span className="text-primary font-semibold">{selectedSenders.size} sel.</span>
                  </>
                )}
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
              onRefresh={populateAddressRules}
              isRefreshing={isPopulating}
              onCreateGroup={() => setShowCreateDialog(true)}
              onPartnerClick={openActionsDialog}
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

      <SenderActionsDialog
        sender={actionsDialogSender}
        open={actionsDialogSender !== null}
        onOpenChange={(open) => {
          if (!open) setActionsDialogSender(null);
        }}
        onActionDone={() => loadData()}
      />
    </div>
  );
}
