/**
 * ManualGroupingTab — Drag-and-drop sender classification (refactored).
 * Tab 1 of Email Intelligence flow. Now uses composable hooks.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Loader2, Plus, Search, ArrowUpDown, Filter, Mail } from "lucide-react";
import { toast } from "sonner";
import { SenderCard } from "./management/SenderCard";
import { GroupDropZone } from "./management/GroupDropZone";
import { CreateCategoryDialog } from "./management/CreateCategoryDialog";
import { SenderEmailsDialog } from "./management/SenderEmailsDialog";
import { MultiSelectBulkBar } from "./management/MultiSelectBulkBar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SenderAnalysis } from "@/types/email-management";

// Import refactored hooks
import { useGroupingData } from "./manual-grouping/useGroupingData";
import { useFilterAndSort } from "./manual-grouping/useFilterAndSort";
import { useDragAndDrop } from "./manual-grouping/useDragAndDrop";
import { useGroupAssignment } from "./manual-grouping/useGroupAssignment";
import { useSelectionState } from "./manual-grouping/useSelectionState";

export default function ManualGroupingTab() {
  // Data management
  const { senders, setSenders, groups, setGroups, isLoading, isPopulating, loadData, populateAddressRules, assignedByGroup, reloadAssignedRules } =
    useGroupingData();

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
  } = useFilterAndSort(senders, groups);

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

  const handleCreateCategory = async (data: {
    nome_gruppo: string;
    descrizione?: string;
    colore: string;
    icon: string;
  }) => {
    const { data: { user } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
    if (!user) return;

    const { data: created, error } = await (
      await import("@/integrations/supabase/client")
    ).supabase
      .from("email_sender_groups")
      .insert({ ...data, user_id: user.id, sort_order: groups.length })
      .select()
      .single();

    if (error) {
      toast.error("Errore creazione");
      throw error;
    }
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

  const handleBulkAssignLocal = async (
    selected: ReturnType<typeof getSelectedSenderObjects>,
    groupName: string,
    groupId: string,
  ) => {
    if (selected.length === 0) return;
    await bulkAssignGroup(selected, groupName, groupId);
    setSelectedSenders(new Set());
  };

  const handleSelectAll = () => {
    selectAll(sortedSenders);
  };

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
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {sortedSenders.length} da categorizzare su {senders.length} totali
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <Mail className="h-3 w-3" />
          {totalEmailCount.toLocaleString("it-IT")} email totali
        </Badge>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Cerca mittente…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
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
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as any)}>
          <SelectTrigger className="w-[140px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count-desc">Più email</SelectItem>
            <SelectItem value="count-asc">Meno email</SelectItem>
            <SelectItem value="name-asc">A → Z</SelectItem>
            <SelectItem value="name-desc">Z → A</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={populateAddressRules} disabled={isPopulating}>
          {isPopulating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Popola Address
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo gruppo
        </Button>
      </div>

      {/* Main layout — fixed height, no page scroll */}
      <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
        {/* Sender list — LEFT PANEL */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Non classificati ({sortedSenders.length})
              {selectedSenders.size > 0 && (
                <span className="ml-2 font-semibold text-primary">{selectedSenders.size} selezionati</span>
              )}
            </span>
            {sortedSenders.length > 0 && (
              <Checkbox
                checked={selectedSenders.size === sortedSenders.length && sortedSenders.length > 0}
                onCheckedChange={handleSelectAll}
                className="h-4 w-4"
              />
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-2 space-y-2">
              {sortedSenders.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  {searchQuery ? "Nessun risultato" : "Tutti i mittenti sono classificati ✅"}
                </p>
              ) : (
                sortedSenders.map((sender) => (
                  <SenderCard
                    key={sender.email}
                    sender={sender}
                    onDragStart={handleDragStartLocal}
                    onDragEnd={handleDragEndLocal}
                    onViewEmails={(s) => setEmailPreviewSender(s)}
                    groups={groups}
                    onAssignGroup={assignToGroup}
                    isSelected={selectedSenders.has(sender.email)}
                    onToggleSelect={toggleSenderSelection}
                  />
                ))
              )}
            </div>
          </div>
          {selectedSenders.size > 0 && (
            <MultiSelectBulkBar
              selectedSenders={getSelectedSenderObjects(senders)}
              groups={groups}
              onComplete={() => {
                setSelectedSenders(new Set());
                loadData();
              }}
              onAssignGroup={handleBulkAssignLocal}
            />
          )}
        </div>

        {/* Groups panel — RIGHT PANEL */}
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
            <div className="p-4 flex flex-wrap gap-4 content-start">
              {sortedGroups.map((group) => (
                <GroupDropZone
                  key={group.id}
                  group={group}
                  onRefresh={loadData}
                  isHovered={hoveredGroupId === group.id}
                  rules={assignedByGroup.get(group.nome_gruppo) || []}
                  onRulesChanged={reloadAssignedRules}
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
    </div>
  );
}
