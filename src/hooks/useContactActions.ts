import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getContactsByIds, fetchGroupContactIds } from "@/data/contacts";
import { insertCampaignJobs } from "@/data/campaignJobs";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { useUpdateLeadStatus, type ContactFilters, type LeadStatus } from "@/hooks/useContacts";
import { useSelection } from "@/hooks/useSelection";
import type { AICommand } from "@/components/contacts/ContactAIBar";
import type { SortKey } from "@/components/contacts/contactHelpers";
import type { ContactGroupCount } from "@/hooks/useContactGroups";

interface Deps {
  selection: ReturnType<typeof useSelection>;
  setFilters: React.Dispatch<React.SetStateAction<ContactFilters>>;
  setSortKey: (k: SortKey) => void;
  setOpenGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelectedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;
  currentGroupBy: string;
  holdingPattern?: "out" | "in" | "all";
}

export function useContactActions(deps: Deps) {
  const { selection, setFilters, setSortKey, setOpenGroups, setSelectedGroups, currentGroupBy, holdingPattern } = deps;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateLeadStatus = useUpdateLeadStatus();
  const [deepSearchLoading, setDeepSearchLoading] = useState(false);
  const [aliasLoading, setAliasLoading] = useState(false);
  const [linkedInLookupLoading, setLinkedInLookupLoading] = useState(false);

  const invalidateContacts = () => {
    queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
    queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });
  };

  const handleDeepSearch = useCallback(async (contactIds: string[]) => {
    if (deepSearchLoading || !contactIds.length) return;
    setDeepSearchLoading(true);
    toast({ title: "Deep Search disponibile tramite Partner Connect", description: "Usa il pulsante Deep Search nella vista Cockpit o Network per arricchire i contatti tramite l'estensione Partner Connect." });
    setDeepSearchLoading(false);
  }, [deepSearchLoading]);

  const handleGroupDeepSearch = useCallback(async (group: ContactGroupCount) => {
    const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, holdingPattern);
    const limited = ids.slice(0, 20);
    if (limited.length < ids.length) toast({ title: `Deep Search limitata ai primi ${limited.length} contatti su ${ids.length}` });
    await handleDeepSearch(limited);
  }, [currentGroupBy, holdingPattern, handleDeepSearch]);

  const handleGroupAlias = useCallback(async (group: ContactGroupCount) => {
    if (aliasLoading) return;
    setAliasLoading(true);
    try {
      const ids = selection.count > 0 ? Array.from(selection.selectedIds) : await fetchGroupContactIds(currentGroupBy, group.group_key, holdingPattern);
      if (!ids.length) { toast({ title: "Nessun contatto trovato" }); return; }
      toast({ title: `Generazione alias per ${ids.length} contatti...` });
      const data = await invokeEdge<{ processed?: number }>("generate-aliases", {
        body: { contactIds: ids },
        context: "useContactActions.handleGroupAlias",
      });
      const processed = data?.processed || 0;
      toast({ title: processed === 0 ? "Alias già presenti" : "✨ Alias generati", description: processed === 0 ? "Tutti i contatti hanno già un alias" : `${processed} contatti elaborati` });
      invalidateContacts();
    } catch (e: unknown) {
      toast({ title: "Errore generazione alias", description: (e instanceof Error ? e.message : String(e)), variant: "destructive" });
    } finally { setAliasLoading(false); }
  }, [aliasLoading, selection, currentGroupBy, holdingPattern, queryClient]);

  const handleToggleGroupSelect = useCallback(async (group: ContactGroupCount) => {
    const key = `${currentGroupBy}:${group.group_key}`;
    const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, holdingPattern);
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); selection.removeBatch(ids); }
      else { next.add(key); selection.addBatch(ids); setOpenGroups((p) => new Set(p).add(group.group_key)); }
      return next;
    });
  }, [currentGroupBy, selection, holdingPattern]);

  const handleLinkedInLookup = useCallback(async (contactIds: string[], lookupFn: (ids: string[]) => Promise<void>) => {
    if (linkedInLookupLoading || !contactIds.length) return;
    setLinkedInLookupLoading(true);
    try { await lookupFn(contactIds); } finally {
      setLinkedInLookupLoading(false);
      invalidateContacts();
    }
  }, [linkedInLookupLoading, queryClient]);

  const handleGroupLinkedInLookup = useCallback(async (group: ContactGroupCount, lookupFn: (ids: string[]) => Promise<void>) => {
    const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, holdingPattern);
    await handleLinkedInLookup(ids, lookupFn);
  }, [currentGroupBy, holdingPattern, handleLinkedInLookup]);

  const handleBulkCampaign = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (!ids.length) return;
    try {
      const contacts = await getContactsByIds(ids.slice(0, 200), "id, company_name, name, email, phone, country, city");
      if (!contacts?.length) { toast({ title: "Nessun contatto trovato", variant: "destructive" }); return; }
      const batchId = `campaign_${Date.now()}`;
      const jobs = contacts.map((ct) => ({
        partner_id: ct.id, company_name: ct.company_name || ct.name || "Contatto",
        country_code: ct.country || "XX", country_name: ct.country || "Sconosciuto",
        city: ct.city || null, email: ct.email || null, phone: ct.phone || null,
        job_type: "email" as const, batch_id: batchId,
      }));
      await insertCampaignJobs(jobs);
      toast({ title: "Campagna creata", description: `${jobs.length} contatti aggiunti al batch` });
      selection.clear(); setSelectedGroups(new Set());
      navigate("/campaigns");
    } catch (e: unknown) { toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  }, [selection, navigate]);

  const handleAICommand = useCallback(async (cmd: AICommand) => {
    const exec = async (c: AICommand) => {
      switch (c.type) {
        case "apply_filters":
          if (c.filters) setFilters((prev) => ({ ...prev, ...c.filters }));
          if (c.groupBy) setFilters((prev) => ({ ...prev, groupBy: c.groupBy! }));
          setOpenGroups(new Set()); break;
        case "set_sort": if (c.sort) setSortKey(c.sort as SortKey); break;
        case "select_contacts": if (c.contact_ids?.length) selection.addBatch(c.contact_ids); break;
        case "update_status":
          if (c.contact_ids?.length && c.status) {
            updateLeadStatus.mutate({ ids: c.contact_ids, status: c.status as LeadStatus }, { onSuccess: invalidateContacts });
          } break;
        case "export_csv": await exportContactsCsv(c.contact_ids || []); break;
        case "send_to_workspace": await sendToWorkspace(c.contact_ids || [], navigate); break;
        case "create_jobs": await createCampaignJobsAction(c.contact_ids || [], selection, setSelectedGroups, navigate); break;
        case "multi": if (c.commands) { for (const sub of c.commands) await exec(sub); } break;
      }
    };
    await exec(cmd);
  }, [selection, updateLeadStatus, queryClient, navigate]);

  return {
    handleDeepSearch, handleGroupDeepSearch, handleGroupAlias,
    handleToggleGroupSelect, handleBulkCampaign, handleAICommand,
    handleLinkedInLookup, handleGroupLinkedInLookup,
    deepSearchLoading, aliasLoading, linkedInLookupLoading, updateLeadStatus,
  };
}

