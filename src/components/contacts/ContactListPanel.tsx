import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Megaphone, RefreshCw, Briefcase, ClipboardList, Loader2,
  Sparkles, X, Square,
} from "lucide-react";
import { ContactFiltersBar } from "./ContactFiltersBar";
import { GroupStrip } from "./GroupStrip";
import { ExpandedGroupContent } from "./ExpandedGroupContent";
import { useContactFilterOptions, useUpdateLeadStatus, type ContactFilters, type LeadStatus } from "@/hooks/useContacts";
import { useContactGroupCounts, type ContactGroupCount } from "@/hooks/useContactGroups";
import { useImportGroups } from "@/hooks/useImportGroups";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { AICommand } from "./ContactAIBar";
import type { SortKey } from "./contactHelpers";
import { cn } from "@/lib/utils";

/* ── main panel ── */

interface Props {
  selectedId: string | null;
  onSelect: (contact: any) => void;
}

export function ContactListPanel({ selectedId, onSelect }: Props) {
  const [filters, setFilters] = useState<ContactFilters>({ groupBy: "country", holdingPattern: "out" });
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const { data: filterOptions } = useContactFilterOptions();
  const { data: allGroupCounts, isLoading: groupsLoading } = useContactGroupCounts();
  const { data: importGroups } = useImportGroups();
  const updateLeadStatus = useUpdateLeadStatus();
  const queryClient = useQueryClient();

  const countries = filterOptions?.countries ?? [];
  const origins = filterOptions?.origins ?? [];

  const currentGroupBy = filters.groupBy || "country";
  const groups = useMemo(() => {
    if (!allGroupCounts) return [];
    let filtered = allGroupCounts.filter((g) => g.group_type === currentGroupBy);

    // Client-side search filter on group labels
    const search = filters.search?.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter((g) =>
        g.group_label.toLowerCase().includes(search) ||
        g.group_key.toLowerCase().includes(search)
      );
    }

    return filtered.sort((a, b) => b.contact_count - a.contact_count);
  }, [allGroupCounts, currentGroupBy, filters.search]);

  const totalContacts = useMemo(() => groups.reduce((s, g) => s + g.contact_count, 0), [groups]);

  const selection = useSelection([]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [deepSearchLoading, setDeepSearchLoading] = useState(false);

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleFilterChange = (partial: Partial<ContactFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial, page: 0 }));
    setOpenGroups(new Set());
  };

  /* ── Deep Search handler (group + bulk) ── */
  const handleDeepSearch = useCallback(async (contactIds: string[]) => {
    if (deepSearchLoading || !contactIds.length) return;
    setDeepSearchLoading(true);
    let success = 0;
    let errors = 0;

    toast({ title: `Deep Search avviata su ${contactIds.length} contatti...` });

    for (const id of contactIds) {
      try {
        const { data, error } = await supabase.functions.invoke("deep-search-contact", {
          body: { contactId: id },
        });
        // Handle insufficient credits — stop the whole loop
        if (error) {
          const errMsg = typeof error === "object" && error?.message ? error.message : String(error);
          if (errMsg.includes("402") || errMsg.includes("Crediti insufficienti")) {
            toast({ title: "Crediti insufficienti", description: "Acquista crediti per continuare con la Deep Search.", variant: "destructive" });
            break;
          }
          errors++; continue;
        }
        if (data?.success === false && data?.error?.includes?.("Crediti")) {
          toast({ title: "Crediti insufficienti", description: "Acquista crediti per continuare con la Deep Search.", variant: "destructive" });
          break;
        }
        if (data?.success) success++;
        else errors++;
      } catch {
        errors++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
    queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });

    toast({
      title: "Deep Search completata",
      description: `${success} arricchiti${errors > 0 ? `, ${errors} errori` : ""}`,
      variant: errors > 0 && success === 0 ? "destructive" : "default",
    });
    setDeepSearchLoading(false);
  }, [deepSearchLoading, queryClient]);

  const handleGroupDeepSearch = useCallback(async (group: ContactGroupCount) => {
    const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, filters.holdingPattern);
    // Limit to 20 to avoid excessive API calls
    const limited = ids.slice(0, 20);
    if (limited.length < ids.length) {
      toast({ title: `Deep Search limitata ai primi ${limited.length} contatti su ${ids.length}` });
    }
    await handleDeepSearch(limited);
  }, [currentGroupBy, filters.holdingPattern, handleDeepSearch]);

  const [aliasLoading, setAliasLoading] = useState(false);

  const handleGroupAlias = useCallback(async (group: ContactGroupCount) => {
    if (aliasLoading) return;
    setAliasLoading(true);
    try {
      const ids = selection.count > 0
        ? Array.from(selection.selectedIds)
        : await fetchGroupContactIds(currentGroupBy, group.group_key, filters.holdingPattern);

      if (!ids.length) {
        toast({ title: "Nessun contatto trovato" });
        return;
      }

      toast({ title: `Generazione alias per ${ids.length} contatti...` });

      const { data, error } = await supabase.functions.invoke("generate-aliases", {
        body: { contactIds: ids },
      });

      if (error) throw error;

      const processed = data?.processed || 0;
      if (processed === 0) {
        toast({ title: "Alias già presenti", description: "Tutti i contatti hanno già un alias" });
      } else {
        toast({ title: "✨ Alias generati", description: `${processed} contatti elaborati` });
      }
      queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts-by-group"] });
    } catch (e: any) {
      toast({ title: "Errore generazione alias", description: e.message, variant: "destructive" });
    } finally {
      setAliasLoading(false);
    }
  }, [aliasLoading, selection, currentGroupBy, filters.holdingPattern, queryClient]);

  const handleToggleGroupSelect = useCallback(async (group: ContactGroupCount) => {
    const key = `${currentGroupBy}:${group.group_key}`;
    if (selectedGroups.has(key)) {
      setSelectedGroups((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, filters.holdingPattern);
      selection.removeBatch(ids);
    } else {
      setSelectedGroups((prev) => new Set(prev).add(key));
      const ids = await fetchGroupContactIds(currentGroupBy, group.group_key, filters.holdingPattern);
      selection.addBatch(ids);
      setOpenGroups((prev) => new Set(prev).add(group.group_key));
    }
  }, [currentGroupBy, selectedGroups, selection, filters.holdingPattern]);

  const navigate = useNavigate();

  /* ── Bulk Campaign handler ── */
  const handleBulkCampaign = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (!ids.length) return;

    try {
      const { data: contacts } = await supabase
        .from("imported_contacts")
        .select("id, company_name, name, email, phone, country, city")
        .in("id", ids.slice(0, 200));

      if (!contacts?.length) {
        toast({ title: "Nessun contatto trovato", variant: "destructive" });
        return;
      }

      const batchId = `campaign_${Date.now()}`;
      const jobs = contacts.map((ct: any) => ({
        partner_id: ct.id,
        company_name: ct.company_name || ct.name || "Contatto",
        country_code: ct.country || "XX",
        country_name: ct.country || "Sconosciuto",
        city: ct.city || null,
        email: ct.email || null,
        phone: ct.phone || null,
        job_type: "email" as const,
        batch_id: batchId,
      }));

      await supabase.from("campaign_jobs").insert(jobs);
      toast({ title: "Campagna creata", description: `${jobs.length} contatti aggiunti al batch` });
      selection.clear();
      setSelectedGroups(new Set());
      navigate("/campaigns");
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  }, [selection, navigate]);

  const handleAICommand = useCallback(async (cmd: AICommand) => {
    const exec = async (c: AICommand) => {
      switch (c.type) {
        case "apply_filters":
          if (c.filters) setFilters((prev) => ({ ...prev, ...c.filters }));
          if (c.groupBy) setFilters((prev) => ({ ...prev, groupBy: c.groupBy! }));
          setOpenGroups(new Set());
          break;
        case "set_sort":
          if (c.sort) setSortKey(c.sort as SortKey);
          break;
        case "select_contacts":
          if (c.contact_ids?.length) selection.addBatch(c.contact_ids);
          break;
        case "update_status":
          if (c.contact_ids?.length && c.status) {
            updateLeadStatus.mutate(
              { ids: c.contact_ids, status: c.status as LeadStatus },
              { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] }) }
            );
          }
          break;
        case "export_csv":
          if (c.contact_ids?.length) {
            try {
              const { data } = await supabase
                .from("imported_contacts")
                .select("company_name, name, email, phone, mobile, country, city, address, zip_code, origin, lead_status, position, note")
                .in("id", c.contact_ids.slice(0, 500));
              if (data?.length) {
                const headers = ["Azienda", "Nome", "Email", "Telefono", "Cellulare", "Paese", "Città", "Indirizzo", "CAP", "Origine", "Stato", "Ruolo", "Note"];
                const esc = (v: string | null) => {
                  if (!v) return "";
                  const s = v.replace(/"/g, '""');
                  return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
                };
                const rows = data.map((r: any) => [
                  r.company_name, r.name, r.email, r.phone, r.mobile, r.country, r.city, r.address, r.zip_code, r.origin, r.lead_status, r.position, r.note
                ].map(esc).join(";"));
                const csv = "\uFEFF" + headers.join(";") + "\r\n" + rows.join("\r\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `contatti_export_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: "Export completato", description: `${data.length} contatti esportati in CSV` });
              }
            } catch (e: any) {
              toast({ title: "Errore export", description: e.message, variant: "destructive" });
            }
          }
          break;
        case "send_to_workspace":
          if (c.contact_ids?.length) {
            try {
              const { data: contacts } = await supabase
                .from("imported_contacts")
                .select("id, company_name, name, email, country, city")
                .in("id", c.contact_ids.slice(0, 200))
                .not("email", "is", null);
              if (!contacts?.length) {
                toast({ title: "Nessun contatto con email", description: "I contatti selezionati non hanno email", variant: "destructive" });
                break;
              }

              const activities = contacts.map((ct: any) => ({
                partner_id: null,
                source_type: "contact" as const,
                source_id: ct.id,
                activity_type: "send_email" as const,
                title: `Email a ${ct.name || ct.company_name || "Contatto"}`,
                description: `Contatto: ${ct.name || ""} - ${ct.email}`,
                priority: "medium",
                source_meta: {
                  company_name: ct.company_name || null,
                  contact_name: ct.name || null,
                  email: ct.email || null,
                  country: ct.country || null,
                  city: ct.city || null,
                },
              }));

              await supabase.from("activities").insert(activities);
              toast({ title: "Inviati al Workspace", description: `${activities.length} attività email create nel tab Contatti` });
              navigate("/workspace");
            } catch (e: any) {
              toast({ title: "Errore", description: e.message, variant: "destructive" });
            }
          }
          break;
        case "create_jobs":
          if (c.contact_ids?.length) {
            try {
              const { data: contacts } = await supabase
                .from("imported_contacts")
                .select("id, company_name, name, email, phone, country, city")
                .in("id", c.contact_ids.slice(0, 200));
              if (!contacts?.length) {
                toast({ title: "Nessun contatto trovato", variant: "destructive" });
                break;
              }
              const batchId = `contacts_${Date.now()}`;
              const jobs = contacts.map((ct: any) => ({
                partner_id: ct.id,
                company_name: ct.company_name || ct.name || "Contatto",
                country_code: ct.country || "XX",
                country_name: ct.country || "Sconosciuto",
                city: ct.city || null,
                email: ct.email || null,
                phone: ct.phone || null,
                job_type: "email" as const,
                batch_id: batchId,
              }));
              await supabase.from("campaign_jobs").insert(jobs);
              toast({ title: "Job creati", description: `${jobs.length} job aggiunti al batch ${batchId.slice(-6)}` });
              selection.clear();
              setSelectedGroups(new Set());
              navigate("/campaign-jobs");
            } catch (e: any) {
              toast({ title: "Errore", description: e.message, variant: "destructive" });
            }
          }
          break;
        case "multi":
          if (c.commands) {
            for (const sub of c.commands) await exec(sub);
          }
          break;
      }
    };
    await exec(cmd);
  }, [selection, updateLeadStatus, queryClient, navigate]);

  const isBulk = selection.count > 0;
  const btnClass = "h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:bg-violet-500/10 hover:text-foreground";

  return (
    <div className="flex flex-col h-full min-h-0">
      <ContactFiltersBar
        filters={filters}
        onChange={handleFilterChange}
        countries={countries}
        origins={origins}
        importGroups={importGroups}
        groupCounts={allGroupCounts}
        totalContacts={totalContacts}
        selectedCount={selection.count}
        sortKey={sortKey}
        onSortChange={(v) => setSortKey(v as SortKey)}
        onAICommand={handleAICommand}
      />

      {/* Unified bulk action bar */}
      {isBulk && (
        <div className="px-3 py-1.5 border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.06] to-purple-500/[0.04] backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-violet-300 mr-1">{selection.count} sel.</span>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className={btnClass}
                  onClick={() => handleAICommand({ type: "send_to_workspace", contact_ids: Array.from(selection.selectedIds) })}>
                  <Briefcase className="w-3.5 h-3.5" /> Workspace
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Invia al Workspace Email</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className={btnClass}
                  onClick={() => handleAICommand({ type: "create_jobs", contact_ids: Array.from(selection.selectedIds) })}>
                  <ClipboardList className="w-3.5 h-3.5" /> Job
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Crea Job Campagna</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className={btnClass}
                  disabled={deepSearchLoading}
                  onClick={() => handleDeepSearch(Array.from(selection.selectedIds).slice(0, 20))}>
                  {deepSearchLoading
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Search className="w-3.5 h-3.5" />}
                  Deep Search
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Arricchisci con Deep Search (max 20)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className={btnClass}
                  onClick={handleBulkCampaign}>
                  <Megaphone className="w-3.5 h-3.5" /> Campagna
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Aggiungi a Campagna</TooltipContent>
            </Tooltip>

            <button
              onClick={() => { selection.clear(); setSelectedGroups(new Set()); }}
              className="ml-auto hover:bg-violet-500/20 rounded-full p-0.5 transition-colors text-violet-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {groupsLoading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-lg" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun contatto trovato
          </p>
        ) : (
          groups.map((group) => {
            const isOpen = openGroups.has(group.group_key);
            const groupSelKey = `${currentGroupBy}:${group.group_key}`;
            return (
              <div key={group.group_key}>
                <GroupStrip
                  group={group}
                  groupBy={currentGroupBy}
                  isOpen={isOpen}
                  onToggle={() => toggleGroup(group.group_key)}
                  onDeepSearch={() => handleGroupDeepSearch(group)}
                  onAlias={() => handleGroupAlias(group)}
                  isGroupSelected={selectedGroups.has(groupSelKey)}
                  onToggleGroupSelect={() => handleToggleGroupSelect(group)}
                  isAliasLoading={aliasLoading}
                  isDeepSearchLoading={deepSearchLoading}
                />
                {isOpen && (
                  <ExpandedGroupContent
                    groupType={currentGroupBy}
                    groupKey={group.group_key}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    selection={selection}
                    holdingPattern={filters.holdingPattern}
                    sortKey={sortKey}
                    searchFilter={filters.search}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        <span>{totalContacts} contatti • {groups.length} gruppi</span>
      </div>
    </div>
  );
}

/** Fetch all contact IDs for a given group (up to 1000) */
async function fetchGroupContactIds(
  groupType: string,
  groupKey: string,
  holdingPattern?: "out" | "in" | "all"
): Promise<string[]> {
  let q = supabase
    .from("imported_contacts")
    .select("id")
    .or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  if (holdingPattern === "out") q = q.eq("interaction_count", 0);
  else if (holdingPattern === "in") q = q.gt("interaction_count", 0);

  switch (groupType) {
    case "country":
      if (groupKey === "??" || groupKey === "Sconosciuto") q = q.is("country", null);
      else q = q.eq("country", groupKey);
      break;
    case "origin":
      if (groupKey === "Sconosciuta") q = q.is("origin", null);
      else q = q.eq("origin", groupKey);
      break;
    case "status":
      q = q.eq("lead_status", groupKey);
      break;
    case "date":
      if (groupKey === "nd") {
        q = q.is("created_at", null);
      } else {
        const [y, m] = groupKey.split("-").map(Number);
        const nextM = new Date(y, m, 1).toISOString();
        q = q.gte("created_at", `${groupKey}-01T00:00:00Z`).lt("created_at", nextM);
      }
      break;
  }

  q = q.limit(1000);
  const { data } = await q;
  return (data ?? []).map((r: any) => r.id);
}
