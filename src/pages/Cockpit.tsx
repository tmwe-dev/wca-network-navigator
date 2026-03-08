import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopCommandBar, type CockpitAIAction } from "@/components/cockpit/TopCommandBar";
import { ContactStream } from "@/components/cockpit/ContactStream";
import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ActiveFilterChips } from "@/components/cockpit/ActiveFilterChips";
import { useOutreachGenerator } from "@/hooks/useOutreachGenerator";
import { useCredits } from "@/hooks/useCredits";
import { useSelection } from "@/hooks/useSelection";
import { useCockpitContacts, type CockpitContact } from "@/hooks/useCockpitContacts";
import { toast } from "sonner";

export type ViewMode = "card" | "list";
export type DraftChannel = "email" | "linkedin" | "whatsapp" | "sms" | null;
export type ContactOrigin = "wca" | "report_aziende" | "import";

export interface CockpitFilter {
  id: string;
  label: string;
  type: "search" | "country" | "status" | "language" | "channel" | "priority" | "custom";
}

export interface DraftState {
  channel: DraftChannel;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  companyName: string | null;
  countryCode: string | null;
  subject: string;
  body: string;
  language: string;
  isGenerating: boolean;
}

// Re-export for backward compatibility
export type { CockpitContact };

const Cockpit = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeFilters, setActiveFilters] = useState<CockpitFilter[]>([]);
  const [draftState, setDraftState] = useState<DraftState>({
    channel: null, contactId: null, contactName: null, contactEmail: null,
    companyName: null, countryCode: null, subject: "", body: "", language: "english", isGenerating: false,
  });
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { contacts, contactsMap, isLoading } = useCockpitContacts();
  const selection = useSelection(contacts);
  const { generate } = useOutreachGenerator();
  const { refetch: refetchCredits } = useCredits();

  // ── AI Action Executor ──
  const executeAIActions = useCallback((actions: CockpitAIAction[], message: string) => {
    for (const action of actions) {
      switch (action.type) {
        case "filter":
          if (action.filters) setActiveFilters(action.filters);
          break;
        case "select_all":
          selection.selectAll();
          break;
        case "clear_selection":
          selection.clear();
          break;
        case "select_where": {
          const { field, operator, value } = action;
          selection.selectWhere((c: CockpitContact) => {
            const fieldVal = (c as any)[field!];
            if (operator === ">=") return fieldVal >= (value as number);
            if (operator === "==") return fieldVal === value;
            if (operator === "includes" && Array.isArray(fieldVal)) return fieldVal.includes(value as string);
            return false;
          });
          break;
        }
        case "bulk_action":
          if (action.action === "deep_search") {
            toast.info(`Deep Search per ${selection.count} contatti`);
          } else if (action.action === "alias") {
            toast.info(`Generazione Alias per ${selection.count} contatti`);
          } else if (action.action === "outreach") {
            toast.info(`Outreach per ${selection.count} contatti — trascina sulle drop zone`);
          }
          break;
        case "single_action": {
          const contact = contacts.find(c => c.name.toLowerCase().includes((action.contactName || "").toLowerCase()));
          if (contact) {
            if (action.action === "deep_search") {
              toast.info(`Deep Search per ${contact.name}`);
            } else if (action.action === "alias") {
              toast.info(`Genera Alias per ${contact.name}`);
            }
          } else {
            toast.error(`Contatto "${action.contactName}" non trovato`);
          }
          break;
        }
        case "view_mode":
          if (action.mode) setViewMode(action.mode);
          break;
        case "auto_outreach": {
          const names = action.contactNames || [];
          const matchIds = contacts
            .filter(c => names.some(n => c.name.toLowerCase().includes(n.toLowerCase())))
            .map(c => c.id);
          if (matchIds.length > 0) {
            selection.addBatch(matchIds);
            toast.info(`Outreach ${action.channel} per ${matchIds.length} contatti — trascina sulle drop zone`);
          }
          break;
        }
      }
    }
    if (message) toast.success(message);
  }, [selection, contacts]);

  const handleRemoveFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  const handleDragStart = useCallback((id: string) => {
    setDraggedContactId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedContactId(null);
  }, []);

  const getDraggedIds = useCallback((): string[] => {
    if (!draggedContactId) return [];
    if (selection.selectedIds.has(draggedContactId) && selection.count > 1) {
      return Array.from(selection.selectedIds);
    }
    return [draggedContactId];
  }, [draggedContactId, selection.selectedIds, selection.count]);

  const dragCount = useMemo(() => {
    if (!draggedContactId) return 0;
    if (selection.selectedIds.has(draggedContactId) && selection.count > 1) return selection.count;
    return 1;
  }, [draggedContactId, selection.selectedIds, selection.count]);

  const handleDrop = useCallback(async (channel: DraftChannel, _contactId: string, _contactName: string) => {
    const ids = getDraggedIds();
    if (ids.length === 0) return;
    const firstId = ids[0];
    const contact = contactsMap[firstId];
    if (!contact) return;

    if (ids.length > 1) toast.info(`Generazione per ${ids.length} contatti — primo: ${contact.name}`);

    setDraftState({
      channel, contactId: firstId, contactName: contact.name,
      contactEmail: contact.email, companyName: contact.company,
      countryCode: contact.country, subject: "", body: "",
      language: contact.language, isGenerating: true,
    });

    const result = await generate({
      channel, contact_name: contact.name, contact_email: contact.email,
      company_name: contact.company, country_code: contact.country,
      goal: "Proposta di collaborazione nel freight forwarding", quality: "standard",
    });

    if (result) {
      setDraftState(prev => ({
        ...prev, subject: result.subject || "", body: result.body || "",
        language: result.language || prev.language, isGenerating: false,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [generate, refetchCredits, getDraggedIds, contactsMap]);

  const handleRegenerate = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId) return;
    setDraftState(prev => ({ ...prev, subject: "", body: "", isGenerating: true }));
    const contact = contactsMap[draftState.contactId];
    const result = await generate({
      channel: draftState.channel, contact_name: draftState.contactName || "",
      contact_email: contact?.email, company_name: contact?.company || "",
      country_code: contact?.country, goal: "Proposta di collaborazione nel freight forwarding", quality: "standard",
    });
    if (result) {
      setDraftState(prev => ({ ...prev, subject: result.subject || "", body: result.body || "", language: result.language || prev.language, isGenerating: false }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [draftState, generate, refetchCredits, contactsMap]);

  const handleBulkDeepSearch = useCallback(() => {
    toast.info(`Deep Search per ${selection.count} contatti`);
  }, [selection.count]);

  const handleBulkAlias = useCallback(() => {
    toast.info(`Generazione Alias per ${selection.count} contatti`);
  }, [selection.count]);

  const handleSingleDeepSearch = useCallback((id: string) => {
    toast.info(`Deep Search per ${contactsMap[id]?.name || id}`);
  }, [contactsMap]);

  const handleSingleAlias = useCallback((id: string) => {
    toast.info(`Genera Alias per ${contactsMap[id]?.name || id}`);
  }, [contactsMap]);

  const contactsForAI = useMemo(() =>
    contacts.map(c => ({
      id: c.id, name: c.name, company: c.company, country: c.country,
      priority: c.priority, language: c.language, channels: c.channels,
    })),
  [contacts]);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      <TopCommandBar
        onAIActions={executeAIActions} viewMode={viewMode} onViewChange={setViewMode}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        contacts={contactsForAI}
      />
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <ActiveFilterChips filters={activeFilters} onRemove={handleRemoveFilter} />
        )}
      </AnimatePresence>
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        <div className="w-[380px] flex-shrink-0 border-r border-border/50 overflow-y-auto">
          <ContactStream
            viewMode={viewMode} searchQuery={searchQuery} filters={activeFilters}
            contacts={contacts} isLoading={isLoading}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd}
            selectedIds={selection.selectedIds} onToggle={selection.toggle}
            onSelectAll={selection.selectAll} onClear={selection.clear}
            isAllSelected={selection.isAllSelected} selectionCount={selection.count}
            onBulkDeepSearch={handleBulkDeepSearch} onBulkAlias={handleBulkAlias}
            onSingleDeepSearch={handleSingleDeepSearch} onSingleAlias={handleSingleAlias}
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-6 min-w-[320px]">
          <ChannelDropZones
            isDragging={!!draggedContactId} draggedContactId={draggedContactId}
            dragCount={dragCount} onDrop={handleDrop}
          />
        </div>
        <div className="w-[400px] flex-shrink-0 border-l border-border/50">
          <AIDraftStudio draft={draftState} onDraftChange={setDraftState} onRegenerate={handleRegenerate} />
        </div>
      </div>
    </div>
  );
};

export default Cockpit;
