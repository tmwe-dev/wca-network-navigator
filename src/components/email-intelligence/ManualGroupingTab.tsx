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
import { Loader2, ArrowDownAZ, ArrowUpAZ, ArrowDown01, ArrowUp01, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CreateCategoryDialog } from "./management/CreateCategoryDialog";
import { SenderEmailPreviewPanel } from "./management/SenderEmailPreviewPanel";
import { ExportSendersDialog } from "./management/ExportSendersDialog";
import { SenderActionsDialog } from "./management/SenderActionsDialog";
import type { SenderAnalysis } from "@/types/email-management";
import { supabase } from "@/integrations/supabase/client";
import { bulkUpdateAutoAction, bulkSetBlocked } from "@/data/emailAddressRules";
import { invokeAi } from "@/lib/ai/invokeAi";

import { useGroupingData } from "./manual-grouping/useGroupingData";
import { useFilterAndSort } from "./manual-grouping/useFilterAndSort";
import { useDragAndDrop } from "./manual-grouping/useDragAndDrop";
import { useGroupAssignment } from "./manual-grouping/useGroupAssignment";
import { useSelectionState } from "./manual-grouping/useSelectionState";
import { ActiveFiltersBar } from "./manual-grouping/ActiveFiltersBar";
import { GroupGridPanel } from "./manual-grouping/GroupGridPanel";
import { VirtualizedSenderList } from "./manual-grouping/VirtualizedSenderList";
import { inLetterRange, type LetterRange } from "./manual-grouping/letterRange";

interface SuggestEmailGroupsResponse {
  processed?: number;
  suggestions?: Array<{ email: string; suggested_group: string; confidence: number; reasoning?: string }>;
  error?: string;
}

