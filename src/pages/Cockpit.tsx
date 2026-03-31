import { useState, useCallback, useMemo } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import type { OutreachDebug } from "@/hooks/useOutreachGenerator";
import { motion, AnimatePresence } from "framer-motion";
import { TopCommandBar, type CockpitAIAction, type SourceTab } from "@/components/cockpit/TopCommandBar";
import { ContactStream } from "@/components/cockpit/ContactStream";
import { ChannelDropZones } from "@/components/cockpit/ChannelDropZones";
import { AIDraftStudio } from "@/components/cockpit/AIDraftStudio";
import { ActiveFilterChips } from "@/components/cockpit/ActiveFilterChips";
import { Mail, Sparkles } from "lucide-react";
import { useOutreachGenerator } from "@/hooks/useOutreachGenerator";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useCredits } from "@/hooks/useCredits";
import { useSelection } from "@/hooks/useSelection";
import { useCockpitContacts, useDeleteCockpitContacts, type CockpitContact } from "@/hooks/useCockpitContacts";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ViewMode = "card" | "list";
export type DraftChannel = "email" | "linkedin" | "whatsapp" | "sms" | null;
export type ContactOrigin = "wca" | "report_aziende" | "import" | "bca" | "manual";

export interface CockpitFilter {
  id: string;
  label: string;
  type: "search" | "country" | "status" | "language" | "channel" | "priority" | "custom";
}

export type ScrapingPhase = "idle" | "visiting" | "extracting" | "enriching" | "generating";

export interface LinkedInProfileData {
  name?: string;
  headline?: string;
  location?: string;
  about?: string;
  photoUrl?: string;
  profileUrl?: string;
}

export interface DraftState {
  channel: DraftChannel;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedinUrl: string | null;
  companyName: string | null;
  countryCode: string | null;
  subject: string;
  body: string;
  language: string;
  isGenerating: boolean;
  scrapingPhase: ScrapingPhase;
  linkedinProfile: LinkedInProfileData | null;
  _debug?: OutreachDebug;
}

// Re-export for backward compatibility
export type { CockpitContact };

