import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopCommandBar } from "@/components/cockpit/TopCommandBar";
import { ContactStream } from "@/components/cockpit/ContactStream";
import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ActiveFilterChips } from "@/components/cockpit/ActiveFilterChips";
import { useOutreachGenerator } from "@/hooks/useOutreachGenerator";
import { useCredits } from "@/hooks/useCredits";

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

// Contact info passed from stream for generation
export interface CockpitContact {
  id: string;
  name: string;
  company: string;
  email: string;
  country: string;
  language: string;
}

// Demo contacts lookup
const DEMO_CONTACTS_MAP: Record<string, CockpitContact> = {
  "1": { id: "1", name: "Marco Bianchi", company: "Logistica Milano Srl", email: "marco@logmilano.it", country: "IT", language: "italiano" },
  "2": { id: "2", name: "Sarah Johnson", company: "Global Freight Ltd", email: "sarah@globalfreight.co.uk", country: "GB", language: "english" },
  "3": { id: "3", name: "Pierre Dupont", company: "TransEurope SA", email: "pierre@transeurope.fr", country: "FR", language: "français" },
  "4": { id: "4", name: "Hans Weber", company: "Spedition Weber GmbH", email: "hans@weber-spedition.de", country: "DE", language: "deutsch" },
  "5": { id: "5", name: "Ana Garcia", company: "Transportes Garcia", email: "ana@tgarcia.es", country: "ES", language: "español" },
  "6": { id: "6", name: "Yuki Tanaka", company: "Nippon Logistics KK", email: "yuki@nipponlog.jp", country: "JP", language: "english" },
  "7": { id: "7", name: "Roberto Esposito", company: "NaviCargo SpA", email: "roberto@navicargo.it", country: "IT", language: "italiano" },
  "8": { id: "8", name: "Elena Volkov", company: "TransSiberian LLC", email: "elena@transsib.ru", country: "RU", language: "english" },
};

const Cockpit = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeFilters, setActiveFilters] = useState<CockpitFilter[]>([]);
  const [draftState, setDraftState] = useState<DraftState>({
    channel: null,
    contactId: null,
    contactName: null,
    contactEmail: null,
    companyName: null,
    countryCode: null,
    subject: "",
    body: "",
    language: "english",
    isGenerating: false,
  });
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { generate, isGenerating } = useOutreachGenerator();
  const { refetch: refetchCredits } = useCredits();

  const handleCommand = useCallback((command: string, filters: CockpitFilter[]) => {
    setActiveFilters(filters);
  }, []);

  const handleRemoveFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  const handleDrop = useCallback(async (channel: DraftChannel, contactId: string, contactName: string) => {
    const contact = DEMO_CONTACTS_MAP[contactId];
    
    setDraftState({
      channel,
      contactId,
      contactName,
      contactEmail: contact?.email || null,
      companyName: contact?.company || null,
      countryCode: contact?.country || null,
      subject: "",
      body: "",
      language: contact?.language || "english",
      isGenerating: true,
    });

    const result = await generate({
      channel,
      contact_name: contactName,
      contact_email: contact?.email,
      company_name: contact?.company || "",
      country_code: contact?.country,
      goal: "Proposta di collaborazione nel freight forwarding",
      quality: "standard",
    });

    if (result) {
      setDraftState(prev => ({
        ...prev,
        subject: result.subject || "",
        body: result.body || "",
        language: result.language || prev.language,
        isGenerating: false,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [generate, refetchCredits]);

  const handleRegenerate = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId) return;
    
    setDraftState(prev => ({ ...prev, subject: "", body: "", isGenerating: true }));

    const contact = DEMO_CONTACTS_MAP[draftState.contactId];
    const result = await generate({
      channel: draftState.channel,
      contact_name: draftState.contactName || "",
      contact_email: contact?.email,
      company_name: contact?.company || "",
      country_code: contact?.country,
      goal: "Proposta di collaborazione nel freight forwarding",
      quality: "standard",
    });

    if (result) {
      setDraftState(prev => ({
        ...prev,
        subject: result.subject || "",
        body: result.body || "",
        language: result.language || prev.language,
        isGenerating: false,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [draftState, generate, refetchCredits]);

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      <TopCommandBar
        onCommand={handleCommand}
        viewMode={viewMode}
        onViewChange={handleViewChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <AnimatePresence>
        {activeFilters.length > 0 && (
          <ActiveFilterChips filters={activeFilters} onRemove={handleRemoveFilter} />
        )}
      </AnimatePresence>

      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        <div className="w-[380px] flex-shrink-0 border-r border-border/50 overflow-y-auto">
          <ContactStream
            viewMode={viewMode}
            searchQuery={searchQuery}
            filters={activeFilters}
            onDragStart={setDraggedContactId}
            onDragEnd={() => setDraggedContactId(null)}
          />
        </div>

        <div className="flex-1 flex items-center justify-center p-6 min-w-[320px]">
          <ChannelDropZones
            isDragging={!!draggedContactId}
            draggedContactId={draggedContactId}
            onDrop={handleDrop}
          />
        </div>

        <div className="w-[400px] flex-shrink-0 border-l border-border/50">
          <AIDraftStudio
            draft={draftState}
            onDraftChange={setDraftState}
            onRegenerate={handleRegenerate}
          />
        </div>
      </div>
    </div>
  );
};

export default Cockpit;
