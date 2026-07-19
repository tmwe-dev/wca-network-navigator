/**
 * useAddContactForm — All state + async logic for AddContactDialog.
 * Costanti, helper puri e reducer estratti in `useAddContactForm/*` per LOC budget.
 */
import { useReducer, useCallback } from "react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { useAuth } from "@/providers/AuthProvider";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { unwrapGoogleResultUrl } from "@/lib/linkedinSearch";
import { insertContacts } from "@/data/contacts";
import { reducer, initialState } from "./useAddContactForm/reducer";
import type { ContactFormData, GoogleSearchResult } from "./useAddContactForm/reducer";
import {
  extractDomain,
  extractDomainFromEmail,
  isUsefulCompanyUrl,
  getSearchResultDescription,
  buildGoogleFaviconUrl,
} from "./useAddContactForm/helpers";

export { COUNTRY_OPTIONS } from "./useAddContactForm/constants";
export { extractDomain, buildGoogleFaviconUrl } from "./useAddContactForm/helpers";
export type { ContactFormData, GoogleSearchResult, AddContactState } from "./useAddContactForm/reducer";

const log = createLogger("AddContactDialog");

// ── Hook ─────────────────────────────────────────────────────────────

export function useAddContactForm() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { form, ui } = state;

  const fsBridge = useFireScrapeExtensionBridge();
  const deepSearch = useDeepSearch();
  const linkedinLookup = useLinkedInLookup();

  // ── Named actions ──

  const setField = useCallback((field: keyof ContactFormData, value: string) => {
    dispatch({ type: "SET_FIELD", field, value });
  }, []);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  // ── Persist helper ──

  const persistSavedContact = useCallback(async (
    fields: Record<string, string | null>,
    enrichmentPatch: Record<string, string>,
  ) => {
    if (!ui.savedId) return;
    if (Object.keys(enrichmentPatch).length > 0) {
      const { updateContactEnrichment } = await import("@/data/contacts");
      await updateContactEnrichment(ui.savedId, enrichmentPatch);
      const plainFields = { ...fields };
      if (Object.keys(plainFields).length > 0) {
        const { updateContact } = await import("@/data/contacts");
        await updateContact(ui.savedId, plainFields);
      }
      return;
    }
    if (Object.keys(fields).length === 0) return;
    const { updateContact } = await import("@/data/contacts");
    try {
      await updateContact(ui.savedId, fields);
    } catch (e: unknown) {
      log.warn("persist update failed", { message: e instanceof Error ? e.message : String(e) });
    }
  }, [ui.savedId]);

  // ── Extension check ──

  const ensurePartnerConnectReady = useCallback(async () => {
    if (fsBridge.isAvailable) return true;
    try {
      const ping = await fsBridge.sendMessage("ping", {}, 4000);
      if (ping?.success) return true;
      toast.error("Estensione Partner Connect non disponibile");
      return false;
    } catch (e: unknown) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Estensione Partner Connect non disponibile");
      return false;
    }
  }, [fsBridge]);

  // ── Apply Google result ──

  const applyPlacesResult = useCallback((result: GoogleSearchResult) => {
    const persistedFields: Record<string, string | null> = {};
    const enrichmentPatch: Record<string, string> = {};

    if (result.title) {
      const parts = result.title.split(" - ");
      const resolvedCompanyName = parts[0]?.trim();
      if (resolvedCompanyName && !form.companyName) {
        dispatch({ type: "SET_FIELD", field: "companyName", value: resolvedCompanyName });
        persistedFields.company_name = resolvedCompanyName;
      }
    }

    const unwrappedUrl = unwrapGoogleResultUrl(result.url) || result.url || "";
    if (unwrappedUrl && !form.website && isUsefulCompanyUrl(unwrappedUrl)) {
      const domain = extractDomain(unwrappedUrl);
      dispatch({ type: "BATCH_FORM", payload: { website: unwrappedUrl, logoUrl: buildGoogleFaviconUrl(domain) } });
      enrichmentPatch.website = unwrappedUrl;
      enrichmentPatch.logo_url = buildGoogleFaviconUrl(domain);
    }

    const description = getSearchResultDescription(result);
    if (description) {
      const phoneMatch = description.match(/(\+?\d[\d\s\-().]{7,})/);
      if (phoneMatch && !form.companyPhone) {
        const resolvedPhone = phoneMatch[1].trim();
        dispatch({ type: "SET_FIELD", field: "companyPhone", value: resolvedPhone });
        persistedFields.phone = resolvedPhone;
      }
      const emailMatch = description.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
      if (emailMatch && !form.companyEmail) {
        const resolvedEmail = emailMatch[0];
        dispatch({ type: "SET_FIELD", field: "companyEmail", value: resolvedEmail });
        if (!form.contactEmail) persistedFields.email = resolvedEmail;
      }
      const nextNote = form.note ? `${form.note}\n${description}` : description;
      dispatch({ type: "SET_FIELD", field: "note", value: nextNote });
      persistedFields.note = nextNote;
    }

    dispatch({ type: "SET_PLACES_RESULTS", payload: [] });
    void persistSavedContact(persistedFields, enrichmentPatch);
    toast.success("Dati applicati dal risultato");
  }, [form.companyName, form.website, form.companyPhone, form.companyEmail, form.contactEmail, form.note, persistSavedContact]);

  // ── Google search ──

  const handlePlacesSearch = useCallback(async () => {
    if (!form.companyName.trim()) { toast.error("Inserisci il nome dell'azienda"); return; }
    if (!(await ensurePartnerConnectReady())) return;
    dispatch({ type: "SET_PLACES_LOADING", payload: true });
    try {
      const query = [form.companyName.trim(), form.contactName.trim(), "company", "address", "phone", "email", "website"]
        .filter(Boolean).join(" ");
      const res = await fsBridge.googleSearch(query, 8, true);
      const raw = Array.isArray(res.data) ? res.data : [];
      const normalizedResults: GoogleSearchResult[] = raw.map((item: Record<string, unknown>) => ({
        title: String(item.title || ""),
        url: unwrapGoogleResultUrl(String(item.url || "")) || String(item.url || ""),
        description: String((item as Record<string, unknown>).description || (item as Record<string, unknown>).snippet || "").trim(),
      }));
      if (res.success && normalizedResults.length > 0) {
        dispatch({ type: "SET_PLACES_RESULTS", payload: normalizedResults });
      } else {
        toast.info("Nessun risultato trovato");
      }
    } catch (e: unknown) {
      toast.error("Errore ricerca: " + (e instanceof Error ? e.message : "sconosciuto"));
    } finally {
      dispatch({ type: "SET_PLACES_LOADING", payload: false });
    }
  }, [form.companyName, form.contactName, ensurePartnerConnectReady, fsBridge]);

  // ── Logo search ──

  const handleLogoSearch = useCallback(async () => {
    const derivedDomain = extractDomain(form.website) || extractDomainFromEmail(form.contactEmail || form.companyEmail);
    if (derivedDomain) {
      const nextLogoUrl = buildGoogleFaviconUrl(derivedDomain);
      dispatch({ type: "SET_FIELD", field: "logoUrl", value: nextLogoUrl });
      if (!form.website) dispatch({ type: "SET_FIELD", field: "website", value: `https://${derivedDomain}` });
      void persistSavedContact({}, {
        logo_url: nextLogoUrl,
        ...(form.website ? {} : { website: `https://${derivedDomain}` }),
      });
      toast.success("Logo recuperato dal dominio aziendale");
      return;
    }
    if (!form.companyName.trim()) { toast.error("Inserisci il nome dell'azienda o il sito web"); return; }
    if (!(await ensurePartnerConnectReady())) return;
    dispatch({ type: "SET_LOGO_LOADING", payload: true });
    try {
      const res = await fsBridge.googleSearch(`${form.companyName.trim()} official website`, 3, true);
      const raw = Array.isArray(res.data) ? res.data : [];
      const normalizedResults = raw.map((item: Record<string, unknown>) => ({
        title: String(item.title || ""),
        url: unwrapGoogleResultUrl(String(item.url || "")) || String(item.url || ""),
        description: "",
      }));
      const siteResult = normalizedResults.find((item) => isUsefulCompanyUrl(item.url));
      if (res.success && siteResult?.url) {
        const domain = extractDomain(siteResult.url);
        const nextLogoUrl = buildGoogleFaviconUrl(domain);
        dispatch({ type: "BATCH_FORM", payload: { logoUrl: nextLogoUrl, website: siteResult.url } });
        void persistSavedContact({}, { logo_url: nextLogoUrl, website: siteResult.url });
        toast.success("Logo trovato dal sito aziendale");
      } else {
        toast.info("Nessun sito web trovato per il logo");
      }
    } catch (e: unknown) {
      toast.error("Errore ricerca logo: " + (e instanceof Error ? e.message : "sconosciuto"));
    } finally {
      dispatch({ type: "SET_LOGO_LOADING", payload: false });
    }
  }, [form.companyEmail, form.companyName, form.contactEmail, form.website, ensurePartnerConnectReady, fsBridge, persistSavedContact]);

  // ── LinkedIn search ──

  const handleLinkedInSearch = useCallback(async () => {
    if (!form.contactName.trim() && !form.companyName.trim()) {
      toast.error("Inserisci almeno nome contatto o azienda"); return;
    }
    if (!(await ensurePartnerConnectReady())) return;
    dispatch({ type: "SET_LINKEDIN_LOADING", payload: true });
    try {
      if (form.contactName.trim()) {
        const result = await linkedinLookup.searchSingle({
          name: form.contactName.trim(),
          company: form.companyName.trim() || null,
          email: form.contactEmail.trim() || form.companyEmail.trim() || null,
          role: form.position.trim() || null,
          country: form.country || null,
          sourceType: ui.savedId ? "contact" : undefined,
          sourceId: ui.savedId || undefined,
        });
        if (result.url) {
          dispatch({ type: "SET_FIELD", field: "linkedinUrl", value: result.url });
          void persistSavedContact({}, {
            linkedin_url: result.url,
            linkedin_profile_url: result.url,
            linkedin_resolved_method: result.resolvedMethod || "",
          });
          toast.success("Profilo LinkedIn trovato");
          return;
        }
      }
      const companyResult = await fsBridge.googleSearch(`"${form.companyName.trim()}" site:linkedin.com/company`, 3, true);
      const raw = Array.isArray(companyResult.data) ? companyResult.data : [];
      const normalizedCompanyResults = raw.map((item: Record<string, unknown>) => ({
        title: String(item.title || ""),
        url: unwrapGoogleResultUrl(String(item.url || "")) || String(item.url || ""),
        description: "",
      }));
      const companyMatch = normalizedCompanyResults.find((item) => item.url?.includes("linkedin.com/company/"));
      if (companyResult.success && companyMatch?.url) {
        dispatch({ type: "SET_FIELD", field: "linkedinUrl", value: companyMatch.url });
        void persistSavedContact({}, { linkedin_url: companyMatch.url, linkedin_company_url: companyMatch.url });
        toast.success("Pagina LinkedIn aziendale trovata");
      } else {
        toast.info("Nessun profilo LinkedIn trovato");
      }
    } catch (e: unknown) {
      toast.error("Errore ricerca LinkedIn: " + (e instanceof Error ? e.message : "sconosciuto"));
    } finally {
      dispatch({ type: "SET_LINKEDIN_LOADING", payload: false });
    }
  }, [form.companyEmail, form.companyName, form.contactEmail, form.contactName, form.country, form.position, ui.savedId, ensurePartnerConnectReady, fsBridge, linkedinLookup, persistSavedContact]);

  // ── Deep Search ──

  const handleDeepSearch = useCallback(async () => {
    if (!ui.savedId) { toast.error("Salva prima il contatto, poi avvia la Deep Search"); return; }
    if (!(await ensurePartnerConnectReady())) return;
    deepSearch.start([ui.savedId], true, "contact");
    toast.success("Deep Search avviata dal sistema");
  }, [deepSearch, ensurePartnerConnectReady, ui.savedId]);

  // ── Save ──

  const { user } = useAuth();

  const handleSave = useCallback(async () => {
    if (!form.companyName.trim()) { toast.error("Il nome azienda è obbligatorio"); return; }
    dispatch({ type: "SET_SAVING", payload: true });
    try {
      if (!user) { toast.error("Non autenticato"); return; }

      const { findOrCreateManualImportLog } = await import("@/data/importLogs");
      const importLogId = await findOrCreateManualImportLog(user.id);

      const enrichmentData: Record<string, string> = {};
      if (form.linkedinUrl) enrichmentData.linkedin_url = form.linkedinUrl;
      if (form.logoUrl) enrichmentData.logo_url = form.logoUrl;
      if (form.website) enrichmentData.website = form.website;

      await insertContacts([{
        user_id: user.id, import_log_id: importLogId,
        company_name: form.companyName.trim(),
        company_alias: form.companyAlias.trim() || null,
        name: form.contactName.trim() || null,
        contact_alias: form.contactAlias.trim() || null,
        email: form.contactEmail.trim() || form.companyEmail.trim() || null,
        phone: form.contactPhone.trim() || form.companyPhone.trim() || null,
        mobile: form.contactMobile.trim() || null,
        position: form.position.trim() || null,
        country: form.country || null,
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        zip_code: form.zipCode.trim() || null,
        origin: form.origin.trim() || "manual",
        note: form.note.trim() || null,
        lead_status: "new",
        row_number: 0,
        enrichment_data: Object.keys(enrichmentData).length > 0 ? enrichmentData : null,
      }]);

      toast.success("Contatto salvato! Ora i tool scrivono direttamente sul record.");
    } catch (e: unknown) {
      toast.error("Errore: " + (e instanceof Error ? e.message : "sconosciuto"));
    } finally {
      dispatch({ type: "SET_SAVING", payload: false });
    }
  }, [form, user]);

  return {
    state,
    dispatch,
    setField,
    reset,
    // Enrichment actions
    applyPlacesResult,
    handlePlacesSearch,
    handleLogoSearch,
    handleLinkedInSearch,
    handleDeepSearch,
    // Save
    handleSave,
    // External hooks exposed
    fsBridgeAvailable: fsBridge.isAvailable,
    deepSearchRunning: deepSearch.running,
  };
}
