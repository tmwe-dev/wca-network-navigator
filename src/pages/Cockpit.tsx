import { useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, PackageCheck, CalendarClock } from "lucide-react";
import { TopCommandBar, type CockpitAIAction } from "@/components/cockpit/TopCommandBar";
import { ContactStream } from "@/components/cockpit/ContactStream";
import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ActiveFilterChips } from "@/components/cockpit/ActiveFilterChips";
import { ReviewPanel } from "@/components/cockpit/ReviewPanel";
import { PlanPanel } from "@/components/cockpit/PlanPanel";
import { useOutreachGenerator } from "@/hooks/useOutreachGenerator";
import { useCredits } from "@/hooks/useCredits";
import { useSelection } from "@/hooks/useSelection";
import { useCockpitContacts, type CockpitContact } from "@/hooks/useCockpitContacts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type ViewMode = "card" | "list";
export type DraftChannel = "email" | "linkedin" | "whatsapp" | "sms" | null;
export type ContactOrigin = "wca" | "report_aziende" | "import";
export type CockpitTab = "genera" | "revisiona" | "pianifica";

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

export type { CockpitContact };

const TAB_CONFIG: { id: CockpitTab; label: string; icon: any }[] = [
  { id: "genera", label: "Genera", icon: Zap },
  { id: "revisiona", label: "Revisiona", icon: PackageCheck },
  { id: "pianifica", label: "Pianifica", icon: CalendarClock },
];

