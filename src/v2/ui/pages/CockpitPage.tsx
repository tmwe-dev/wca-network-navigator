/**
 * CockpitPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { motion, AnimatePresence } from "framer-motion";
import { TopCommandBar } from "@/components/cockpit/TopCommandBar";
import { ContactStream } from "@/components/cockpit/ContactStream";
import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ActiveFilterChips } from "@/components/cockpit/ActiveFilterChips";
import { Mail, Linkedin } from "lucide-react";
import { LinkedInFlowPanel } from "@/components/cockpit/LinkedInFlowPanel";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCockpitLogic } from "@/hooks/useCockpitLogic";
// Re-export cockpit types for backwards compatibility
export type {
  ViewMode,
  DraftChannel,
  ContactOrigin,
  CockpitFilter,
  ScrapingPhase,
  LinkedInProfileData,
  DraftState,
} from "@/types/cockpit";

export type { CockpitContact } from "@/hooks/useCockpitContacts";

export function CockpitPage() {
  const logic = useCockpitLogic();
  const {
    viewMode, setViewMode, sourceTab, setSourceTab,
    activeFilters, handleRemoveFilter, executeAIActions,
    batchMode, setBatchMode, showLinkedInFlow, setShowLinkedInFlow,
    draftState, setDraftState,
    draggedContactId, dragCount, handleDragStart, handleDragEnd, handleDrop,
    handleGenerateAfterReview, handleRegenerate,
    contacts, contactsMap, isLoading, selection,
    handleBulkDeepSearch, handleBulkAlias, handleBulkLinkedInLookup,
    handleSingleDeepSearch, handleSingleAlias, handleSingleLinkedInLookup,
    handleBulkDelete, confirmBulkDelete, showDeleteConfirm, setShowDeleteConfirm,
    contactsForAI, searchQuery, linkedInLookup, assignmentInfoMap,
  } = logic;

  return (
    <div data-testid="page-cockpit" className="h-full flex flex-col overflow-hidden">
      <TopCommandBar
        onAIActions={executeAIActions} viewMode={viewMode} onViewChange={setViewMode}
        searchQuery={searchQuery} onSearchChange={() => {}}
        contacts={contactsForAI}
        sourceTab={sourceTab} onSourceTabChange={setSourceTab}
      />
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <ActiveFilterChips filters={activeFilters} onRemove={handleRemoveFilter} />
        )}
      </AnimatePresence>
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        <div className="w-[380px] flex-shrink-0 border-r border-border/50 overflow-y-auto">
          <ContactStream
            viewMode={viewMode} searchQuery={searchQuery} onSearchChange={() => {}} filters={activeFilters}
            contacts={contacts} isLoading={isLoading}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd}
            selectedIds={selection.selectedIds} onToggle={selection.toggle}
            onSelectAll={selection.selectAll} onClear={selection.clear}
            isAllSelected={selection.isAllSelected} selectionCount={selection.count}
            onBulkDeepSearch={handleBulkDeepSearch} onBulkAlias={handleBulkAlias}
            onBulkLinkedInLookup={handleBulkLinkedInLookup}
            isLinkedInLookupRunning={linkedInLookup.progress.status === "running"}
            onSingleDeepSearch={handleSingleDeepSearch} onSingleAlias={handleSingleAlias}
            onSingleLinkedInLookup={handleSingleLinkedInLookup}
            onBulkDelete={handleBulkDelete}
            onBatchMode={() => setBatchMode(true)}
            activeContactId={draftState.contactId}
            enrichmentState={draftState.contactId ? {
              isActive: true, scrapingPhase: draftState.scrapingPhase, linkedinProfile: draftState.linkedinProfile,
            } : undefined}
            assignmentMap={assignmentInfoMap}
          />
        </div>
        <div className="flex-1 flex items-stretch justify-center p-6 min-w-[320px]">
          {showLinkedInFlow && selection.count > 0 ? (
            <LinkedInFlowPanel
              selectedContacts={contacts.filter(c => selection.selectedIds.has(c.id)).map(c => ({ id: c.id, name: c.name, company: c.company, linkedinUrl: c.linkedinUrl }))}
              onClose={() => setShowLinkedInFlow(false)}
            />
          ) : batchMode && selection.count > 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Generazione Batch</h3>
              <p className="text-sm text-muted-foreground">{selection.count} contatti selezionati. Trascina sulle drop zone per generare uno alla volta, oppure usa il comando AI per generare in batch.</p>
              <div className="flex gap-2">
                <button onClick={() => setShowLinkedInFlow(true)} className="flex items-center gap-1.5 text-xs text-[#0077B5] hover:underline font-medium">
                  <Linkedin className="w-3.5 h-3.5" /> LinkedIn Flow
                </button>
                <span className="text-muted-foreground text-xs">·</span>
                <button onClick={() => setBatchMode(false)} className="text-xs text-primary hover:underline">← Drop zone</button>
              </div>
            </motion.div>
          ) : (
            <ChannelDropZones
              isDragging={!!draggedContactId} draggedContactId={draggedContactId}
              dragCount={dragCount} onDrop={handleDrop}
              hasActiveContact={!!draftState.contactId}
              contactAvailability={draftState.contactId ? (() => {
                const c = contactsMap[draftState.contactId!];
                return c ? {
                  hasEmail: !!c.email,
                  hasPhone: !!c.phone,
                  hasLinkedinUrl: !!c.linkedinUrl,
                } : undefined;
              })() : undefined}
              onReadProfile={() => {
                if (draftState.contactId) {
                  const c = contactsMap[draftState.contactId];
                  if (c?.linkedinUrl) handleDrop("linkedin", draftState.contactId, c.name);
                  else toast.info("Nessun URL LinkedIn disponibile — esegui prima LinkedIn Lookup");
                }
              }}
              onDeepSearch={() => { if (draftState.contactId) handleSingleDeepSearch(draftState.contactId); }}
            />
          )}
        </div>
        <div className="flex-1 min-w-[320px] max-w-[480px] flex-shrink-0 border-l border-border/50">
          <AIDraftStudio draft={draftState} onDraftChange={setDraftState} onRegenerate={handleRegenerate} onGenerateAfterReview={handleGenerateAfterReview} />
        </div>
      </div>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare {selection.count} record?</AlertDialogTitle>
            <AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
