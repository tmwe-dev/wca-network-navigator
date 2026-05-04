import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useEmailForge, type ForgeResult } from "@/v2/hooks/useEmailForge";
import { useComposeAiConfig } from "@/contexts/ComposeAiConfigContext";
import { useForgeLab } from "@/v2/hooks/useForgeLabStore";
import { briefToText } from "@/components/email/BriefAccordion";
import { useLinkedInExtensionBridge } from "@/hooks/useLinkedInExtensionBridge";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useCredits } from "@/hooks/useCredits";
import { useSelection } from "@/hooks/useSelection";
import { useCockpitContacts, useDeleteCockpitContacts, type CockpitContact } from "@/hooks/useCockpitContacts";
import { createLogger } from "@/lib/log";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";

const log = createLogger("useCockpitLogic");
import { useClientAssignments, useAssignClient } from "@/hooks/useClientAssignments";
import { useAgents } from "@/hooks/useAgents";
import { toast } from "sonner";
import type { CockpitAIAction, SourceTab } from "@/components/cockpit/TopCommandBar";
import type { AssignmentInfo } from "@/components/cockpit/CockpitContactCard";
import type { ViewMode, DraftState, DraftChannel, LinkedInProfileData } from "@/types/cockpit";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Lookup a LinkedIn profile URL via Google search (Partner Connect).
 * This replaces direct LinkedIn scraping to avoid TOS violations.
 * Returns enrichment_data to store in DB, NOT extracted profile data.
 */
async function lookupLinkedInProfileUrl(
  linkedinLookup: ReturnType<typeof useLinkedInLookup>,
  contactName: string,
  company: string | null | undefined,
  email: string | null | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  if (signal.aborted) return null;

  const searchResult = await linkedinLookup.searchSingle({
    name: contactName,
    company: company || undefined,
    email: email || undefined,
  });

  if (signal.aborted) return null;
  return searchResult.url || null;
}

