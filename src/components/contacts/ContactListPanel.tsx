import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, Megaphone, RefreshCw, Briefcase, ClipboardList, Loader2 } from "lucide-react";
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
    return allGroupCounts
      .filter((g) => g.group_type === currentGroupBy)
      .sort((a, b) => b.contact_count - a.contact_count);
  }, [allGroupCounts, currentGroupBy]);

  const totalContacts = useMemo(() => groups.reduce((s, g) => s + g.contact_count, 0), [groups]);

  const selection = useSelection([]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

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

  const handleGroupDeepSearch = (group: ContactGroupCount) => {
    toast({ title: `Deep Search avviata su ${group.contact_count} contatti del gruppo "${group.group_label}"` });
  };

  const [aliasLoading, setAliasLoading] = useState(false);

  const handleGroupAlias = useCallback(async (group: ContactGroupCount) => {
    if (aliasLoading) return;
    setAliasLoading(true);
    try {
      // If there's an active selection, use those IDs; otherwise load group IDs
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

      queryClient.invalidateQueries({ queryKey: ["contact-group-counts"] });
      queryClient.invalidateQueries({ queryKey: ["contact-group-items"] });
      toast({ title: "Alias generati", description: `${data?.processed || 0} contatti elaborati` });
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
        case "multi":
          if (c.commands) {
            for (const sub of c.commands) await exec(sub);
          }
          break;
      }
    };
    await exec(cmd);
  }, [selection, updateLeadStatus, queryClient, navigate]);

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

      {/* Bulk actions */}
      {selection.count > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 border-b border-primary/20 text-xs flex-wrap">
          <span className="font-bold text-primary">{selection.count} selezionati</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
            onClick={() => handleAICommand({ type: "send_to_workspace", contact_ids: Array.from(selection.selectedIds) })}>
            <Briefcase className="w-3 h-3" /> Workspace
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"
            onClick={() => handleAICommand({ type: "create_jobs", contact_ids: Array.from(selection.selectedIds) })}>
            <ClipboardList className="w-3 h-3" /> Crea Job
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Search className="w-3 h-3" /> Deep Search</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><Megaphone className="w-3 h-3" /> Campagna</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1"><RefreshCw className="w-3 h-3" /> Status</Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto text-destructive hover:text-destructive" onClick={() => { selection.clear(); setSelectedGroups(new Set()); }}>Deseleziona</Button>
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