export default function ManualGroupingTab() {
  const {
    senders, setSenders, classifiedSenders, setClassifiedSenders,
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
    sortOption, setSortOption,
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
    const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
    if (!user) return;
    const { data: created, error } = await supabase
      .from("email_sender_groups")
      .insert({ ...data, user_id: user.id, sort_order: groups.length })
      .select()
      .single();
    if (error) { toast.error("Errore creazione"); throw error; }
    setGroups((prev) => [...prev, created as unknown as (typeof prev)[number]]);
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
    const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
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

  const onCardAnalyzeAI = useCallback(async (s: SenderAnalysis) => {
    const toastId = toast.loading(`Analisi AI di ${s.companyName}…`);
    try {
      const data = await invokeAi<SuggestEmailGroupsResponse>("suggest-email-groups", {
        scope: "email",
        context: {
          source: "ManualGroupingTab.onCardAnalyzeAI",
          route: "/v2/email-intelligence",
          mode: "single-address-suggestion",
          extra: { email: s.email, domain: s.domain },
        },
        body: { emails: [s.email], min_email_count: 0, batch_size: 1 },
      });

      const suggestion = data.suggestions?.find((item) => item.email.toLowerCase() === s.email.toLowerCase());

      // Patch in-place senza ricaricare l'intera lista (evita scroll-jump
      // e re-mount delle ~1200 card). Aggiorniamo SOLO il sender toccato.
      if (suggestion?.suggested_group && suggestion.suggested_group !== "uncategorized") {
        const patch = (arr: SenderAnalysis[]) =>
          arr.map((x) =>
            x.email.toLowerCase() === s.email.toLowerCase()
              ? {
                  ...x,
                  aiSuggestion: {
                    group_name: suggestion.suggested_group,
                    confidence: suggestion.confidence ?? 0,
                    accepted: null,
                  },
                }
              : x,
          );
        setSenders(patch);
        setClassifiedSenders(patch);
      }

      if (suggestion?.suggested_group && suggestion.suggested_group !== "uncategorized") {
        toast.success(`Suggerito: ${suggestion.suggested_group}`, { id: toastId });
        handleAiChipClick(suggestion.suggested_group);
        return;
      }

      toast.info("AI completata: nessun gruppo affidabile trovato", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore analisi AI", { id: toastId });
    }
  }, [handleAiChipClick, setSenders, setClassifiedSenders]);

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

  /**
   * Accetta in batch TUTTI i suggerimenti AI presenti sulle card non
   * ancora classificate. Ogni assegnazione resta atomica e mirata
   * (per email + ruleId), nessuna scrittura globale.
   */
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const handleAcceptAllAiSuggestions = useCallback(async () => {
    const candidates = senders.filter(
      (s) =>
        s.aiSuggestion?.group_name &&
        s.aiSuggestion.group_name !== "uncategorized" &&
        groups.some((g) => g.nome_gruppo === s.aiSuggestion!.group_name),
    );
    if (candidates.length === 0) {
      toast.info("Nessun suggerimento AI da accettare");
      return;
    }
    const confirmed = window.confirm(
      `Accettare ${candidates.length} suggerimenti AI? Ogni mittente verrà associato al gruppo proposto.`,
    );
    if (!confirmed) return;

    setIsAcceptingAll(true);
    const toastId = toast.loading(`Accettazione 0/${candidates.length}…`);
    let ok = 0;
    let ko = 0;
    try {
      for (let i = 0; i < candidates.length; i++) {
        const s = candidates[i];
        const target = groups.find((g) => g.nome_gruppo === s.aiSuggestion!.group_name);
        if (!target) { ko++; continue; }
        try {
          await assignToGroup(s, target.nome_gruppo, target.id);
          ok++;
        } catch {
          ko++;
        }
        toast.loading(`Accettazione ${i + 1}/${candidates.length}…`, { id: toastId });
      }
      await loadData();
      toast.success(`${ok} accettati${ko > 0 ? `, ${ko} errori` : ""}`, { id: toastId });
    } finally {
      setIsAcceptingAll(false);
    }
  }, [senders, groups, assignToGroup, loadData]);

  const acceptableCount = useMemo(
    () =>
      senders.filter(
        (s) =>
          s.aiSuggestion?.group_name &&
          s.aiSuggestion.group_name !== "uncategorized" &&
          groups.some((g) => g.nome_gruppo === s.aiSuggestion!.group_name),
      ).length,
    [senders, groups],
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
      {/* Barra filtri attivi: visibile fuori dal drawer, chip rimovibili.
       *  I filtri sono persistiti nel GlobalFiltersContext e sopravvivono ai cambi tab. */}
      <ActiveFiltersBar />

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
            <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
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
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 ml-1"
                        onClick={() => {
                          const cycle: Record<string, "name-asc" | "name-desc" | "count-desc" | "count-asc"> = {
                            "name-asc": "name-desc",
                            "name-desc": "count-desc",
                            "count-desc": "count-asc",
                            "count-asc": "name-asc",
                          };
                          setSortOption(cycle[sortOption] ?? "name-asc");
                        }}
                        aria-label="Cambia ordinamento mittenti"
                      >
                        {sortOption === "name-asc" ? (
                          <><ArrowDownAZ className="h-3.5 w-3.5 mr-1" />A → Z</>
                        ) : sortOption === "name-desc" ? (
                          <><ArrowUpAZ className="h-3.5 w-3.5 mr-1" />Z → A</>
                        ) : sortOption === "count-desc" ? (
                          <><ArrowDown01 className="h-3.5 w-3.5 mr-1" />Più email</>
                        ) : (
                          <><ArrowUp01 className="h-3.5 w-3.5 mr-1" />Meno email</>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Click per ciclare A→Z, Z→A, più/meno email</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-auto">
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
              {acceptableCount > 0 && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-2 ml-2 gap-1"
                        onClick={handleAcceptAllAiSuggestions}
                        disabled={isAcceptingAll}
                      >
                        {isAcceptingAll
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Sparkles className="h-3.5 w-3.5" />}
                        <span className="text-xs font-medium">
                          Accetta tutti ({acceptableCount})
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Accetta in blocco i suggerimenti AI generati sulle card
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {sortedSenders.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">
                {searchQuery ? "Nessun risultato" : "Nessun mittente"}
              </p>
            ) : (
              <VirtualizedSenderList
                senders={sortedSenders}
                groups={groups}
                selectedEmails={selectedSenders}
                focusedEmail={previewSender?.email ?? null}
                onDragStart={handleDragStartLocal}
                onDragEnd={handleDragEndLocal}
                onToggleSelect={toggleSenderSelection}
                onAiChipClick={handleAiChipClick}
                onFocusRequest={setPreviewSender}
                onOpenRules={onCardOpenRules}
                onMarkRead={onCardMarkRead}
                onDelete={onCardDelete}
                onExport={onCardExport}
                onBlock={onCardBlock}
                onAnalyzeAI={onCardAnalyzeAI}
                onAcceptAiSuggestion={onCardAcceptAiSuggestion}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* COL 3 — Griglia gruppi (resizable, supporta 2 colonne quando largo) */}
        <ResizablePanel defaultSize={showPreview ? 38 : 60} minSize={25}>
          <div className="h-full min-h-0 flex flex-col overflow-hidden p-2">
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