export function useCockpitLogic() {
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sourceTab, setSourceTab] = useState<SourceTab>("all");
  const [activeFilters, setActiveFilters] = useState<import("@/types/cockpit").CockpitFilter[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [showLinkedInFlow, setShowLinkedInFlow] = useState(false);
  const [draftState, setDraftState] = useState<DraftState>({
    channel: null, contactId: null, contactName: null, contactEmail: null, contactPhone: null,
    contactLinkedinUrl: null, companyName: null, countryCode: null, subject: "", body: "", language: "english",
    isGenerating: false, scrapingPhase: "idle", linkedinProfile: null,
  });
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // IDs di contatti aggiuntivi droppati in batch, in attesa di generazione manuale
  const [pendingBulkIds, setPendingBulkIds] = useState<string[]>([]);
  const { filters: gf } = useGlobalFilters();
  const searchQuery = gf.search;

  // Abort & mount guards
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

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
      if (!mountedRef.current) return;
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

  const cfg = useComposeAiConfig();
  const lab = useForgeLab();
  const forge = useEmailForge();
  const [draftQueue, setDraftQueue] = useState<Array<{ contactId: string; contactName: string; result: ForgeResult }>>([]);
  const { refetch: refetchCredits } = useCredits();

  /**
   * Shim che instrada la generazione attraverso `useEmailForge` (edge `generate-email`),
   * iniettando la configurazione del pannello laterale (tipo email, tono, brief, KB,
   * quality → Scout/Detective/Sherlock). Pipeline UNICA con Email Forge e Composer.
   */
  const generate = useCallback(async (params: {
    channel: DraftChannel;
    contact_name: string;
    contact_email?: string | null;
    company_name?: string | null;
    country_code?: string | null;
    partner_id?: string | null;
    contact_id?: string | null;
    linkedin_profile?: LinkedInProfileData | null;
  }): Promise<ForgeResult | null> => {
    const goalParts: string[] = [];
    if (cfg.customGoal.trim()) goalParts.push(cfg.customGoal.trim());
    if (cfg.selectedType?.prompt) goalParts.push(cfg.selectedType.prompt);
    return await forge.run({
      partner_id: params.partner_id ?? null,
      contact_id: params.contact_id ?? null,
      recipient_name: params.contact_name,
      recipient_company: params.company_name ?? "",
      recipient_countries: params.country_code ?? "",
      oracle_type: cfg.selectedType?.id,
      oracle_tone: cfg.tone,
      use_kb: cfg.useKB,
      goal: goalParts.join("\n\n"),
      base_proposal: briefToText(cfg.brief) || undefined,
      quality: lab.quality,
      email_type_prompt: cfg.selectedType?.prompt ?? null,
      email_type_structure: cfg.selectedType?.structure ?? null,
      email_type_kb_categories: cfg.selectedType?.kb_categories,
    });
  }, [cfg, lab.quality, forge]);
  const deleteContacts = useDeleteCockpitContacts();
  const liBridge = useLinkedInExtensionBridge();
  const linkedInLookup = useLinkedInLookup();
  const { agents } = useAgents();
  const { data: allAssignments } = useClientAssignments();
  const assignClient = useAssignClient();
  const queryClient = useQueryClient();

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
    try { await assignClient.mutateAsync({ sourceId, sourceType, agentId: salesAgent.id }); } catch (e: unknown) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); }
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
            const fieldVal = (c as unknown as Record<string, unknown>)[field!];
            if (operator === ">=") return (fieldVal as number) >= (value as number);
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

  /**
   * Drop di un contatto su un canale: NON avvia la generazione AI.
   * Carica solo il workspace (canale, destinatario, lingua) e azzera la bozza,
   * lasciando all'utente il tempo di configurare obiettivo/tipo/tono prima di
   * cliccare il tasto "Genera". Per il bulk, gli ID restano in coda di attesa.
   */
  const handleDrop = useCallback((channel: DraftChannel, _contactId: string, _contactName: string) => {
    // Annulla eventuali generazioni in corso
    abortRef.current?.abort();

    const ids = getDraggedIds();
    if (ids.length === 0) return;
    const firstId = ids[0];
    const contact = contactsMap[firstId];
    if (!contact) return;

    const sourceType = contact.origin === "report_aziende" ? "prospect" : contact.origin === "import" ? "contact" : "partner";
    autoAssign(contact.partnerId || contact.sourceId, sourceType);

    // Reset coda bulk e draft, prepara il workspace
    setDraftQueue([]);
    setPendingBulkIds(ids.length > 1 ? ids.slice(1) : []);
    setDraftState({
      channel,
      contactId: firstId,
      contactName: contact.name,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      contactLinkedinUrl: contact.linkedinUrl || null,
      companyName: contact.company,
      countryCode: contact.country,
      subject: "",
      body: "",
      language: contact.language,
      isGenerating: false,
      scrapingPhase: "idle",
      linkedinProfile: null,
    });

    if (ids.length > 1) {
      toast.info(`${ids.length} contatti pronti — configura obiettivo e premi Genera`);
    } else {
      toast.info(`${contact.name} pronto — configura obiettivo e premi Genera`);
    }
  }, [getDraggedIds, contactsMap, autoAssign]);

  /**
   * Avvia la generazione AI per il destinatario corrente (e per la coda bulk
   * eventualmente accumulata dal drop). Da chiamare al click del tasto "Genera".
   */
  const handleStartGeneration = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId) {
      toast.error("Trascina prima un contatto su un canale");
      return;
    }
    const contact = contactsMap[draftState.contactId];
    if (!contact) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    const channel = draftState.channel;
    const isLinkedInChannel = channel === "linkedin";
    let linkedinUrl = contact.linkedinUrl || null;

    // LinkedIn: auth + lookup URL prima della generazione
    let liAuthOk = false;
    if (isLinkedInChannel && liBridge.isAvailable) {
      const authCheck = await liBridge.ensureAuthenticated(30000);
      if (signal.aborted) return;
      liAuthOk = authCheck.ok;
      if (!liAuthOk) toast.error("LinkedIn non autenticato. Accedi a LinkedIn nel browser e riprova.");
    }
    if (signal.aborted) return;

    if (isLinkedInChannel && liAuthOk && linkedinUrl) {
      toast.info(`URL LinkedIn già presente — lettura profilo diretta`);
      setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "visiting", searchLog: [] }));
    } else if (isLinkedInChannel && liAuthOk && !linkedinUrl) {
      setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "searching", searchLog: [] }));
      const searchResult = await linkedInLookup.searchSingle({ name: contact.name, company: contact.company, email: contact.email, role: contact.role, country: contact.country, sourceType: contact.sourceType, sourceId: contact.sourceId });
      if (signal.aborted) return;
      if (searchResult.url) { linkedinUrl = searchResult.url; toast.success(`Profilo LinkedIn trovato: ${searchResult.profile?.name || linkedinUrl}`); }
      else toast.info("Profilo LinkedIn non trovato — generazione con dati DB");
      setDraftState(prev => ({ ...prev, contactLinkedinUrl: linkedinUrl, searchLog: searchResult.searchLog }));
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "generating", linkedinProfile: null }));
    }

    if (signal.aborted) return;
    setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "generating", contactLinkedinUrl: linkedinUrl }));

    // Salva URL LinkedIn in background se trovato
    if (isLinkedInChannel && linkedinUrl) {
      import("@/integrations/supabase/client").then(async ({ supabase: sb }) => {
        if (!mountedRef.current || !linkedinUrl) return;
        try {
          const { data: partnerRows } = await sb.from("partners").select("id, enrichment_data").ilike("company_name", `%${contact.company}%`).limit(1);
          if (partnerRows?.[0]) {
            const existing = (partnerRows[0].enrichment_data as Record<string, unknown>) || {};
            await sb.from("partners").update({ enrichment_data: { ...existing, linkedin_profile_url: linkedinUrl, linkedin_lookup_at: new Date().toISOString(), linkedin_resolved_method: "google_search" } }).eq("id", partnerRows[0].id);
          }
        } catch (e: unknown) { log.error("save linkedin url failed", { message: e instanceof Error ? e.message : String(e) }); }
      });
    }

    const result = await generate({
      channel,
      contact_name: contact.name,
      contact_email: contact.email,
      company_name: contact.company,
      country_code: contact.country,
      partner_id: contact.partnerId ?? null,
      contact_id: contact.sourceType === "contact" ? contact.sourceId : null,
    });
    if (signal.aborted) return;
    if (result) {
      setDraftState(prev => ({
        ...prev,
        subject: result.subject || "",
        body: result.body || "",
        isGenerating: false,
        scrapingPhase: "idle",
        _forgeDebug: result._debug,
        journalist_review: result.journalist_review ?? null,
        type_resolution: result.type_resolution ?? null,
        context_summary: result._context_summary,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false, scrapingPhase: "idle" }));
    }

    // BULK: genera anche per gli altri contatti accumulati nella coda
    if (pendingBulkIds.length > 0 && !signal.aborted) {
      setDraftQueue([]);
      const rest = pendingBulkIds;
      let okCount = 1;
      let errCount = 0;
      for (const id of rest) {
        if (signal.aborted) break;
        const c = contactsMap[id];
        if (!c) { errCount++; continue; }
        try {
          const r = await generate({
            channel,
            contact_name: c.name,
            contact_email: c.email,
            company_name: c.company,
            country_code: c.country,
            partner_id: c.partnerId ?? null,
            contact_id: c.sourceType === "contact" ? c.sourceId : null,
          });
          if (signal.aborted) break;
          if (r) {
            setDraftQueue(prev => [...prev, { contactId: id, contactName: c.name, result: r }]);
            okCount++;
          } else { errCount++; }
        } catch (e: unknown) {
          errCount++;
          log.warn("bulk generate failed", { id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      setPendingBulkIds([]);
      if (!signal.aborted) {
        toast.success(`Bulk generazione completata`, { description: `${okCount}/${rest.length + 1} OK, ${errCount} errori` });
      }
    }
  }, [draftState.channel, draftState.contactId, contactsMap, liBridge, linkedInLookup, generate, refetchCredits, pendingBulkIds]);

  const handleGenerateAfterReview = useCallback(async () => {
    if (!draftState.contactId) return;
    const contact = contactsMap[draftState.contactId];
    if (!contact) return;
    setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "generating" }));
    const result = await generate({
      channel: draftState.channel!,
      contact_name: contact.name,
      contact_email: contact.email,
      company_name: contact.company,
      country_code: contact.country,
      partner_id: contact.partnerId ?? null,
      contact_id: contact.sourceType === "contact" ? contact.sourceId : null,
      linkedin_profile: draftState.linkedinProfile,
    });
    if (result) {
      setDraftState(prev => ({
        ...prev,
        subject: result.subject || "",
        body: result.body || "",
        isGenerating: false,
        scrapingPhase: "idle",
        _forgeDebug: result._debug,
        journalist_review: result.journalist_review ?? null,
        type_resolution: result.type_resolution ?? null,
        context_summary: result._context_summary,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false, scrapingPhase: "idle" }));
    }
  }, [draftState, generate, refetchCredits, contactsMap]);

  const handleRegenerate = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId) return;
    setDraftState(prev => ({ ...prev, subject: "", body: "", isGenerating: true }));
    const contact = contactsMap[draftState.contactId];
    const result = await generate({
      channel: draftState.channel,
      contact_name: draftState.contactName || "",
      contact_email: contact?.email,
      company_name: contact?.company || "",
      country_code: contact?.country,
      partner_id: contact?.partnerId ?? null,
      contact_id: contact?.sourceType === "contact" ? contact?.sourceId : null,
    });
    if (result) {
      setDraftState(prev => ({
        ...prev,
        subject: result.subject || "",
        body: result.body || "",
        isGenerating: false,
        _forgeDebug: result._debug,
        journalist_review: result.journalist_review ?? null,
        type_resolution: result.type_resolution ?? null,
        context_summary: result._context_summary,
      }));
      refetchCredits();
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false }));
    }
  }, [draftState, generate, refetchCredits, contactsMap]);

  const handleImprove = useCallback(async () => {
    if (!draftState.channel || !draftState.contactId || !draftState.body) return;
    const contact = contactsMap[draftState.contactId];
    setDraftState(prev => ({ ...prev, isGenerating: true, scrapingPhase: "generating" }));
    const goalParts: string[] = [];
    if (cfg.customGoal.trim()) goalParts.push(cfg.customGoal.trim());
    if (cfg.selectedType?.prompt) goalParts.push(cfg.selectedType.prompt);
    goalParts.push("MIGLIORA la bozza qui sotto mantenendo voce, intento e personalità dell'autore. Non riscrivere da zero.");
    if (draftState.links && draftState.links.length > 0) {
      const linksList = draftState.links.map(l => `- [${l.label}](${l.url})`).join("\n");
      goalParts.push(`Includi nel testo, in modo naturale e contestuale, i seguenti link (formato HTML <a href>):\n${linksList}`);
    }
    const result = await forge.run({
      partner_id: contact?.partnerId ?? null,
      contact_id: contact?.sourceType === "contact" ? contact?.sourceId ?? null : null,
      recipient_name: draftState.contactName || "",
      recipient_company: contact?.company ?? "",
      recipient_countries: contact?.country ?? "",
      oracle_type: cfg.selectedType?.id,
      oracle_tone: cfg.tone,
      use_kb: cfg.useKB,
      goal: goalParts.join("\n\n"),
      base_proposal: draftState.body,
      quality: lab.quality,
      email_type_prompt: cfg.selectedType?.prompt ?? null,
      email_type_structure: cfg.selectedType?.structure ?? null,
      email_type_kb_categories: cfg.selectedType?.kb_categories,
    });
    if (result) {
      setDraftState(prev => ({
        ...prev,
        subject: result.subject || prev.subject,
        body: result.body || prev.body,
        isGenerating: false,
        scrapingPhase: "idle",
        _forgeDebug: result._debug,
        journalist_review: result.journalist_review ?? prev.journalist_review,
        type_resolution: result.type_resolution ?? prev.type_resolution,
        context_summary: result._context_summary ?? prev.context_summary,
      }));
      refetchCredits();
      toast.success("Bozza migliorata");
    } else {
      setDraftState(prev => ({ ...prev, isGenerating: false, scrapingPhase: "idle" }));
    }
  }, [draftState, contactsMap, cfg, lab.quality, forge, refetchCredits]);

  /** Naviga le bozze bulk: salva quella corrente nella queue (al posto giusto) e carica un'altra. */
  const showQueuedDraft = useCallback((targetContactId: string) => {
    if (!draftState.contactId) return;
    const target = draftQueue.find(q => q.contactId === targetContactId);
    if (!target) return;
    const contact = contactsMap[targetContactId];
    if (!contact) return;
    // Salva la bozza corrente nella queue (replace o insert)
    setDraftQueue(prev => {
      const currentEntry = {
        contactId: draftState.contactId!,
        contactName: draftState.contactName || "",
        result: {
          subject: draftState.subject,
          body: draftState.body,
          full_content: draftState.body,
          partner_name: draftState.companyName,
          contact_email: draftState.contactEmail,
          model: draftState._forgeDebug?.model || "",
          quality: draftState._forgeDebug?.quality || "",
          journalist_review: draftState.journalist_review ?? null,
          type_resolution: draftState.type_resolution ?? null,
          _context_summary: draftState.context_summary,
          _debug: draftState._forgeDebug,
        } as ForgeResult,
      };
      const without = prev.filter(q => q.contactId !== targetContactId && q.contactId !== draftState.contactId);
      return [...without, currentEntry];
    });
    // Carica la bozza target
    setDraftState(prev => ({
      ...prev,
      channel: prev.channel,
      contactId: target.contactId,
      contactName: target.contactName,
      contactEmail: contact.email,
      contactPhone: contact.phone,
      contactLinkedinUrl: contact.linkedinUrl,
      companyName: contact.company,
      countryCode: contact.country,
      subject: target.result.subject || "",
      body: target.result.body || "",
      language: contact.language,
      isGenerating: false,
      scrapingPhase: "idle",
      _forgeDebug: target.result._debug,
      journalist_review: target.result.journalist_review ?? null,
      type_resolution: target.result.type_resolution ?? null,
      context_summary: target.result._context_summary,
    }));
    // Rimuovi la bozza target dalla queue (è ora attiva)
    setDraftQueue(prev => prev.filter(q => q.contactId !== targetContactId));
  }, [draftState, draftQueue, contactsMap]);

  const deepSearch = useDeepSearch();

  /** Estrae gli id reali (imported_contacts.id / partners.id) dai record del cockpit. */
  const resolveDeepIds = useCallback(
    (queueIds: string[]): { contactIds: string[]; partnerIds: string[] } => {
      const contactIds: string[] = [];
      const partnerIds: string[] = [];
      for (const qid of queueIds) {
        const c = contactsMap[qid];
        if (!c) continue;
        if (c.sourceType === "contact" && c.sourceId) contactIds.push(c.sourceId);
        else if (c.partnerId) partnerIds.push(c.partnerId);
      }
      return { contactIds, partnerIds };
    },
    [contactsMap],
  );

  const handleBulkDeepSearch = useCallback(() => {
    const ids = Array.from(selection.selectedIds);
    if (!ids.length) { toast.info("Seleziona almeno un contatto"); return; }
    const { contactIds, partnerIds } = resolveDeepIds(ids);
    if (contactIds.length === 0 && partnerIds.length === 0) {
      toast.error("Nessun contatto o partner valido per Deep Search");
      return;
    }
    if (contactIds.length > 0) deepSearch.start(contactIds, false, "contact");
    else deepSearch.start(partnerIds, false, "partner");
  }, [selection.selectedIds, resolveDeepIds, deepSearch]);

  const handleBulkAlias = useCallback(() => toast.info(`Generazione Alias per ${selection.count} contatti`), [selection.count]);

  const handleBulkLinkedInLookup = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (!ids.length) return;
    const sourceIds = ids.map(id => contactsMap[id]).filter(c => c && c.sourceType === "contact").map(c => c!.sourceId);
    if (!sourceIds.length) { toast.info("Seleziona contatti importati per il LinkedIn Lookup"); return; }
    await linkedInLookup.lookupBatch(sourceIds);
    queryClient.invalidateQueries({ queryKey: queryKeys.cockpit.queue });
  }, [selection.selectedIds, contactsMap, linkedInLookup, queryClient]);

  const handleSingleDeepSearch = useCallback((id: string) => {
    const c = contactsMap[id];
    if (!c) { toast.error("Contatto non trovato"); return; }
    if (c.sourceType === "contact" && c.sourceId) {
      deepSearch.start([c.sourceId], false, "contact");
    } else if (c.partnerId) {
      deepSearch.start([c.partnerId], false, "partner");
    } else {
      toast.error("Deep Search non disponibile per questo record");
    }
  }, [contactsMap, deepSearch]);
  const handleSingleAlias = useCallback((id: string) => toast.info(`Genera Alias per ${contactsMap[id]?.name || id}`), [contactsMap]);
  const handleSingleLinkedInLookup = useCallback((id: string) => {
    const contact = contactsMap[id];
    if (!contact) return;
    if (contact.sourceId) linkedInLookup.lookupBatch([contact.sourceId]);
  }, [contactsMap, linkedInLookup]);

  const handleBulkDelete = useCallback(() => setShowDeleteConfirm(true), []);
  const confirmBulkDelete = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    try {
      const deleted = await deleteContacts.mutateAsync(ids);
      selection.clear();
      const n = typeof deleted === "number" ? deleted : ids.length;
      if (n === 0) toast.warning("Nessun record eliminato (potrebbe non esistere più)");
      else toast.success(`${n} record eliminati`);
    } catch (e: unknown) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Errore durante l'eliminazione");
    }
    setShowDeleteConfirm(false);
  }, [selection, deleteContacts]);

  const contactsForAI = useMemo(() =>
    contacts.map(c => ({ id: c.id, name: c.name, company: c.company, country: c.country, priority: c.priority, language: c.language, channels: c.channels })),
  [contacts]);

  return {
    viewMode, setViewMode, sourceTab, setSourceTab,
    activeFilters, handleRemoveFilter, executeAIActions,
    batchMode, setBatchMode, showLinkedInFlow, setShowLinkedInFlow,
    draftState, setDraftState,
    draggedContactId, dragCount, handleDragStart, handleDragEnd, handleDrop,
    handleGenerateAfterReview, handleRegenerate, handleImprove,
    showQueuedDraft,
    contacts, contactsMap, isLoading, selection,
    handleBulkDeepSearch, handleBulkAlias, handleBulkLinkedInLookup,
    handleSingleDeepSearch, handleSingleAlias, handleSingleLinkedInLookup,
    handleBulkDelete, confirmBulkDelete, showDeleteConfirm, setShowDeleteConfirm,
    contactsForAI, searchQuery, linkedInLookup, assignmentInfoMap,
    draftQueue, setDraftQueue,
  };
}