const Cockpit = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as CockpitTab) || "genera";

  const [activeTab, setActiveTab] = useState<CockpitTab>(initialTab);
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

  const handleTabChange = useCallback((tab: CockpitTab) => {
    setActiveTab(tab);
    setSearchParams(tab === "genera" ? {} : { tab });
  }, [setSearchParams]);

  // ── AI Action Executor ──
  const executeAIActions = useCallback((actions: CockpitAIAction[], message: string) => {
    for (const action of actions) {
      switch (action.type) {
        case "filter":
          if (action.filters) setActiveFilters(action.filters);
          break;
        case "select_all": selection.selectAll(); break;
        case "clear_selection": selection.clear(); break;
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
          if (action.action === "deep_search") toast.info(`Deep Search per ${selection.count} contatti`);
          else if (action.action === "alias") toast.info(`Generazione Alias per ${selection.count} contatti`);
          else if (action.action === "outreach") toast.info(`Outreach per ${selection.count} contatti — trascina sulle drop zone`);
          break;
        case "single_action": {
          const contact = contacts.find(c => c.name.toLowerCase().includes((action.contactName || "").toLowerCase()));
          if (contact) {
            if (action.action === "deep_search") toast.info(`Deep Search per ${contact.name}`);
            else if (action.action === "alias") toast.info(`Genera Alias per ${contact.name}`);
          } else toast.error(`Contatto "${action.contactName}" non trovato`);
          break;
        }
        case "view_mode": if (action.mode) setViewMode(action.mode); break;
        case "auto_outreach": {
          const names = action.contactNames || [];
          const matchIds = contacts.filter(c => names.some(n => c.name.toLowerCase().includes(n.toLowerCase()))).map(c => c.id);
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

  const handleDragStart = useCallback((id: string) => setDraggedContactId(id), []);
  const handleDragEnd = useCallback(() => setDraggedContactId(null), []);

  const getDraggedIds = useCallback((): string[] => {
    if (!draggedContactId) return [];
    if (selection.selectedIds.has(draggedContactId) && selection.count > 1) return Array.from(selection.selectedIds);
    return [draggedContactId];
  }, [draggedContactId, selection.selectedIds, selection.count]);

  const dragCount = useMemo(() => {
    if (!draggedContactId) return 0;
    if (selection.selectedIds.has(draggedContactId) && selection.count > 1) return selection.count;
    return 1;
  }, [draggedContactId, selection.selectedIds, selection.count]);

  // Save activity to DB after generating
  const saveActivity = useCallback(async (
    contact: CockpitContact,
    channel: DraftChannel,
    subject: string,
    body: string,
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Determine source type and source_id from the cockpit contact id
      const rawId = contact.id;
      let sourceType = "partner";
      let sourceId = rawId;

      if (rawId.startsWith("pc-")) {
        sourceType = "partner";
        sourceId = rawId.slice(3);
      } else if (rawId.startsWith("ic-")) {
        sourceType = "contact";
        sourceId = rawId.slice(3);
      } else if (rawId.startsWith("prc-")) {
        sourceType = "prospect";
        sourceId = rawId.slice(4);
      }

      await supabase.from("activities").insert({
        activity_type: "send_email" as any,
        title: `${channel} → ${contact.name}`,
        source_id: sourceId,
        source_type: sourceType,
        status: "pending" as any,
        email_subject: subject,
        email_body: body,
        source_meta: {
          company_name: contact.company,
          contact_name: contact.name,
          contact_email: contact.email,
          country_code: contact.country,
          channel,
        },
      } as any);
    } catch (err) {
      console.error("Failed to save activity:", err);
    }
  }, []);

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
      const subject = result.subject || "";
      const body = result.body || "";
      setDraftState(prev => ({
        ...prev, subject, body,
        language: result.language || prev.language, isGenerating: false,
      }));
      refetchCredits();

      // If in pianifica mode, save to DB automatically
      if (activeTab === "pianifica") {
        await saveActivity(contact, channel, subject, body);
        toast.success(`Attività pianificata per ${contact.name}`);
      }
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [generate, refetchCredits, getDraggedIds, contactsMap, activeTab, saveActivity]);

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

  const handleBulkDeepSearch = useCallback(() => toast.info(`Deep Search per ${selection.count} contatti`), [selection.count]);
  const handleBulkAlias = useCallback(() => toast.info(`Generazione Alias per ${selection.count} contatti`), [selection.count]);
  const handleSingleDeepSearch = useCallback((id: string) => toast.info(`Deep Search per ${contactsMap[id]?.name || id}`), [contactsMap]);
  const handleSingleAlias = useCallback((id: string) => toast.info(`Genera Alias per ${contactsMap[id]?.name || id}`), [contactsMap]);

  const contactsForAI = useMemo(() =>
    contacts.map(c => ({
      id: c.id, name: c.name, company: c.company, country: c.country,
      priority: c.priority, language: c.language, channels: c.channels,
    })),
  [contacts]);

  const showContactStream = activeTab !== "revisiona";
  const showDraftStudio = activeTab !== "revisiona";

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* Top bar */}
      <TopCommandBar
        onAIActions={executeAIActions} viewMode={viewMode} onViewChange={setViewMode}
        searchQuery={searchQuery} onSearchChange={setSearchQuery} contacts={contactsForAI}
      />

      {/* Tab bar */}
      <div className="px-4 pb-2 flex items-center gap-1">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="cockpit-tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {activeFilters.length > 0 && (
          <ActiveFilterChips filters={activeFilters} onRemove={handleRemoveFilter} />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        {/* Left: Contact Stream (genera + pianifica) */}
        {showContactStream && (
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
        )}

        {/* Center panel */}
        <div className="flex-1 flex items-center justify-center min-w-[320px] relative">
          <AnimatePresence mode="wait">
            {activeTab === "genera" && (
              <motion.div key="genera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center w-full h-full p-6"
              >
                <ChannelDropZones
                  isDragging={!!draggedContactId} draggedContactId={draggedContactId}
                  dragCount={dragCount} onDrop={handleDrop}
                />
              </motion.div>
            )}
            {activeTab === "revisiona" && (
              <motion.div key="revisiona" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <ReviewPanel />
              </motion.div>
            )}
            {activeTab === "pianifica" && (
              <motion.div key="pianifica" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center justify-center w-full h-full"
              >
                <PlanPanel
                  isDragging={!!draggedContactId} draggedContactId={draggedContactId}
                  dragCount={dragCount} onDrop={handleDrop}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: AI Draft Studio (genera + pianifica) */}
        {showDraftStudio && (
          <div className="w-[400px] flex-shrink-0 border-l border-border/50">
            <AIDraftStudio draft={draftState} onDraftChange={setDraftState} onRegenerate={handleRegenerate} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Cockpit;