const Cockpit = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("card");

  // Auto-connect channels on mount
  useAutoConnect();
  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [activeFilters, setActiveFilters] = useState<CockpitFilter[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [draftState, setDraftState] = useState<DraftState>({
    channel: null, contactId: null, contactName: null, contactEmail: null, contactPhone: null,
    contactLinkedinUrl: null, companyName: null, countryCode: null, subject: "", body: "", language: "english", isGenerating: false,
    scrapingPhase: "idle", linkedinProfile: null,
  });
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const { filters: gf } = useGlobalFilters();
  const searchQuery = gf.search;

  const { contacts: allContacts, contactsMap, isLoading } = useCockpitContacts();

  // Filter contacts by source tab
  const contacts = useMemo(() => {
    if (sourceTab === "all") return allContacts;
    const originMap: Record<string, string> = { wca: "wca", prospect: "report_aziende", contact: "import", bca: "bca" };
    return allContacts.filter(c => c.origin === originMap[sourceTab]);
  }, [allContacts, sourceTab]);
  const selection = useSelection(contacts);
  const { generate } = useOutreachGenerator();
  const { refetch: refetchCredits } = useCredits();
  const deleteContacts = useDeleteCockpitContacts();
  const liBridge = useLinkedInExtensionBridge();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    const linkedinUrl = contact.linkedinUrl || null;
    const isLinkedInChannel = channel === "linkedin";
    const canScrapeLinkedIn = isLinkedInChannel && liBridge.isAvailable && linkedinUrl;

    // Initialize draft with scraping phase if LinkedIn
    setDraftState({
      channel, contactId: firstId, contactName: contact.name,
      contactEmail: contact.email, contactPhone: contact.phone,
      contactLinkedinUrl: linkedinUrl,
      companyName: contact.company,
      countryCode: contact.country, subject: "", body: "",
      language: contact.language, isGenerating: true,
      scrapingPhase: canScrapeLinkedIn ? "visiting" : "generating",
      linkedinProfile: null,
    });

    let scrapedProfile: LinkedInProfileData | null = null;

    // ── Human-like flow: scrape LinkedIn profile first ──
    if (canScrapeLinkedIn) {
      try {
        // Phase 1: Visiting profile
        setDraftState(prev => ({ ...prev, scrapingPhase: "visiting" }));
        await new Promise(r => setTimeout(r, 800)); // Brief pause for UX

        // Phase 2: Extracting data
        setDraftState(prev => ({ ...prev, scrapingPhase: "extracting" }));
        const profileResult = await liBridge.extractProfile(linkedinUrl!);

        if (profileResult.success && profileResult.profile) {
          scrapedProfile = profileResult.profile;
          setDraftState(prev => ({
            ...prev,
            scrapingPhase: "enriching",
            linkedinProfile: scrapedProfile,
          }));

          // Save scraped data to DB (enrichment_data) in background
          import("@/integrations/supabase/client").then(async ({ supabase }) => {
            try {
              // Find partner by company name to update enrichment_data
              const { data: partnerRows } = await supabase
                .from("partners")
                .select("id, enrichment_data")
                .ilike("company_name", `%${contact.company}%`)
                .limit(1);
              if (partnerRows?.[0]) {
                const existing = (partnerRows[0].enrichment_data as Record<string, any>) || {};
                await supabase.from("partners").update({
                  enrichment_data: {
                    ...existing,
                    linkedin_profile_name: scrapedProfile?.name,
                    linkedin_profile_headline: scrapedProfile?.headline,
                    linkedin_profile_location: scrapedProfile?.location,
                    linkedin_profile_about: scrapedProfile?.about?.slice(0, 2000),
                    linkedin_profile_url: scrapedProfile?.profileUrl,
                    linkedin_scraped_at: new Date().toISOString(),
                    linkedin_summary: [
                      scrapedProfile?.name,
                      scrapedProfile?.headline,
                      scrapedProfile?.about?.slice(0, 500),
                    ].filter(Boolean).join(" — "),
                  },
                }).eq("id", partnerRows[0].id);
              }
            } catch (e) {
              console.error("Failed to save LinkedIn profile to DB:", e);
            }
          });

          await new Promise(r => setTimeout(r, 500));
        } else {
          toast.info("Profilo LinkedIn non estratto — generazione con dati DB");
        }
      } catch (e) {
        console.error("LinkedIn scraping failed:", e);
        toast.info("Scraping LinkedIn fallito — generazione con dati DB");
      }
    }

    // Phase 3: AI Generation
    setDraftState(prev => ({ ...prev, scrapingPhase: "generating" }));

    const result = await generate({
      channel, contact_name: contact.name, contact_email: contact.email,
      company_name: contact.company, country_code: contact.country,
      goal: "Proposta di collaborazione nel freight forwarding", quality: "standard",
      linkedin_profile: scrapedProfile || undefined,
    });

    if (result) {
      setDraftState(prev => ({
        ...prev, subject: result.subject || "", body: result.body || "",
        language: result.language || prev.language, isGenerating: false,
        scrapingPhase: "idle",
        _debug: result._debug,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false, scrapingPhase: "idle" }));
    }
  }, [generate, refetchCredits, getDraggedIds, contactsMap, liBridge]);

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
      setDraftState(prev => ({ ...prev, subject: result.subject || "", body: result.body || "", language: result.language || prev.language, isGenerating: false, _debug: result._debug }));
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

  const handleBulkDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    try {
      await deleteContacts.mutateAsync(ids);
      selection.clear();
      toast.success(`${ids.length} record eliminati`);
    } catch {
      toast.error("Errore durante l'eliminazione");
    }
    setShowDeleteConfirm(false);
  }, [selection, deleteContacts]);

  const contactsForAI = useMemo(() =>
    contacts.map(c => ({
      id: c.id, name: c.name, company: c.company, country: c.country,
      priority: c.priority, language: c.language, channels: c.channels,
    })),
  [contacts]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
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
            onSingleDeepSearch={handleSingleDeepSearch} onSingleAlias={handleSingleAlias}
            onBulkDelete={handleBulkDelete}
            onBatchMode={() => setBatchMode(true)}
          />
        </div>
        <div className="flex-1 flex items-center justify-center p-6 min-w-[320px]">
          {batchMode && selection.count > 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center max-w-md"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Generazione Batch</h3>
              <p className="text-sm text-muted-foreground">
                {selection.count} contatti selezionati. Trascina sulle drop zone per generare uno alla volta,
                oppure usa il comando AI per generare in batch.
              </p>
              <button
                onClick={() => { setBatchMode(false); }}
                className="text-xs text-primary hover:underline"
              >
                ← Torna alla vista drop zone
              </button>
            </motion.div>
          ) : (
            <ChannelDropZones
              isDragging={!!draggedContactId} draggedContactId={draggedContactId}
              dragCount={dragCount} onDrop={handleDrop}
            />
          )}
        </div>
        <div className="flex-1 min-w-[320px] max-w-[480px] flex-shrink-0 border-l border-border/50">
          <AIDraftStudio draft={draftState} onDraftChange={setDraftState} onRegenerate={handleRegenerate} />
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
            <AlertDialogAction onClick={confirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Cockpit;
