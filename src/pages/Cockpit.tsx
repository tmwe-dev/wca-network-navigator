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
import { toast } from "sonner";

export type ViewMode = "card" | "list";
export type DraftChannel = "email" | "linkedin" | "whatsapp" | "sms" | null;

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

export interface CockpitContact {
  id: string;
  name: string;
  company: string;
  email: string;
  country: string;
  language: string;
}

export const DEMO_CONTACTS = [
  { id: "1", name: "Marco Bianchi", company: "Logistica Milano Srl", role: "CEO", country: "IT", language: "italiano", lastContact: "2 giorni fa", priority: 9, channels: ["email", "whatsapp", "linkedin"] as string[], email: "marco@logmilano.it" },
  { id: "2", name: "Sarah Johnson", company: "Global Freight Ltd", role: "VP Sales", country: "GB", language: "english", lastContact: "1 settimana fa", priority: 8, channels: ["email", "linkedin"] as string[], email: "sarah@globalfreight.co.uk" },
  { id: "3", name: "Pierre Dupont", company: "TransEurope SA", role: "Directeur Commercial", country: "FR", language: "français", lastContact: "3 giorni fa", priority: 7, channels: ["email", "whatsapp", "linkedin", "sms"] as string[], email: "pierre@transeurope.fr" },
  { id: "4", name: "Hans Weber", company: "Spedition Weber GmbH", role: "Geschäftsführer", country: "DE", language: "deutsch", lastContact: "5 giorni fa", priority: 6, channels: ["email", "linkedin"] as string[], email: "hans@weber-spedition.de" },
  { id: "5", name: "Ana Garcia", company: "Transportes Garcia", role: "Directora", country: "ES", language: "español", lastContact: "2 settimane fa", priority: 5, channels: ["email", "whatsapp", "sms"] as string[], email: "ana@tgarcia.es" },
  { id: "6", name: "Yuki Tanaka", company: "Nippon Logistics KK", role: "Manager", country: "JP", language: "english", lastContact: "1 mese fa", priority: 4, channels: ["email", "linkedin"] as string[], email: "yuki@nipponlog.jp" },
  { id: "7", name: "Roberto Esposito", company: "NaviCargo SpA", role: "Resp. Commerciale", country: "IT", language: "italiano", lastContact: "Ieri", priority: 10, channels: ["email", "whatsapp", "linkedin", "sms"] as string[], email: "roberto@navicargo.it" },
  { id: "8", name: "Elena Volkov", company: "TransSiberian LLC", role: "Business Dev", country: "RU", language: "english", lastContact: "4 giorni fa", priority: 7, channels: ["email"] as string[], email: "elena@transsib.ru" },
];

const DEMO_CONTACTS_MAP: Record<string, CockpitContact> = Object.fromEntries(
  DEMO_CONTACTS.map(c => [c.id, { id: c.id, name: c.name, company: c.company, email: c.email, country: c.country, language: c.language }])
);

const Cockpit = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeFilters, setActiveFilters] = useState<CockpitFilter[]>([]);
  const [draftState, setDraftState] = useState<DraftState>({
    channel: null, contactId: null, contactName: null, contactEmail: null,
    companyName: null, countryCode: null, subject: "", body: "", language: "english", isGenerating: false,
  });
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const selection = useSelection(DEMO_CONTACTS);
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
          selection.selectWhere((c: typeof DEMO_CONTACTS[0]) => {
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
            toast.info(`Deep Search per ${selection.count} contatti — disponibile con dati reali`);
          } else if (action.action === "alias") {
            toast.info(`Generazione Alias per ${selection.count} contatti — disponibile con dati reali`);
          } else if (action.action === "outreach") {
            toast.info(`Outreach per ${selection.count} contatti — trascina sulle drop zone`);
          }
          break;
        case "single_action": {
          const contact = DEMO_CONTACTS.find(c => c.name.toLowerCase().includes((action.contactName || "").toLowerCase()));
          if (contact) {
            if (action.action === "deep_search") {
              toast.info(`Deep Search per ${contact.name} — disponibile con dati reali`);
            } else if (action.action === "alias") {
              toast.info(`Genera Alias per ${contact.name} — disponibile con dati reali`);
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
          const matchIds = DEMO_CONTACTS
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
  }, [selection]);

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
    const contact = DEMO_CONTACTS_MAP[firstId];
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
  }, [generate, refetchCredits, getDraggedIds]);

  const handleRegenerate = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId) return;
    setDraftState(prev => ({ ...prev, subject: "", body: "", isGenerating: true }));
    const contact = DEMO_CONTACTS_MAP[draftState.contactId];
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
  }, [draftState, generate, refetchCredits]);

  const handleBulkDeepSearch = useCallback(() => {
    toast.info("Deep Search disponibile con dati reali (non demo)");
  }, []);

  const handleBulkAlias = useCallback(() => {
    toast.info("Generazione Alias disponibile con dati reali (non demo)");
  }, []);

  const handleSingleDeepSearch = useCallback((id: string) => {
    toast.info(`Deep Search per ${DEMO_CONTACTS_MAP[id]?.name || id} — disponibile con dati reali`);
  }, []);

  const handleSingleAlias = useCallback((id: string) => {
    toast.info(`Genera Alias per ${DEMO_CONTACTS_MAP[id]?.name || id} — disponibile con dati reali`);
  }, []);

  // Contacts data for AI command bar
  const contactsForAI = useMemo(() =>
    DEMO_CONTACTS.map(c => ({
      id: c.id, name: c.name, company: c.company, country: c.country,
      priority: c.priority, language: c.language, channels: c.channels,
    })),
  []);

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
