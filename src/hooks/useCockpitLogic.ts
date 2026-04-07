import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useOutreachGenerator } from "@/hooks/useOutreachGenerator";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useCredits } from "@/hooks/useCredits";
import { useSelection } from "@/hooks/useSelection";
import { useCockpitContacts, type CockpitContact } from "@/hooks/useCockpitContacts";
import { useClientAssignments, useAssignClient } from "@/hooks/useClientAssignments";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";
import type { CockpitAIAction, SourceTab } from "@/components/cockpit/TopCommandBar";
import type { AssignmentInfo } from "@/components/cockpit/CockpitContactCard";
import type { ViewMode, DraftState, DraftChannel, LinkedInProfileData } from "@/pages/Cockpit";

import { useCockpitViewState } from "@/hooks/useCockpitViewState";
import { useCockpitDragDrop } from "@/hooks/useCockpitDragDrop";
import { useBulkContactActions } from "@/hooks/useBulkContactActions";

export function useCockpitLogic() {
  useAutoConnect();

  const viewState = useCockpitViewState();
  const { sourceTab, setActiveFilters, setViewMode } = viewState;

  const [draftState, setDraftState] = useState<DraftState>({
    channel: null, contactId: null, contactName: null, contactEmail: null, contactPhone: null,
    contactLinkedinUrl: null, companyName: null, countryCode: null, subject: "", body: "", language: "english",
    isGenerating: false, scrapingPhase: "idle", linkedinProfile: null,
  });

  const { filters: gf } = useGlobalFilters();
  const searchQuery = gf.search;

  const { contacts: allContacts, contactsMap, isLoading } = useCockpitContacts();
  const contacts = useMemo(() => {
    if (sourceTab === "all") return allContacts;
    const originMap: Record<string, string> = { wca: "wca", prospect: "report_aziende", contact: "import", bca: "bca" };
    return allContacts.filter(c => c.origin === originMap[sourceTab]);
  }, [allContacts, sourceTab]);

  const selection = useSelection(contacts);
  const preselectionDone = useRef(false);

  // Auto-preselect contacts that were just sent to cockpit from Network/CRM
  useEffect(() => {
    if (preselectionDone.current || isLoading || contacts.length === 0) return;
    preselectionDone.current = true;
    import("@/lib/cockpitPreselection").then(({ consumeCockpitPreselection }) => {
      const pendingIds = consumeCockpitPreselection();
      if (pendingIds.length === 0) return;
      const matchingIds = contacts
        .filter(c => pendingIds.includes(c.sourceId))
        .map(c => c.id);
      if (matchingIds.length > 0) {
        selection.addBatch(matchingIds);
      }
    });
  }, [isLoading, contacts]); // eslint-disable-line react-hooks/exhaustive-deps

  const { generate } = useOutreachGenerator();
  const { refetch: refetchCredits } = useCredits();
  const liBridge = useLinkedInExtensionBridge();
  const linkedInLookup = useLinkedInLookup();
  const { agents } = useAgents();
  const { data: allAssignments } = useClientAssignments();
  const assignClient = useAssignClient();

  const dragDrop = useCockpitDragDrop({
    selectedIds: selection.selectedIds,
    selectionCount: selection.count,
  });
  const { getDraggedIds } = dragDrop;

  const bulkActions = useBulkContactActions({
    contactsMap,
    selection,
    linkedInLookup,
  });

  const assignmentInfoMap = useMemo(() => {
    const map = new Map<string, AssignmentInfo>();
    if (!allAssignments || !agents.length) return map;
    for (const a of allAssignments) {
      const agent = agents.find(ag => ag.id === a.agent_id);
      if (agent) {
        map.set(a.source_id, { agentName: agent.name, agentAvatar: agent.avatar_emoji, managerName: undefined });
      }
    }
    return map;
  }, [allAssignments, agents]);

  const autoAssign = useCallback(async (sourceId: string, sourceType: string) => {
    if (assignmentInfoMap.has(sourceId)) return;
    const salesAgent = agents.find(a => a.is_active && (a.role === "sales" || a.role === "outreach")) || agents.find(a => a.is_active);
    if (!salesAgent) return;
    try { await assignClient.mutateAsync({ sourceId, sourceType, agentId: salesAgent.id }); } catch (e) { console.error("[CockpitLogic] auto-assign failed:", e); }
  }, [agents, assignmentInfoMap, assignClient]);

  // AI Action Executor
  const executeAIActions = useCallback((actions: CockpitAIAction[], message: string) => {
    for (const action of actions) {
      switch (action.type) {
        case "filter": if (action.filters) setActiveFilters(action.filters); break;
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
          if (contact) toast.info(`${action.action === "deep_search" ? "Deep Search" : "Genera Alias"} per ${contact.name}`);
          else toast.error(`Contatto "${action.contactName}" non trovato`);
          break;
        }
        case "view_mode": if (action.mode) setViewMode(action.mode); break;
        case "auto_outreach": {
          const names = action.contactNames || [];
          const matchIds = contacts.filter(c => names.some(n => c.name.toLowerCase().includes(n.toLowerCase()))).map(c => c.id);
          if (matchIds.length > 0) { selection.addBatch(matchIds); toast.info(`Outreach ${action.channel} per ${matchIds.length} contatti — trascina sulle drop zone`); }
          break;
        }
      }
    }
    if (message) toast.success(message);
  }, [selection, contacts, setActiveFilters, setViewMode]);

  const handleDrop = useCallback(async (channel: DraftChannel, _contactId: string, _contactName: string) => {
    const ids = getDraggedIds();
    if (ids.length === 0) return;
    const firstId = ids[0];
    const contact = contactsMap[firstId];
    if (!contact) return;

    const sourceType = contact.origin === "report_aziende" ? "prospect" : contact.origin === "import" ? "contact" : "partner";
    autoAssign(contact.partnerId || contact.sourceId, sourceType);
    if (ids.length > 1) toast.info(`Generazione per ${ids.length} contatti — primo: ${contact.name}`);

    let linkedinUrl = contact.linkedinUrl || null;
    const isLinkedInChannel = channel === "linkedin";

    let liAuthOk = false;
    if (isLinkedInChannel && liBridge.isAvailable) {
      const authCheck = await liBridge.ensureAuthenticated(30000);
      liAuthOk = authCheck.ok;
      if (!liAuthOk) toast.error("LinkedIn non autenticato. Accedi a LinkedIn nel browser e riprova.");
    }

    if (isLinkedInChannel && liAuthOk && linkedinUrl) {
      toast.info(`URL LinkedIn già presente — lettura profilo diretta`);
      setDraftState({ channel, contactId: firstId, contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone, contactLinkedinUrl: linkedinUrl, companyName: contact.company, countryCode: contact.country, subject: "", body: "", language: contact.language, isGenerating: true, scrapingPhase: "visiting", linkedinProfile: null, searchLog: [] });
    } else if (isLinkedInChannel && liAuthOk && !linkedinUrl) {
      setDraftState({ channel, contactId: firstId, contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone, contactLinkedinUrl: null, companyName: contact.company, countryCode: contact.country, subject: "", body: "", language: contact.language, isGenerating: true, scrapingPhase: "searching", linkedinProfile: null, searchLog: [] });
      const searchResult = await linkedInLookup.searchSingle({ name: contact.name, company: contact.company, email: contact.email, role: contact.role, country: contact.country, sourceType: contact.sourceType, sourceId: contact.sourceId });
      if (searchResult.url) { linkedinUrl = searchResult.url; toast.success(`Profilo LinkedIn trovato: ${searchResult.profile?.name || linkedinUrl}`); }
      else toast.info("Profilo LinkedIn non trovato — generazione con dati DB");
      setDraftState(prev => ({ ...prev, contactLinkedinUrl: linkedinUrl, searchLog: searchResult.searchLog }));
    }

    const canScrapeLinkedIn = isLinkedInChannel && liAuthOk && linkedinUrl;

    if (!isLinkedInChannel || !liBridge.isAvailable || linkedinUrl) {
      setDraftState(prev => ({ ...prev, channel, contactId: firstId, contactName: contact.name, contactEmail: contact.email, contactPhone: contact.phone, contactLinkedinUrl: linkedinUrl, companyName: contact.company, countryCode: contact.country, subject: "", body: "", language: contact.language, isGenerating: true, scrapingPhase: canScrapeLinkedIn ? "visiting" : "generating", linkedinProfile: null }));
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "generating", linkedinProfile: null }));
    }

    let scrapedProfile: LinkedInProfileData | null = null;

    if (canScrapeLinkedIn) {
      try {
        setDraftState(prev => ({ ...prev, scrapingPhase: "visiting" }));
        await new Promise(r => setTimeout(r, 800));
        setDraftState(prev => ({ ...prev, scrapingPhase: "extracting" }));
        const profileResult = await liBridge.extractProfile(linkedinUrl!);
        if (profileResult.success && profileResult.profile) {
          scrapedProfile = { ...profileResult.profile, connectionStatus: (profileResult.profile as any).connectionStatus || "unknown" };
          setDraftState(prev => ({ ...prev, scrapingPhase: "enriching", linkedinProfile: scrapedProfile }));

          // Save to DB in background
          import("@/integrations/supabase/client").then(async ({ supabase: sb }) => {
            try {
              const { data: partnerRows } = await sb.from("partners").select("id, enrichment_data").ilike("company_name", `%${contact.company}%`).limit(1);
              if (partnerRows?.[0]) {
                const existing = (partnerRows[0].enrichment_data as Record<string, any>) || {};
                await sb.from("partners").update({ enrichment_data: { ...existing, linkedin_profile_name: scrapedProfile?.name, linkedin_profile_headline: scrapedProfile?.headline, linkedin_profile_location: scrapedProfile?.location, linkedin_profile_about: scrapedProfile?.about?.slice(0, 2000), linkedin_profile_url: scrapedProfile?.profileUrl, linkedin_scraped_at: new Date().toISOString(), linkedin_summary: [scrapedProfile?.name, scrapedProfile?.headline, scrapedProfile?.about?.slice(0, 500)].filter(Boolean).join(" — ") } }).eq("id", partnerRows[0].id);
              }
            } catch (e) { console.error("Failed to save LinkedIn profile to DB:", e); }
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

    if (canScrapeLinkedIn && scrapedProfile) {
      setDraftState(prev => ({ ...prev, scrapingPhase: "reviewing", linkedinProfile: scrapedProfile, isGenerating: false }));
      return;
    }

    setDraftState(prev => ({ ...prev, scrapingPhase: "generating" }));
    const result = await generate({ channel, contact_name: contact.name, contact_email: contact.email, company_name: contact.company, country_code: contact.country, goal: "Proposta di collaborazione nel freight forwarding", quality: "standard", linkedin_profile: scrapedProfile || undefined });
    if (result) {
      setDraftState(prev => ({ ...prev, subject: result.subject || "", body: result.body || "", language: result.language || prev.language, isGenerating: false, scrapingPhase: "idle", _debug: result._debug }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false, scrapingPhase: "idle" }));
    }
  }, [generate, refetchCredits, getDraggedIds, contactsMap, liBridge, autoAssign, linkedInLookup]);

  const handleGenerateAfterReview = useCallback(async () => {
    if (!draftState.contactId) return;
    const contact = contactsMap[draftState.contactId];
    if (!contact) return;
    setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "generating" }));
    const result = await generate({ channel: draftState.channel!, contact_name: contact.name, contact_email: contact.email, company_name: contact.company, country_code: contact.country, goal: "Proposta di collaborazione nel freight forwarding", quality: "standard", linkedin_profile: draftState.linkedinProfile || undefined });
    if (result) {
      setDraftState(prev => ({ ...prev, subject: result.subject || "", body: result.body || "", language: result.language || prev.language, isGenerating: false, scrapingPhase: "idle", _debug: result._debug }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false, scrapingPhase: "idle" }));
    }
  }, [draftState, generate, refetchCredits, contactsMap]);

  const handleRegenerate = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId) return;
    setDraftState(prev => ({ ...prev, subject: "", body: "", isGenerating: true }));
    const contact = contactsMap[draftState.contactId];
    const result = await generate({ channel: draftState.channel, contact_name: draftState.contactName || "", contact_email: contact?.email, company_name: contact?.company || "", country_code: contact?.country, goal: "Proposta di collaborazione nel freight forwarding", quality: "standard" });
    if (result) {
      setDraftState(prev => ({ ...prev, subject: result.subject || "", body: result.body || "", language: result.language || prev.language, isGenerating: false, _debug: result._debug }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [draftState, generate, refetchCredits, contactsMap]);

  const contactsForAI = useMemo(() =>
    contacts.map(c => ({ id: c.id, name: c.name, company: c.company, country: c.country, priority: c.priority, language: c.language, channels: c.channels })),
  [contacts]);

  return {
    viewMode: viewState.viewMode, setViewMode: viewState.setViewMode,
    sourceTab: viewState.sourceTab, setSourceTab: viewState.setSourceTab,
    activeFilters: viewState.activeFilters, handleRemoveFilter: viewState.handleRemoveFilter,
    executeAIActions,
    batchMode: viewState.batchMode, setBatchMode: viewState.setBatchMode,
    showLinkedInFlow: viewState.showLinkedInFlow, setShowLinkedInFlow: viewState.setShowLinkedInFlow,
    draftState, setDraftState,
    draggedContactId: dragDrop.draggedContactId, dragCount: dragDrop.dragCount,
    handleDragStart: dragDrop.handleDragStart, handleDragEnd: dragDrop.handleDragEnd,
    handleDrop,
    handleGenerateAfterReview, handleRegenerate,
    contacts, contactsMap, isLoading, selection,
    handleBulkDeepSearch: bulkActions.handleBulkDeepSearch,
    handleBulkAlias: bulkActions.handleBulkAlias,
    handleBulkLinkedInLookup: bulkActions.handleBulkLinkedInLookup,
    handleSingleDeepSearch: bulkActions.handleSingleDeepSearch,
    handleSingleAlias: bulkActions.handleSingleAlias,
    handleSingleLinkedInLookup: bulkActions.handleSingleLinkedInLookup,
    handleBulkDelete: bulkActions.handleBulkDelete,
    confirmBulkDelete: bulkActions.confirmBulkDelete,
    showDeleteConfirm: bulkActions.showDeleteConfirm,
    setShowDeleteConfirm: bulkActions.setShowDeleteConfirm,
    contactsForAI, searchQuery, linkedInLookup, assignmentInfoMap,
  };
}
