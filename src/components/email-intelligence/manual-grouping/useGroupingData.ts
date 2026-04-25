/**
 * useGroupingData — Data loading and state management for manual grouping.
 * Handles fetching groups, senders, and populating address rules.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { deriveSenderDisplayName } from "@/lib/senderDisplayName";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { EmailSenderGroup, SenderAnalysis } from "@/types/email-management";
import { DEFAULT_GROUPS as PREDEFINED_GROUPS } from "@/types/email-management";

export function useGroupingData() {
  const qc = useQueryClient();
  const [senders, setSenders] = useState<SenderAnalysis[]>([]);
  const [groups, setGroups] = useState<EmailSenderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopulating, setIsPopulating] = useState(false);
  // Map: group_name -> assigned rules (preview list).
  // Lifted out of GroupDropZone so we open ONE channel + ONE query
  // instead of N (one per group) → big perf win when filtering/dragging.
  const [assignedByGroup, setAssignedByGroup] = useState<
    Map<string, Array<{ id: string; email_address: string; display_name: string | null }>>
  >(new Map());

  /**
   * Fetch ALL rows from a query, paginating in chunks of 1000
   * to bypass Supabase default limit.
   */
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

  const loadGroups = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("email_sender_groups")
      .select("*")
      .order("sort_order", { ascending: true });
    setGroups((data || []) as EmailSenderGroup[]);
  };

  /**
   * Load all assigned rules at once, grouped by group_name.
   * Replaces the per-GroupDropZone query that ran N times.
   */
  const loadAssignedRules = async () => {
    const rows = await fetchAllRows<{
      id: string;
      email_address: string;
      display_name: string | null;
      group_name: string | null;
      created_at: string | null;
    }>(
      (from, to) =>
        supabase
          .from("email_address_rules")
          .select("id, email_address, display_name, group_name, created_at")
          .not("group_name", "is", null)
          .order("created_at", { ascending: false })
          .range(from, to),
    );
    const map = new Map<string, Array<{ id: string; email_address: string; display_name: string | null }>>();
    for (const r of rows) {
      if (!r.group_name) continue;
      const arr = map.get(r.group_name) || [];
      arr.push({ id: r.id, email_address: r.email_address, display_name: r.display_name });
      map.set(r.group_name, arr);
    }
    setAssignedByGroup(map);
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
        // Seed predefined groups only when the table is globally empty.
        // Use upsert on lower(nome_gruppo) unique index to be idempotent
        // across multiple users/operators (groups are shared org-wide).
        const inserts = PREDEFINED_GROUPS.map((g, i) => ({
          nome_gruppo: g.name,
          descrizione: g.description,
          colore: g.color,
          icon: g.icon,
          user_id: user.id,
          sort_order: i,
        }));
        const { data: created } = await supabase
          .from("email_sender_groups")
          .upsert(inserts, { onConflict: "nome_gruppo", ignoreDuplicates: true })
          .select();
        if (created && created.length > 0) {
          setGroups(created as EmailSenderGroup[]);
          toast.success(`${created.length} gruppi predefiniti creati`);
        } else {
          // Fallback re-read in case upsert returned nothing
          const { data: reread } = await supabase
            .from("email_sender_groups")
            .select("*")
            .order("sort_order", { ascending: true });
          setGroups((reread || []) as EmailSenderGroup[]);
        }
      } else {
        setGroups(loadedGroups);
      }

      // Load all visible uncategorized address rules
      const rules = await fetchAllRows<{
        id: string;
        email_address: string;
        display_name: string | null;
        email_count: number | null;
        last_email_at: string | null;
        domain: string | null;
        company_name: string | null;
      }>(
        (from, to) =>
          supabase
            .from("email_address_rules")
            .select("id, email_address, display_name, email_count, last_email_at, domain, company_name")
            // Coerenza: una riga è "non classificata" solo se NESSUNO dei due
            // campi (group_id legacy + group_name) è valorizzato.
            .is("group_id", null)
            .is("group_name", null)
            .order("email_count", { ascending: false })
            .range(from, to),
      );

      // Dedup by email_address: rules can exist per-user (shared visibility),
      // so the same address may appear N times. Keep the row with the
      // highest email_count and sum counts across owners for accurate volume.
      const dedupMap = new Map<string, typeof rules[number] & { _summed: number }>();
      for (const r of rules) {
        const key = r.email_address.toLowerCase();
        const existing = dedupMap.get(key);
        const incoming = r.email_count ?? 0;
        if (!existing) {
          dedupMap.set(key, { ...r, _summed: incoming });
        } else {
          existing._summed += incoming;
          // Prefer the row with the higher individual count as the "canonical" id
          if (incoming > (existing.email_count ?? 0)) {
            dedupMap.set(key, { ...r, _summed: existing._summed });
          }
        }
      }

      const senderList: SenderAnalysis[] = Array.from(dedupMap.values()).map((r) => ({
        email: r.email_address,
        domain: r.domain || r.email_address.split("@")[1] || "",
        companyName: r.company_name || r.display_name || deriveSenderDisplayName(r.email_address),
        emailCount: r._summed,
        firstSeen: "",
        lastSeen: r.last_email_at || "",
        isClassified: false,
        ruleId: r.id,
      }));

      setSenders(senderList);
      // After loading uncategorized senders, also refresh assigned-rules map.
      await loadAssignedRules();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore caricamento");
    } finally {
      setIsLoading(false);
    }
  };

  const populateAddressRules = async () => {
    setIsPopulating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get only THIS user's inbound email senders
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

      // Check all visible existing rules
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

      // Update email_count for stale rules
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

  // Subscribe to real-time updates
  useEffect(() => {
    const ch = supabase
      .channel("manual-grouping-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_sender_groups" }, () => loadGroups())
      .on("postgres_changes", { event: "*", schema: "public", table: "email_address_rules" }, () => {
        // Single subscription replaces N per-zone channels.
        loadAssignedRules();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, []);

  return {
    senders,
    setSenders,
    groups,
    setGroups,
    isLoading,
    isPopulating,
    loadData,
    populateAddressRules,
    assignedByGroup,
    reloadAssignedRules: loadAssignedRules,
  };
}
