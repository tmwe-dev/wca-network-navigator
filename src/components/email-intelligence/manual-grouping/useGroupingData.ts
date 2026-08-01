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
import { useMailboxSenderAllowlist } from "@/hooks/useMailboxSenderAllowlist";
import {
  fetchSenderGroupsOrdered,
  fetchAssignedAddressRules,
  fetchUncategorizedAddressRules,
  fetchClassifiedAddressRules,
  fetchInboundEmailSenderAddresses,
  updateAddressRuleEmailCount,
  fetchAddressRuleCounts,
  upsertAddressRules,
  seedDefaultSenderGroups,
  type MailboxFilter,
} from "@/application/data/emailGrouping";

export function useGroupingData() {
  const qc = useQueryClient();
  // Mailbox-awareness: filtriamo i mittenti per casella selezionata.
  // Le regole/gruppi restano condivisi, cambia solo CHI VIENE MOSTRATO.
  const { allowlist, mailboxKey, activeMailbox } = useMailboxSenderAllowlist();
  const [senders, setSenders] = useState<SenderAnalysis[]>([]);
  const [classifiedSenders, setClassifiedSenders] = useState<SenderAnalysis[]>([]);
  const [groups, setGroups] = useState<EmailSenderGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPopulating, setIsPopulating] = useState(false);
  // Map: group_name -> assigned rules (preview list).
  // Lifted out of GroupDropZone so we open ONE channel + ONE query
  // instead of N (one per group) → big perf win when filtering/dragging.
  const [assignedByGroup, setAssignedByGroup] = useState<
    Map<string, Array<{ id: string; email_address: string; display_name: string | null; company_name: string | null; domain: string | null }>>
  >(new Map());

  const loadGroups = async () => {
    const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
    if (!user) return;
    setGroups(await fetchSenderGroupsOrdered());
  };

  /**
   * Load all assigned rules at once, grouped by group_name.
   * Replaces the per-GroupDropZone query that ran N times.
   */
  const loadAssignedRules = async () => {
    const rows = await fetchAssignedAddressRules();
    const map = new Map<string, Array<{ id: string; email_address: string; display_name: string | null; company_name: string | null; domain: string | null }>>();
    for (const r of rows) {
      if (!r.group_name) continue;
      const arr = map.get(r.group_name) || [];
      arr.push({ id: r.id, email_address: r.email_address, display_name: r.display_name, company_name: r.company_name, domain: r.domain });
      map.set(r.group_name, arr);
    }
    setAssignedByGroup(map);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Non autenticato");

      // Load groups
      const loadedGroups = await fetchSenderGroupsOrdered();

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
        const seeded = await seedDefaultSenderGroups(inserts);
        setGroups(seeded.groups);
        if (seeded.kind === "created") {
          toast.success(`${seeded.groups.length} gruppi predefiniti creati`);
        }
      } else {
        setGroups(loadedGroups);
      }

      // Load all visible uncategorized address rules
      // Coerenza: una riga è "non classificata" solo se NESSUNO dei due
      // campi (group_id legacy + group_name) è valorizzato.
      const rules = await fetchUncategorizedAddressRules();

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
        aiSuggestion: r.ai_suggested_group
          ? {
              group_name: r.ai_suggested_group,
              confidence: r.ai_suggestion_confidence ?? 0,
              accepted: r.ai_suggestion_accepted,
            }
          : undefined,
        isBlocked: r.is_blocked === true,
      }));

      // Filtra per mailbox attiva: mostra solo i mittenti che hanno
      // effettivamente scritto nella casella corrente. Se l'allowlist
      // non è ancora pronta (null) mostriamo lista vuota — sarà ripopolata
      // dall'effect che osserva mailboxKey.
      const filteredSenders = allowlist
        ? senderList.filter((s) => allowlist.has(s.email.toLowerCase()))
        : [];
      setSenders(filteredSenders);

      // Load classified senders (have group_id OR group_name) → mostrati nel rail con opacità ridotta.
      const classifiedRules = await fetchClassifiedAddressRules();
      const classifiedDedup = new Map<string, typeof classifiedRules[number] & { _summed: number }>();
      for (const r of classifiedRules) {
        const key = r.email_address.toLowerCase();
        const existing = classifiedDedup.get(key);
        const incoming = r.email_count ?? 0;
        if (!existing) classifiedDedup.set(key, { ...r, _summed: incoming });
        else {
          existing._summed += incoming;
          if (incoming > (existing.email_count ?? 0)) {
            classifiedDedup.set(key, { ...r, _summed: existing._summed });
          }
        }
      }
      const classifiedList: SenderAnalysis[] = Array.from(classifiedDedup.values()).map((r) => ({
        email: r.email_address,
        domain: r.domain || r.email_address.split("@")[1] || "",
        companyName: r.company_name || r.display_name || deriveSenderDisplayName(r.email_address),
        emailCount: r._summed,
        firstSeen: "",
        lastSeen: r.last_email_at || "",
        isClassified: true,
        ruleId: r.id,
        aiSuggestion: r.ai_suggested_group
          ? {
              group_name: r.ai_suggested_group,
              confidence: r.ai_suggestion_confidence ?? 0,
              accepted: r.ai_suggestion_accepted,
            }
          : undefined,
        isBlocked: r.is_blocked === true,
      }));
      const filteredClassified = allowlist
        ? classifiedList.filter((s) => allowlist.has(s.email.toLowerCase()))
        : [];
      setClassifiedSenders(filteredClassified);

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
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return;

      // Get only THIS user's inbound email senders
      // Limita la popolazione regole alla mailbox attiva, così
      // "Popola" non importa indirizzi appartenenti ad altre caselle.
      const mailboxFilter: MailboxFilter | null =
        activeMailbox?.kind === "personal"
          ? { kind: "personal" }
          : activeMailbox?.kind === "shared"
            ? { kind: "shared", mailboxId: activeMailbox.mailbox_id }
            : null;
      const messages = await fetchInboundEmailSenderAddresses({
        userId: user.id,
        mailbox: mailboxFilter,
      });

      // Count per address
      const addressMap = new Map<string, number>();
      for (const msg of messages) {
        const key = (msg.from_address || "").toLowerCase().trim();
        if (!key || !key.includes("@")) continue;
        addressMap.set(key, (addressMap.get(key) || 0) + 1);
      }

      // Check all visible existing rules
      const existing = await fetchAddressRuleCounts();

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
              await updateAddressRuleEmailCount(id, count);
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
          await upsertAddressRules(newRules.slice(i, i + 100));
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
    // Re-load quando cambia mailbox o quando l'allowlist diventa pronta.
     
  }, [mailboxKey, allowlist]);

  return {
    senders,
    setSenders,
    classifiedSenders,
    setClassifiedSenders,
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
