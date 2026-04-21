/**
 * ManualGroupingTab — Drag-and-drop sender classification (refactored from SenderManagementTab)
 * Tab 1 of Email Intelligence flow
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { deriveSenderDisplayName } from "@/lib/senderDisplayName";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, Loader2, Plus, Search, ArrowUpDown, Filter, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SenderCard } from "./management/SenderCard";
import { GroupDropZone } from "./management/GroupDropZone";
import { CreateCategoryDialog } from "./management/CreateCategoryDialog";
import { SenderEmailsDialog } from "./management/SenderEmailsDialog";
import { MultiSelectBulkBar } from "./management/MultiSelectBulkBar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EmailSenderGroup, SenderAnalysis, SortOption } from "@/types/email-management";
import { DEFAULT_GROUPS as PREDEFINED_GROUPS } from "@/types/email-management";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const VOLUME_FILTERS = [
  { value: "all", label: "Tutti" },
  { value: "2", label: ">2 email" },
  { value: "5", label: ">5 email" },
  { value: "10", label: ">10 email" },
  { value: "50", label: ">50 email" },
];

export default function ManualGroupingTab() {
  const qc = useQueryClient();
  const [senders, setSenders] = useState<SenderAnalysis[]>([]);
  const [groups, setGroups] = useState<EmailSenderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopulating, setIsPopulating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("count-desc");
  const [volumeFilter, setVolumeFilter] = useState("all");
  const [activeDrag, setActiveDrag] = useState<SenderAnalysis | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [emailPreviewSender, setEmailPreviewSender] = useState<SenderAnalysis | null>(null);
  const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeDrag) return;
    const handleDrag = (e: DragEvent) => {
      if (e.clientX === 0 && e.clientY === 0) return;
      const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
      let found = false;
      dropZones.forEach((zone) => {
        const rect = zone.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const gid = zone.getAttribute("data-group-id");
          if (gid) { setHoveredGroupId(gid); found = true; }
        }
      });
      if (!found) setHoveredGroupId(null);
    };
    document.addEventListener("drag", handleDrag);
    return () => document.removeEventListener("drag", handleDrag);
  }, [activeDrag]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const ch = supabase.channel("manual-grouping-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_sender_groups" }, () => loadGroups())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const loadGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("email_sender_groups")
      .select("*")
      .order("sort_order", { ascending: true });
    setGroups((data || []) as EmailSenderGroup[]);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Load groups
      const { data: groupsData } = await supabase
        .from("email_sender_groups")
        .select("*")
        .order("sort_order", { ascending: true });

      const loadedGroups = (groupsData || []) as EmailSenderGroup[];

      if (loadedGroups.length === 0) {
        const inserts = PREDEFINED_GROUPS.map((g, i) => ({
          nome_gruppo: g.name, descrizione: g.description,
          colore: g.color, icon: g.icon, user_id: user.id, sort_order: i,
        }));
        const { data: created } = await supabase.from("email_sender_groups").insert(inserts).select();
        if (created) {
          setGroups(created as EmailSenderGroup[]);
          toast.success(`${created.length} gruppi predefiniti creati`);
        }
      } else {
        setGroups(loadedGroups);
      }

      // Load all visible uncategorized address rules with pagination
      const rules = await fetchAllRows<{
        id: string; email_address: string; display_name: string | null;
        email_count: number | null; last_email_at: string | null;
        domain: string | null; company_name: string | null;
      }>(
        (from, to) =>
          supabase
            .from("email_address_rules")
            .select("id, email_address, display_name, email_count, last_email_at, domain, company_name")
            .is("group_id", null)
            .order("email_count", { ascending: false })
            .range(from, to),
      );

      const senderList: SenderAnalysis[] = rules.map((r) => ({
        email: r.email_address,
        domain: r.domain || r.email_address.split("@")[1] || "",
        companyName: r.company_name || r.display_name || deriveSenderDisplayName(r.email_address),
        emailCount: r.email_count ?? 0,
        firstSeen: "",
        lastSeen: r.last_email_at || "",
        isClassified: false,
        ruleId: r.id,
      }));

      setSenders(senderList);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento");
    } finally {
      setIsLoading(false);
    }
  };

  /** Fetch ALL rows from a query, paginating in chunks of 1000 to bypass Supabase default limit */
  const fetchAllRows = async <T,>(
    buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ): Promise<T[]> => {
    const PAGE = 1000;
    const all: T[] = [];
    let offset = 0;
    let done = false;
    while (!done) {
      const { data, error } = await buildQuery(offset, offset + PAGE - 1);
      if (error) throw error;
      const batch = data ?? [];
      all.push(...batch);
      if (batch.length < PAGE) done = true;
      else offset += PAGE;
    }
    return all;
  };

  const populateAddressRules = async () => {
    setIsPopulating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get only THIS user's inbound email senders with pagination
      const messages = await fetchAllRows<{ from_address: string | null }>(
        (from, to) =>
          supabase
            .from("channel_messages")
            .select("from_address")
            .eq("channel", "email")
            .eq("direction", "inbound")
            .eq("user_id", user.id)
            .not("from_address", "is", null)
            .order("id", { ascending: true })
            .range(from, to),
      );

      // Count per address
      const addressMap = new Map<string, number>();
      for (const msg of messages) {
        const key = (msg.from_address || "").toLowerCase().trim();
        if (!key || !key.includes("@")) continue;
        addressMap.set(key, (addressMap.get(key) || 0) + 1);
      }

      // Check all visible existing rules with pagination
      const existing = await fetchAllRows<{
        id: string;
        email_address: string;
        email_count: number | null;
      }>(
        (from, to) =>
          supabase
            .from("email_address_rules")
            .select("id, email_address, email_count")
            .order("id", { ascending: true })
            .range(from, to),
      );
      const existingByAddress = new Map<string, Array<{ id: string; email_count: number | null }>>();
      for (const rule of existing) {
        const key = rule.email_address.toLowerCase();
        const matches = existingByAddress.get(key) || [];
        matches.push({ id: rule.id, email_count: rule.email_count });
        existingByAddress.set(key, matches);
      }
      const existingSet = new Set(existingByAddress.keys());

      // Update email_count for any visible rule with stale counts
      const staleUpdates: Array<{ id: string; count: number }> = [];
      for (const [addr, count] of addressMap.entries()) {
        const matchingRules = existingByAddress.get(addr);
        if (!matchingRules) continue;
        for (const rule of matchingRules) {
          if ((rule.email_count ?? 0) !== count) {
            staleUpdates.push({ id: rule.id, count });
          }
        }
      }

      if (staleUpdates.length > 0) {
        for (let i = 0; i < staleUpdates.length; i += 20) {
          const batch = staleUpdates.slice(i, i + 20);
          await Promise.all(
            batch.map(async ({ id, count }) => {
              const { error } = await supabase
                .from("email_address_rules")
                .update({ email_count: count })
                .eq("id", id);
              if (error) throw error;
            }),
          );
        }
      }

      const newRules = [...addressMap.entries()]
        .filter(([addr]) => !existingSet.has(addr))
        .map(([addr, count]) => ({
          user_id: user.id,
          email_address: addr,
          domain: addr.split("@")[1],
          email_count: count,
          is_active: true,
          company_name: deriveSenderDisplayName(addr),
        }));

      if (newRules.length > 0) {
        for (let i = 0; i < newRules.length; i += 100) {
          const { error } = await supabase
            .from("email_address_rules")
            .upsert(newRules.slice(i, i + 100), { onConflict: "user_id,email_address" });
          if (error) throw error;
        }
        toast.success(`${newRules.length} nuovi address aggiunti`);
      } else {
        toast.info("Tutti gli address sono già presenti");
      }

      if (staleUpdates.length > 0) {
        toast.info(`${staleUpdates.length} address aggiornati con conteggio corretto`);
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount }),
        qc.invalidateQueries({ queryKey: queryKeys.emailIntel.aiSuggestionsCount }),
        qc.invalidateQueries({ queryKey: queryKeys.emailIntel.activeRules }),
      ]);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore popolamento");
    } finally {
      setIsPopulating(false);
    }
  };

  const handleCreateCategory = async (data: { nome_gruppo: string; descrizione?: string; colore: string; icon: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: created, error } = await supabase
      .from("email_sender_groups")
      .insert({ ...data, user_id: user.id, sort_order: groups.length })
      .select()
      .single();
    if (error) { toast.error("Errore creazione"); throw error; }
    setGroups((prev) => [...prev, created as EmailSenderGroup]);
    toast.success(`${data.nome_gruppo} creato`);
  };

  const handleDragStart = (sender: SenderAnalysis) => setActiveDrag(sender);

  const handleDragEnd = async (clientX: number, clientY: number) => {
    if (!activeDrag) return;
    const dropZones = document.querySelectorAll('[data-drop-zone="true"]');
    let targetGroupId: string | null = null;
    let targetGroupName: string | null = null;

    dropZones.forEach((zone) => {
      const rect = zone.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        targetGroupId = zone.getAttribute("data-group-id");
        targetGroupName = zone.getAttribute("data-group-name");
      }
    });

    if (targetGroupId && targetGroupName) {
      await assignToGroup(activeDrag, targetGroupName, targetGroupId);
    }
    setActiveDrag(null);
    setHoveredGroupId(null);
  };

  const assignToGroup = async (sender: SenderAnalysis, groupName: string, groupId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const group = groups.find((g) => g.id === groupId);

    if (sender.ruleId) {
      await supabase.from("email_address_rules")
        .update({ group_id: groupId, group_name: groupName, group_color: group?.colore, group_icon: group?.icon })
        .eq("id", sender.ruleId);
    } else {
      await supabase.from("email_address_rules").insert({
        email_address: sender.email, user_id: user.id,
        group_id: groupId, group_name: groupName,
        group_color: group?.colore, group_icon: group?.icon,
        domain: sender.domain, company_name: sender.companyName,
        email_count: sender.emailCount, is_active: true,
      });
    }

    // Log decision for learning
    await supabase.from("ai_decision_log").insert({
      user_id: user.id,
      decision_type: "email_group_assignment",
      input_context: { email_address: sender.email, email_count: sender.emailCount, domain: sender.domain },
      decision_output: { group_name: groupName, group_id: groupId },
      confidence: 1.0,
    });

    // Check domain pattern for auto-learning
    const domain = sender.email.split("@")[1];
    if (domain) {
      const { data: pattern } = await supabase.rpc("check_domain_group_pattern", {
        p_user_id: user.id, p_domain: domain, p_min_count: 3,
      });
      if (pattern && pattern.length > 0) {
        const p = pattern[0];
        // Check if KB entry already exists for this domain
        const { data: existingKb } = await supabase.from("kb_entries")
          .select("id")
          .eq("user_id", user.id)
          .contains("tags", ["domain_pattern", domain])
          .maybeSingle();
        if (!existingKb) {
          await supabase.from("kb_entries").insert({
            user_id: user.id,
            category: "email_management",
            title: `Pattern dominio ${domain}`,
            content: `Le email dal dominio ${domain} appartengono al gruppo "${p.group_name}". Classificare automaticamente.`,
            tags: ["email_classification", "domain_pattern", domain],
            priority: 5,
            is_active: true,
          });
          toast.info(`Pattern dominio ${domain} → ${p.group_name} salvato in KB`);
        }
      }
    }

    setSenders((prev) => prev.filter((s) => s.email !== sender.email));
    setSelectedSenders((prev) => {
      const updated = new Set(prev);
      updated.delete(sender.email);
      return updated;
    });
    qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
    toast.success(`${sender.companyName} → ${groupName}`);
  };

  const handleToggleSenderSelection = (email: string) => {
    setSelectedSenders((prev) => {
      const updated = new Set(prev);
      if (updated.has(email)) {
        updated.delete(email);
      } else {
        updated.add(email);
      }
      return updated;
    });
  };

  const handleSelectAll = () => {
    if (selectedSenders.size === sortedSenders.length && selectedSenders.size > 0) {
      // Deselect all
      setSelectedSenders(new Set());
    } else {
      // Select all visible
      setSelectedSenders(new Set(sortedSenders.map((s) => s.email)));
    }
  };

  const handleBulkAssignGroup = async (senders: SenderAnalysis[], groupName: string, groupId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const group = groups.find((g) => g.id === groupId);

    for (const sender of senders) {
      if (sender.ruleId) {
        await supabase.from("email_address_rules")
          .update({ group_id: groupId, group_name: groupName, group_color: group?.colore, group_icon: group?.icon })
          .eq("id", sender.ruleId);
      } else {
        await supabase.from("email_address_rules").insert({
          email_address: sender.email, user_id: user.id,
          group_id: groupId, group_name: groupName,
          group_color: group?.colore, group_icon: group?.icon,
          domain: sender.domain, company_name: sender.companyName,
          email_count: sender.emailCount, is_active: true,
        });
      }

      // Log decision for learning
      await supabase.from("ai_decision_log").insert({
        user_id: user.id,
        decision_type: "email_group_assignment",
        input_context: { email_address: sender.email, email_count: sender.emailCount, domain: sender.domain },
        decision_output: { group_name: groupName, group_id: groupId },
        confidence: 1.0,
      });
    }

    setSenders((prev) => prev.filter((s) => !selectedSenders.has(s.email)));
    setSelectedSenders(new Set());
    qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
    toast.success(`${senders.length} mittenti → ${groupName}`);
  };

  // Filter & sort
  const minVolume = volumeFilter === "all" ? 0 : parseInt(volumeFilter);
  const filteredSenders = senders.filter((s) => {
    if (s.emailCount < minVolume) return false;
    if (!searchQuery) return true;
    return s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.companyName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sortedSenders = useMemo(() => {
    const sorted = [...filteredSenders];
    switch (sortOption) {
      case "name-asc": return sorted.sort((a, b) => a.companyName.localeCompare(b.companyName));
      case "name-desc": return sorted.sort((a, b) => b.companyName.localeCompare(a.companyName));
      case "count-asc": return sorted.sort((a, b) => a.emailCount - b.emailCount);
      case "count-desc": return sorted.sort((a, b) => b.emailCount - a.emailCount);
      default: return sorted;
    }
  }, [filteredSenders, sortOption]);

  const totalEmailCount = useMemo(() => senders.reduce((sum, s) => sum + s.emailCount, 0), [senders]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Analisi mittenti…</p>
        </div>
      </div>
    );
  }

  // Group sorting for right panel
  const [groupSortOption, setGroupSortOption] = useState<"alpha" | "count">("alpha");
  const [activeLetterFilter, setActiveLetterFilter] = useState<string | null>(null);

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

  // Letters that have at least one group
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    groups.forEach((g) => {
      const first = g.nome_gruppo.charAt(0).toUpperCase();
      if (/[A-Z]/.test(first)) letters.add(first);
      else letters.add("#");
    });
    return letters;
  }, [groups]);

  const sortedGroups = useMemo(() => {
    let filtered = [...groups];

    // Apply letter filter
    if (activeLetterFilter) {
      if (activeLetterFilter === "#") {
        filtered = filtered.filter((g) => !/^[A-Z]/i.test(g.nome_gruppo));
      } else {
        filtered = filtered.filter((g) =>
          g.nome_gruppo.charAt(0).toUpperCase() === activeLetterFilter
        );
      }
    }

    if (groupSortOption === "alpha") {
      return filtered.sort((a, b) => a.nome_gruppo.localeCompare(b.nome_gruppo));
    } else {
      return filtered.sort((a, b) => {
        const countA = (a as any).assigned_count || 0;
        const countB = (b as any).assigned_count || 0;
        return countB - countA;
      });
    }
  }, [groups, groupSortOption, activeLetterFilter]);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          {sortedSenders.length} da categorizzare su {senders.length} totali
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <Mail className="h-3 w-3" />
          {totalEmailCount.toLocaleString("it-IT")} email totali
        </Badge>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 h-9" placeholder="Cerca mittente…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={volumeFilter} onValueChange={setVolumeFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VOLUME_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
          <SelectTrigger className="w-[140px] h-9">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count-desc">Più email</SelectItem>
            <SelectItem value="count-asc">Meno email</SelectItem>
            <SelectItem value="name-asc">A → Z</SelectItem>
            <SelectItem value="name-desc">Z → A</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={populateAddressRules} disabled={isPopulating}>
          {isPopulating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Popola Address
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nuovo gruppo
        </Button>
      </div>

      {/* Main layout — fixed height, no page scroll */}
      <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
        {/* Sender list — LEFT PANEL with internal scroll */}
        <div className="w-[320px] flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Non classificati ({sortedSenders.length})
              {selectedSenders.size > 0 && (
                <span className="ml-2 font-semibold text-primary">{selectedSenders.size} selezionati</span>
              )}
            </span>
            {sortedSenders.length > 0 && (
              <Checkbox
                checked={selectedSenders.size === sortedSenders.length && sortedSenders.length > 0}
                onCheckedChange={handleSelectAll}
                className="h-4 w-4"
              />
            )}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-2 space-y-2">
              {sortedSenders.length === 0 ? (
                <p className="text-center py-8 text-sm text-muted-foreground">
                  {searchQuery ? "Nessun risultato" : "Tutti i mittenti sono classificati ✅"}
                </p>
              ) : (
                 sortedSenders.map((sender) => (
                  <SenderCard key={sender.email} sender={sender}
                    onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                    onViewEmails={(s) => setEmailPreviewSender(s)}
                    groups={groups}
                    onAssignGroup={assignToGroup}
                    isSelected={selectedSenders.has(sender.email)}
                    onToggleSelect={handleToggleSenderSelection} />
                ))
              )}
            </div>
          </div>
          {selectedSenders.size > 0 && (
            <MultiSelectBulkBar
              selectedSenders={Array.from(selectedSenders)
                .map((email) => sortedSenders.find((s) => s.email === email))
                .filter((s): s is SenderAnalysis => s !== undefined)}
              groups={groups}
              onComplete={() => {
                setSelectedSenders(new Set());
                loadData();
              }}
              onAssignGroup={handleBulkAssignGroup}
            />
          )}
        </div>

        {/* Groups panel — RIGHT PANEL with internal scroll */}
        <div className="flex-1 min-w-0 flex flex-col border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Gruppi ({sortedGroups.length}{activeLetterFilter ? `/${groups.length}` : ""})
            </span>
            <Select value={groupSortOption} onValueChange={(v) => setGroupSortOption(v as "alpha" | "count")}>
              <SelectTrigger className="w-[140px] h-8">
                <ArrowUpDown className="h-3 w-3 mr-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alpha">A → Z</SelectItem>
                <SelectItem value="count">Per contatti</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Alphabet filter bar */}
          <div className="flex items-center gap-0 px-2 py-1.5 border-b bg-muted/10 flex-shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveLetterFilter(null)}
              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                activeLetterFilter === null
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              ALL
            </button>
            {ALPHABET.map((letter) => {
              const hasGroups = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  onClick={() => hasGroups && setActiveLetterFilter(letter === activeLetterFilter ? null : letter)}
                  disabled={!hasGroups}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-semibold rounded transition-colors ${
                    activeLetterFilter === letter
                      ? "bg-primary text-primary-foreground"
                      : hasGroups
                        ? "text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                        : "text-muted-foreground/30 cursor-default"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-4 flex flex-wrap gap-4 content-start">
              {sortedGroups.map((group) => (
                <GroupDropZone key={group.id} group={group} onRefresh={loadData}
                  isHovered={hoveredGroupId === group.id} />
              ))}
              {groups.length === 0 && (
                <p className="text-muted-foreground text-center w-full py-12">Nessun gruppo — creane uno</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateCategoryDialog open={showCreateDialog} onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateCategory} existingNames={groups.map((g) => g.nome_gruppo)} />

      <SenderEmailsDialog
        open={!!emailPreviewSender}
        onOpenChange={(open) => { if (!open) setEmailPreviewSender(null); }}
        emailAddress={emailPreviewSender?.email || ""}
        companyName={emailPreviewSender?.companyName || ""}
      />
    </div>
  );
}
