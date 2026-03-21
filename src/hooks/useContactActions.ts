import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

  const invalidateContacts = () => {
    queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
    queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });
  };

  const handleDeepSearch = useCallback(async (contactIds: string[]) => {
    if (deepSearchLoading || !contactIds.length) return;
    setDeepSearchLoading(true);
    let success = 0, errors = 0;
    toast({ title: `Deep Search avviata su ${contactIds.length} contatti...` });
    for (const id of contactIds) {
      try {
        const { data, error } = await supabase.functions.invoke("deep-search-contact", { body: { contactId: id } });
        if (error) {
          const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
          if (errMsg.includes("402") || errMsg.includes("Crediti insufficienti")) {
            toast({ title: "Crediti insufficienti", variant: "destructive" }); break;
          }
          errors++; continue;
        }
        if (data?.success === false && data?.error?.includes?.("Crediti")) {
          toast({ title: "Crediti insufficienti", variant: "destructive" }); break;
        }
        if (data?.success) success++; else errors++;
      } catch { errors++; }
    }
    invalidateContacts();
    toast({ title: "Deep Search completata", description: `${success} arricchiti${errors > 0 ? `, ${errors} errori` : ""}`, variant: errors > 0 && success === 0 ? "destructive" : "default" });
    setDeepSearchLoading(false);
  }, [deepSearchLoading, queryClient]);

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
      const { data, error } = await supabase.functions.invoke("generate-aliases", { body: { contactIds: ids } });
      if (error) throw error;
      const processed = data?.processed || 0;
      toast({ title: processed === 0 ? "Alias già presenti" : "✨ Alias generati", description: processed === 0 ? "Tutti i contatti hanno già un alias" : `${processed} contatti elaborati` });
      invalidateContacts();
    } catch (e: any) {
      toast({ title: "Errore generazione alias", description: e.message, variant: "destructive" });
    } finally { setAliasLoading(false); }
  }, [aliasLoading, selection, currentGroupBy, holdingPattern, queryClient]);

  const handleToggleGroupSelect = useCallback(async (group: ContactGroupCount) => {
    const key = `${currentGroupBy}:${group.group_key}`;
    if (deps.selection.selectedIds.size > 0) {
      // Check if group key was already selected
    }
    const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, holdingPattern);
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); selection.removeBatch(ids); }
      else { next.add(key); selection.addBatch(ids); setOpenGroups((p) => new Set(p).add(group.group_key)); }
      return next;
    });
  }, [currentGroupBy, selection, holdingPattern]);

  const handleBulkCampaign = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (!ids.length) return;
    try {
      const { data: contacts } = await supabase.from("imported_contacts").select("id, company_name, name, email, phone, country, city").in("id", ids.slice(0, 200));
      if (!contacts?.length) { toast({ title: "Nessun contatto trovato", variant: "destructive" }); return; }
      const batchId = `campaign_${Date.now()}`;
      const jobs = contacts.map((ct: any) => ({
        partner_id: ct.id, company_name: ct.company_name || ct.name || "Contatto",
        country_code: ct.country || "XX", country_name: ct.country || "Sconosciuto",
        city: ct.city || null, email: ct.email || null, phone: ct.phone || null,
        job_type: "email" as const, batch_id: batchId,
      }));
      await supabase.from("campaign_jobs").insert(jobs);
      toast({ title: "Campagna creata", description: `${jobs.length} contatti aggiunti al batch` });
      selection.clear(); setSelectedGroups(new Set());
      navigate("/campaigns");
    } catch (e: any) { toast({ title: "Errore", description: e.message, variant: "destructive" }); }
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
        case "create_jobs": await createCampaignJobs(c.contact_ids || [], selection, setSelectedGroups, navigate); break;
        case "multi": if (c.commands) { for (const sub of c.commands) await exec(sub); } break;
      }
    };
    await exec(cmd);
  }, [selection, updateLeadStatus, queryClient, navigate]);

  return {
    handleDeepSearch, handleGroupDeepSearch, handleGroupAlias,
    handleToggleGroupSelect, handleBulkCampaign, handleAICommand,
    deepSearchLoading, aliasLoading, updateLeadStatus,
  };
}

