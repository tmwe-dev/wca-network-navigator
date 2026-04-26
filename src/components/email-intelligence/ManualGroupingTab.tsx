/**
 * ManualGroupingTab — Fase 1 della pipeline Email Intelligence.
 *
 * Orchestratore "thin": gestisce solo lo stato globale (selezione, highlight,
 * preview sender, dialog) e compone i sotto-componenti. La logica dati è in
 * useGroupingData, useFilterAndSort, useDragAndDrop, useGroupAssignment.
 */
import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Loader2, ArrowUpDown, Filter, Mail } from "lucide-react";
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

// Import refactored hooks
import { useGroupingData } from "./manual-grouping/useGroupingData";
import { useFilterAndSort } from "./manual-grouping/useFilterAndSort";
import { useDragAndDrop } from "./manual-grouping/useDragAndDrop";
import { useGroupAssignment } from "./manual-grouping/useGroupAssignment";
import { useSelectionState } from "./manual-grouping/useSelectionState";

export default function ManualGroupingTab() {
  // Data management
  const {
    senders, setSenders, classifiedSenders,
    groups, setGroups, isLoading, isPopulating,
    loadData, populateAddressRules,
    assignedByGroup, reloadAssignedRules,
  } = useGroupingData();

  // Combined list (uncategorized + classified) per il rail orizzontale.
  // I classified vengono in coda con opacità ridotta tramite SenderCard.
  const allSenders = useMemo<SenderAnalysis[]>(
    () => [...senders, ...classifiedSenders],
    [senders, classifiedSenders],
  );

  // Filtering and sorting
  const {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    volumeFilter,
    setVolumeFilter,
    groupSortOption,
    setGroupSortOption,
    activeLetterFilter,
    setActiveLetterFilter,
    sortedSenders,
    sortedGroups,
    availableLetters,
    ALPHABET,
    VOLUME_FILTERS,
    totalEmailCount,
  } = useFilterAndSort(allSenders, groups);

  // Drag and drop
  const { activeDrag, setActiveDrag, hoveredGroupId, setHoveredGroupId, handleDragEnd } = useDragAndDrop();

  // Group assignment
  const { assignToGroup, bulkAssignGroup } = useGroupAssignment(groups, setSenders);

  // Selection state
  const { selectedSenders, setSelectedSenders, toggleSenderSelection, selectAll, getSelectedSenderObjects } =
    useSelectionState();

  // Local UI state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [emailPreviewSender, setEmailPreviewSender] = useState<SenderAnalysis | null>(null);
  const [previewSender, setPreviewSender] = useState<SenderAnalysis | null>(null);
  const [highlightedGroupName, setHighlightedGroupName] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Header counts: pendenti (da smistare) + già classificati
  const countLabel = useMemo(
    () => `${senders.length} da smistare · ${classifiedSenders.length} classificati · ${totalEmailCount.toLocaleString("it-IT")} email`,
    [senders.length, classifiedSenders.length, totalEmailCount],
  );

  /** Click sul chip AI in una sender card → glow del gruppo per 2.5s */
  const handleAiChipClick = useCallback((groupName: string) => {
    setHighlightedGroupName(groupName);
    setTimeout(() => {
      setHighlightedGroupName((curr) => (curr === groupName ? null : curr));
    }, 2500);
  }, []);

  /** Bulk associate da pulsante "+ Associa N" sulla card del gruppo */
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

  const handleSelectAll = () => {
    selectAll(sortedSenders);
  };

  // Sender focus per il preview panel: priorità all'ultimo selezionato, poi click esplicito.
  const focusSender = previewSender ??
    (selectedSenders.size > 0
      ? allSenders.find((s) => selectedSenders.has(s.email)) ?? null
      : null);

  const selectedEmails = Array.from(selectedSenders);
  const selectionContextLabel = selectedSenders.size === 1
    ? (focusSender?.companyName || Array.from(selectedSenders)[0])
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
      {/* Header con titolo + ricerca + nuovo gruppo */}
      <EmailIntelligenceHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCreateGroup={() => setShowCreateDialog(true)}
        countLabel={countLabel}
      />

      {/* Action bar contestuale: visibile SOLO se ≥1 sender selezionato */}
      {selectedSenders.size > 0 && (
        <SenderActionBar
          selectedSenders={selectedEmails}
          contextLabel={selectionContextLabel}
          onOpenRules={() => {
            // Per ora apre il dialog email del primo sender (per gestione manuale).
            // Estensione futura: dialog batch dedicato per regole IMAP comuni.
            const first = allSenders.find((s) => selectedSenders.has(s.email));
            if (first) setEmailPreviewSender(first);
            else toast.info("Apri 'Più opzioni' sulla singola card per regole granulari");
          }}
          onOpenExport={() => setShowExportDialog(true)}
          onActionComplete={() => {
            setSelectedSenders(new Set());
            loadData();
          }}
        />
      )}

      {/* Sort/filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {sortedSenders.length} visibili
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <Mail className="h-3 w-3" />
          {totalEmailCount.toLocaleString("it-IT")} email
        </Badge>
        <Select value={volumeFilter} onValueChange={setVolumeFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOLUME_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as any)}>
          <SelectTrigger className="w-[150px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count-desc">Più email</SelectItem>
            <SelectItem value="count-asc">Meno email</SelectItem>
            <SelectItem value="name-asc">A → Z</SelectItem>
            <SelectItem value="name-desc">Z → A</SelectItem>
            <SelectItem value="ai_group">AI smart</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 px-2 h-9 border rounded-md text-xs">
          <Checkbox
            id="selall"
            checked={selectedSenders.size === sortedSenders.length && sortedSenders.length > 0}
            onCheckedChange={handleSelectAll}
            className="h-3.5 w-3.5"
          />
          <label htmlFor="selall" className="cursor-pointer select-none">
            Tutti{selectedSenders.size > 0 && ` (${selectedSenders.size})`}
          </label>
        </div>
        <Button variant="outline" size="sm" onClick={populateAddressRules} disabled={isPopulating}>
          {isPopulating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Aggiorna conteggi
        </Button>
      </div>

      {/* Sender cards — RAIL ORIZZONTALE */}
      <div className="border rounded-lg flex-shrink-0">
        <div className="px-3 py-1.5 border-b bg-muted/30 flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground">
            Mittenti ({sortedSenders.length})
            {selectedSenders.size > 0 && (
              <span className="ml-2 text-primary font-semibold">{selectedSenders.size} sel.</span>
            )}
          </span>
          <span className="text-[10px] text-muted-foreground italic">
            Trascina su un gruppo · click sul chip AI per evidenziare
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
                  className="w-[260px] flex-shrink-0"
                  onClick={() => setPreviewSender(sender)}
                  role="button"
                  tabIndex={-1}
                >
                  <SenderCard
                    sender={sender}
                    onDragStart={handleDragStartLocal}
                    onDragEnd={handleDragEndLocal}
                    onViewEmails={(s) => setEmailPreviewSender(s)}
                    groups={groups}
                    onAssignGroup={assignToGroup}
                    isSelected={selectedSenders.has(sender.email)}
                    onToggleSelect={toggleSenderSelection}
                    onAiChipClick={handleAiChipClick}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Area inferiore: split 35% preview + 65% gruppi */}
      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">
        {/* Preview panel sinistra */}
        <div className="w-[35%] min-w-[260px] flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
          <SenderEmailPreviewPanel
            senderEmail={focusSender?.email ?? null}
            companyName={focusSender?.companyName ?? null}
          />
        </div>

        {/* Griglia gruppi destra */}
        <div className="flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Gruppi ({sortedGroups.length}
              {activeLetterFilter ? `/${groups.length}` : ""})
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

          {/* Alphabet filter bar */}
          <div className="flex items-center gap-0 px-2 py-1.5 border-b bg-muted/10 flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveLetterFilter(null)}
              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                activeLetterFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              ALL
            </button>
            {ALPHABET.map((letter) => {
              const hasGroups = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  onClick={() => hasGroups && setActiveLetterFilter(letter === activeLetterFilter ? null : letter)}
                  disabled={!hasGroups}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-semibold rounded transition-colors ${
                    activeLetterFilter === letter
                      ? "bg-primary text-primary-foreground"
                      : hasGroups
                        ? "text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                        : "text-muted-foreground/30 cursor-default"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Griglia 2 colonne responsive */}
            <div className="p-3 grid gap-3 content-start grid-cols-1 md:grid-cols-2">
              {sortedGroups.map((group) => (
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
            </div>
          </div>
        </div>
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
