import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopCommandBar } from "@/components/cockpit/TopCommandBar";
import { ContactStream } from "@/components/cockpit/ContactStream";
import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ActiveFilterChips } from "@/components/cockpit/ActiveFilterChips";

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
  subject: string;
  body: string;
  language: string;
  isGenerating: boolean;
}

const Cockpit = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [activeFilters, setActiveFilters] = useState<CockpitFilter[]>([]);
  const [draftState, setDraftState] = useState<DraftState>({
    channel: null,
    contactId: null,
    contactName: null,
    subject: "",
    body: "",
    language: "english",
    isGenerating: false,
  });
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCommand = useCallback((command: string, filters: CockpitFilter[]) => {
    setActiveFilters(filters);
  }, []);

  const handleRemoveFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  const handleDrop = useCallback((channel: DraftChannel, contactId: string, contactName: string) => {
    setDraftState({
      channel,
      contactId,
      contactName,
      subject: "",
      body: "",
      language: "english",
      isGenerating: true,
    });
    // Simulate typewriter generation
    setTimeout(() => {
      setDraftState(prev => ({
        ...prev,
        subject: `Partnership opportunity — ${prev.contactName}`,
        body: `Dear ${prev.contactName},\n\nI hope this message finds you well. I'm reaching out to explore a potential collaboration between our companies in the freight forwarding sector.\n\nOur network spans over 40 countries and we believe there's a strong synergy with your operations.\n\nWould you be available for a brief call next week to discuss?\n\nBest regards`,
        isGenerating: false,
      }));
    }, 2500);
  }, []);

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden">
      {/* AI Command Bar */}
      <TopCommandBar
        onCommand={handleCommand}
        viewMode={viewMode}
        onViewChange={handleViewChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Active Filter Chips */}
      <AnimatePresence>
        {activeFilters.length > 0 && (
          <ActiveFilterChips filters={activeFilters} onRemove={handleRemoveFilter} />
        )}
      </AnimatePresence>

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">
        {/* Left — Contact Stream */}
        <div className="w-[380px] flex-shrink-0 border-r border-border/50 overflow-y-auto">
          <ContactStream
            viewMode={viewMode}
            searchQuery={searchQuery}
            filters={activeFilters}
            onDragStart={setDraggedContactId}
            onDragEnd={() => setDraggedContactId(null)}
          />
        </div>

        {/* Center — Channel Drop Zones */}
        <div className="flex-1 flex items-center justify-center p-6 min-w-[320px]">
          <ChannelDropZones
            isDragging={!!draggedContactId}
            draggedContactId={draggedContactId}
            onDrop={handleDrop}
          />
        </div>

        {/* Right — AI Draft Studio */}
        <div className="w-[400px] flex-shrink-0 border-l border-border/50">
          <AIDraftStudio draft={draftState} onDraftChange={setDraftState} />
        </div>
      </div>
    </div>
  );
};

export default Cockpit;