async function exportContactsCsv(contactIds: string[]) {
  if (!contactIds.length) return;
  const { data } = await supabase.from("imported_contacts")
    .select("company_name, name, email, phone, mobile, country, city, address, zip_code, origin, lead_status, position, note")
    .in("id", contactIds.slice(0, 500));
  if (!data?.length) return;
  const headers = ["Azienda", "Nome", "Email", "Telefono", "Cellulare", "Paese", "Città", "Indirizzo", "CAP", "Origine", "Stato", "Ruolo", "Note"];
  const esc = (v: string | null) => { if (!v) return ""; const s = v.replace(/"/g, '""'); return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s}"` : s; };
  const rows = data.map((r: any) => [r.company_name, r.name, r.email, r.phone, r.mobile, r.country, r.city, r.address, r.zip_code, r.origin, r.lead_status, r.position, r.note].map(esc).join(";"));
  const csv = "\uFEFF" + headers.join(";") + "\r\n" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `contatti_export_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast({ title: "Export completato", description: `${data.length} contatti esportati in CSV` });
}

async function sendToWorkspace(contactIds: string[], navigate: ReturnType<typeof useNavigate>) {
  if (!contactIds.length) return;
  const { data: contacts } = await supabase.from("imported_contacts").select("id, company_name, name, email, country, city").in("id", contactIds.slice(0, 200)).not("email", "is", null);
  if (!contacts?.length) { toast({ title: "Nessun contatto con email", variant: "destructive" }); return; }
  const activities = contacts.map((ct: any) => ({
    partner_id: null, source_type: "contact" as const, source_id: ct.id, activity_type: "send_email" as const,
    title: `Email a ${ct.name || ct.company_name || "Contatto"}`, description: `Contatto: ${ct.name || ""} - ${ct.email}`,
    priority: "medium", source_meta: { company_name: ct.company_name, contact_name: ct.name, email: ct.email, country: ct.country, city: ct.city },
  }));
  await supabase.from("activities").insert(activities);
  toast({ title: "Inviati al Workspace", description: `${activities.length} attività email create` });
  navigate("/workspace");
}

async function createCampaignJobs(contactIds: string[], selection: ReturnType<typeof useSelection>, setSelectedGroups: React.Dispatch<React.SetStateAction<Set<string>>>, navigate: ReturnType<typeof useNavigate>) {
  if (!contactIds.length) return;
  const { data: contacts } = await supabase.from("imported_contacts").select("id, company_name, name, email, phone, country, city").in("id", contactIds.slice(0, 200));
  if (!contacts?.length) { toast({ title: "Nessun contatto trovato", variant: "destructive" }); return; }
  const batchId = `contacts_${Date.now()}`;
  const jobs = contacts.map((ct: any) => ({
    partner_id: ct.id, company_name: ct.company_name || ct.name || "Contatto",
    country_code: ct.country || "XX", country_name: ct.country || "Sconosciuto",
    city: ct.city || null, email: ct.email || null, phone: ct.phone || null,
    job_type: "email" as const, batch_id: batchId,
  }));
  await supabase.from("campaign_jobs").insert(jobs);
  toast({ title: "Job creati", description: `${jobs.length} job aggiunti` });
  selection.clear(); setSelectedGroups(new Set());
  navigate("/campaign-jobs");
}

export async function fetchGroupContactIds(groupType: string, groupKey: string, holdingPattern?: "out" | "in" | "all"): Promise<string[]> {
  let q = supabase.from("imported_contacts").select("id").or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);
  switch (groupType) {
    case "country": groupKey === "??" || groupKey === "Sconosciuto" ? q = q.is("country", null) : q = q.eq("country", groupKey); break;
    case "origin": groupKey === "Sconosciuta" ? q = q.is("origin", null) : q = q.eq("origin", groupKey); break;
    case "status": q = q.eq("lead_status", groupKey); break;
    case "date":
      if (groupKey === "nd") q = q.is("created_at", null);
      else { const [y, m] = groupKey.split("-").map(Number); q = q.gte("created_at", `${groupKey}-01T00:00:00Z`).lt("created_at", new Date(y, m, 1).toISOString()); }
      break;
  }
  const { data } = await q.limit(1000);
  return (data ?? []).map((r: any) => r.id);
}