async function exportContactsCsv(contactIds: string[]) {
  if (!contactIds.length) return;
  const data = await getContactsByIds(contactIds.slice(0, 500), "company_name, name, email, phone, mobile, country, city, address, zip_code, origin, lead_status, position, note");
  if (!data?.length) return;
  const headers = ["Azienda", "Nome", "Email", "Telefono", "Cellulare", "Paese", "Città", "Indirizzo", "CAP", "Origine", "Stato", "Ruolo", "Note"];
  const esc = (v: string | null) => { if (!v) return ""; const s = v.replace(/"/g, '""'); return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s}"` : s; };
  const rows = data.map((r) => [r.company_name, r.name, r.email, r.phone, r.mobile, r.country, r.city, r.address, r.zip_code, r.origin, r.lead_status, r.position, r.note].map(esc).join(";"));
  const csv = "\uFEFF" + headers.join(";") + "\r\n" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `contatti_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast({ title: "Export completato", description: `${data.length} contatti esportati in CSV` });
}

async function sendToWorkspace(contactIds: string[], navigate: ReturnType<typeof useNavigate>) {
  if (!contactIds.length) return;
  const contacts = (await getContactsByIds(contactIds.slice(0, 200), "id, company_name, name, email, country, city")).filter((c) => c.email);
  if (!contacts?.length) { toast({ title: "Nessun contatto con email", variant: "destructive" }); return; }

  if (contacts.length === 1) {
    const ct = contacts[0] as Record<string, unknown>;
    navigate("/email-composer", {
      state: {
        prefilledRecipient: {
          email: ct.email,
          name: ct.name || undefined,
          company: ct.company_name || undefined,
          contactId: ct.id,
        },
      },
    });
    return;
  }

  const recipients = contacts.map((ct) => ({
    email: ct.email,
    name: ct.name || undefined,
    company: ct.company_name || undefined,
    contactId: ct.id,
  }));
  navigate("/email-composer", {
    state: { prefilledRecipients: recipients },
  });
}

async function createCampaignJobsAction(contactIds: string[], selection: ReturnType<typeof useSelection>, setSelectedGroups: React.Dispatch<React.SetStateAction<Set<string>>>, navigate: ReturnType<typeof useNavigate>) {
  if (!contactIds.length) return;
  const contacts = await getContactsByIds(contactIds.slice(0, 200), "id, company_name, name, email, phone, country, city");
  if (!contacts?.length) { toast({ title: "Nessun contatto trovato", variant: "destructive" }); return; }
  const batchId = `contacts_${Date.now()}`;
  const jobs = contacts.map((ct) => ({
    partner_id: ct.id, company_name: ct.company_name || ct.name || "Contatto",
    country_code: ct.country || "XX", country_name: ct.country || "Sconosciuto",
    city: ct.city || null, email: ct.email || null, phone: ct.phone || null,
    job_type: "email" as const, batch_id: batchId,
  }));
  await insertCampaignJobs(jobs);
  toast({ title: "Job creati", description: `${jobs.length} job aggiunti` });
  selection.clear(); setSelectedGroups(new Set());
  navigate("/campaign-jobs");
}
// Re-export from DAL
export { fetchGroupContactIds } from "@/data/contacts";
