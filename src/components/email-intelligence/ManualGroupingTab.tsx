/**
 * ManualGroupingTab — Fase 1 Email Intelligence (refactored).
 *
 * Layout:
 *  • EmailIntelligenceHeader: search + counter + "Nuovo gruppo"
 *  • SenderActionBar (solo se selectedSenders.size > 0)
 *  • SortBar: ToggleGroup [A-Z | N. email | AI smart] + Multi-selezione + counter
 *  • Rail orizzontale di SenderCard compatte (200px) con auto-focus primo
 *  • Split inferiore: 35% SenderEmailPreviewPanel + 65% griglia gruppi
 *      con pill range alfabetico [Tutti | A-D | E-L | M-P | Q-Z]
 *  • Prompt AI bar in fondo (stub)
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Loader2, Sparkles, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { SenderCard } from "./management/SenderCard";
import { GroupDropZone } from "./management/GroupDropZone";
import { CreateCategoryDialog } from "./management/CreateCategoryDialog";
import { SenderEmailsDialog } from "./management/SenderEmailsDialog";
import { EmailIntelligenceHeader } from "./management/EmailIntelligenceHeader";
import { SenderActionBar } from "./management/SenderActionBar";
import { SenderEmailPreviewPanel } from "./management/SenderEmailPreviewPanel";
import { ExportSendersDialog } from "./management/ExportSendersDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SenderAnalysis } from "@/types/email-management";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { useGroupingData } from "./manual-grouping/useGroupingData";
import { useFilterAndSort } from "./manual-grouping/useFilterAndSort";
import { useDragAndDrop } from "./manual-grouping/useDragAndDrop";
import { useGroupAssignment } from "./manual-grouping/useGroupAssignment";
import { useSelectionState } from "./manual-grouping/useSelectionState";

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

export default function ManualGroupingTab() {
  // Data
  const {
    senders, setSenders, classifiedSenders,
    groups, setGroups, isLoading,
    isPopulating,
    loadData, populateAddressRules,
    assignedByGroup, reloadAssignedRules,
  } = useGroupingData();

  const allSenders = useMemo<SenderAnalysis[]>(
    () => [...senders, ...classifiedSenders],
    [senders, classifiedSenders],
  );

  // Filter & sort
  const {
    searchQuery, setSearchQuery,
    sortOption, setSortOption,
    groupSortOption, setGroupSortOption,
    sortedSenders,
    sortedGroups,
  } = useFilterAndSort(allSenders, groups);

  // Drag & drop, group assignment
  const { activeDrag, setActiveDrag, hoveredGroupId, handleDragEnd } = useDragAndDrop();
  const { assignToGroup, bulkAssignGroup } = useGroupAssignment(groups, setSenders);

  // Selection
  const { selectedSenders, setSelectedSenders, toggleSenderSelection, getSelectedSenderObjects } =
    useSelectionState();

  // Local UI state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [emailPreviewSender, setEmailPreviewSender] = useState<SenderAnalysis | null>(null);
  const [previewSender, setPreviewSender] = useState<SenderAnalysis | null>(null);
  const [highlightedGroupName, setHighlightedGroupName] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [letterRange, setLetterRange] = useState<LetterRange>("all");
  const [aiPromptDraft, setAiPromptDraft] = useState("");

  // Auto-focus primo sender quando lista cambia o nessuno selezionato.
  useEffect(() => {
    if (sortedSenders.length === 0) {
      if (previewSender !== null) setPreviewSender(null);
      return;
    }
    const stillVisible = previewSender && sortedSenders.some((s) => s.email === previewSender.email);
    if (!stillVisible) {
      setPreviewSender(sortedSenders[0]);
    }
  }, [sortedSenders, previewSender]);

  // Filtra gruppi per range alfabetico (lato consumer per non toccare hook).
  const visibleGroups = useMemo(
    () => sortedGroups.filter((g) => inLetterRange(g.nome_gruppo, letterRange)),
    [sortedGroups, letterRange],
  );

  const countLabel = useMemo(
    () => `${senders.length} da smistare · ${classifiedSenders.length} classificati`,
    [senders.length, classifiedSenders.length],
  );

  const handleAiChipClick = useCallback((groupName: string) => {
    setHighlightedGroupName(groupName);
    setTimeout(() => {
      setHighlightedGroupName((curr) => (curr === groupName ? null : curr));
    }, 2500);
  }, []);

  const handleBulkAssignFromGroup = useCallback(
    async (group: { id: string; nome_gruppo: string }) => {
      const selObjs = getSelectedSenderObjects(allSenders);
      if (selObjs.length === 0) return;
      try {
        await bulkAssignGroup(selObjs, group.nome_gruppo, group.id);
        setSelectedSenders(new Set());
        await loadData();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Errore associazione");
      }
    },
    [allSenders, getSelectedSenderObjects, bulkAssignGroup, setSelectedSenders, loadData],
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
    if (error) {
      toast.error("Errore creazione");
      throw error;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setGroups((prev) => [...prev, created as any]);
    toast.success(`${data.nome_gruppo} creato`);
  };

  const handleDragStartLocal = (sender: SenderAnalysis) => setActiveDrag(sender);

  const handleDragEndLocal = async (clientX: number, clientY: number) => {
    const targetGroupId = handleDragEnd(clientX, clientY);
    if (!targetGroupId || !activeDrag) return;
    const group = groups.find((g) => g.id === targetGroupId);
    if (group) {
      await assignToGroup(activeDrag, group.nome_gruppo, targetGroupId);
    }
  };

  // Click su una card del rail.
  const handleSenderCardClick = (sender: SenderAnalysis) => {
    setPreviewSender(sender);
    if (multiSelectMode) {
      toggleSenderSelection(sender.email);
    }
  };

  // Toggle multi-selezione: se la disattivo svuoto la selezione.
  const handleToggleMultiSelect = (checked: boolean) => {
    setMultiSelectMode(checked);
    if (!checked) setSelectedSenders(new Set());
  };

  const selectedEmails = Array.from(selectedSenders);
  const selectionContextLabel = selectedSenders.size === 1
    ? (allSenders.find((s) => selectedSenders.has(s.email))?.companyName || selectedEmails[0])
    : `${selectedSenders.size} mittenti selezionati`;

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
    <div className="flex flex-col h-full gap-3">
      {/* Header: search + counter + nuovo gruppo */}
      <EmailIntelligenceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateGroup={() => setShowCreateDialog(true)}
        onRefresh={populateAddressRules}
        isRefreshing={isPopulating}
      />

      {/* Action bar contestuale: visibile sempre quando c'è un sender in focus
          (singolo via preview, oppure ≥1 in multi-selezione). */}
      {(selectedSenders.size > 0 || previewSender) && (
        <SenderActionBar
          selectedSenders={
            selectedSenders.size > 0 ? selectedEmails : previewSender ? [previewSender.email] : []
          }
          contextLabel={
            selectedSenders.size > 1
              ? `${selectedSenders.size} mittenti selezionati`
              : selectedSenders.size === 1
                ? (allSenders.find((s) => selectedSenders.has(s.email))?.companyName || selectedEmails[0])
                : (previewSender?.companyName || previewSender?.email || "")
          }
          onOpenRules={() => {
            const first = selectedSenders.size > 0
              ? allSenders.find((s) => selectedSenders.has(s.email))
              : previewSender;
            if (first) setEmailPreviewSender(first);
            else toast.info("Seleziona un mittente per configurare le regole");
          }}
          onOpenExport={() => setShowExportDialog(true)}
          onActionComplete={() => {
            setSelectedSenders(new Set());
            loadData();
          }}
        />
      )}

      {/* SortBar: segmented + multi-select + counter */}
      <div className="flex items-center gap-3 flex-wrap">
        <ToggleGroup
          type="single"
          value={sortOption}
          onValueChange={(v) => {
            if (v) setSortOption(v as typeof sortOption);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="name-asc" className="text-xs h-8 px-2.5">A-Z</ToggleGroupItem>
          <ToggleGroupItem value="count-desc" className="text-xs h-8 px-2.5">N. email</ToggleGroupItem>
          <ToggleGroupItem value="ai_group" className="text-xs h-8 px-2.5 gap-1">
            <Sparkles className="h-3 w-3" />
            AI smart
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-1.5 px-2 h-8 border rounded-md text-xs">
          <Checkbox
            id="multiSel"
            checked={multiSelectMode}
            onCheckedChange={(v) => handleToggleMultiSelect(v === true)}
            className="h-3.5 w-3.5"
          />
          <label htmlFor="multiSel" className="cursor-pointer select-none">
            Multi-selezione{selectedSenders.size > 0 && ` (${selectedSenders.size})`}
          </label>
        </div>

        <span className="text-xs text-muted-foreground ml-auto">{countLabel}</span>
      </div>

      {/* Rail orizzontale di sender cards */}
      <div className="border rounded-lg flex-shrink-0">
        <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Mittenti ({sortedSenders.length})
          </span>
          <span className="text-[10px] text-muted-foreground italic">
            Trascina su un gruppo · click per anteprima · click chip AI per evidenziare
          </span>
        </div>
        {sortedSenders.length === 0 ? (
          <p className="text-center py-6 text-sm text-muted-foreground">
            {searchQuery ? "Nessun risultato" : "Nessun mittente"}
          </p>
        ) : (
          <div className="overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
            <div className="flex gap-2 p-2 min-w-min">
              {sortedSenders.map((sender) => (
                <div
                  key={sender.email}
                  className="w-[200px] flex-shrink-0"
                  onClick={() => handleSenderCardClick(sender)}
                  role="button"
                  tabIndex={-1}
                >
                  <SenderCard
                    sender={sender}
                    onDragStart={handleDragStartLocal}
                    onDragEnd={handleDragEndLocal}
                    onViewEmails={(s) => setEmailPreviewSender(s)}
                    isSelected={selectedSenders.has(sender.email)}
                    multiSelectMode={multiSelectMode}
                    onToggleSelect={toggleSenderSelection}
                    onAiChipClick={handleAiChipClick}
                    isFocused={previewSender?.email === sender.email}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Area inferiore: split 35/65 */}
      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">
        {/* Preview panel */}
        <div className="w-[35%] min-w-[260px] flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
          <SenderEmailPreviewPanel
            senderEmail={previewSender?.email ?? null}
            companyName={previewSender?.companyName ?? null}
          />
        </div>

        {/* Griglia gruppi */}
        <div className="flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Gruppi ({visibleGroups.length}
              {letterRange !== "all" ? `/${groups.length}` : ""})
            </span>
            <Select value={groupSortOption} onValueChange={(v) => setGroupSortOption(v as "alpha" | "count")}>
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

          {/* Pill range alfabetico */}
          <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/10 flex-shrink-0 overflow-x-auto">
            {LETTER_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setLetterRange(r.value)}
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
                  selectedCount={selectedSenders.size}
                  onBulkAssign={handleBulkAssignFromGroup}
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
      </div>

      {/* Prompt AI bar (stub) */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border rounded-md bg-card">
        <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
        <Input
          placeholder="Chiedi all'AI di analizzare un mittente…"
          className="flex-1 h-8 border-none focus-visible:ring-0 shadow-none px-0"
          value={aiPromptDraft}
          onChange={(e) => setAiPromptDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && aiPromptDraft.trim()) {
              toast.info("Funzionalità in arrivo");
              setAiPromptDraft("");
            }
          }}
        />
        <Button
          size="sm"
          disabled={!aiPromptDraft.trim()}
          onClick={() => {
            toast.info("Funzionalità in arrivo");
            setAiPromptDraft("");
          }}
        >
          Analizza
        </Button>
      </div>

      <CreateCategoryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateCategory}
        existingNames={groups.map((g) => g.nome_gruppo)}
      />

      <SenderEmailsDialog
        open={!!emailPreviewSender}
        onOpenChange={(open) => {
          if (!open) setEmailPreviewSender(null);
        }}
        emailAddress={emailPreviewSender?.email || ""}
        companyName={emailPreviewSender?.companyName || ""}
      />

      <ExportSendersDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        senderEmails={selectedEmails}
      />
    </div>
  );
}
