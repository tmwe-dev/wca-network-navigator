/**
 * useEmailAddressGroups — Mappa email_address_rules per l'utente corrente
 * a una struttura indicizzata per indirizzo email (lowercase) per mostrare
 * il gruppo di appartenenza nelle inbox e nei dettagli messaggio.
 *
 * Sorgente di verità: tabella `email_address_rules` (DAL `findEmailAddressRules`).
 * Lettura sola: nessun side-effect, nessun update.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import { findEmailAddressRules } from "@/data/emailAddressRules";
import { untypedFrom } from "@/lib/supabaseUntyped";

export interface EmailGroupInfo {
  groupName: string | null;
  groupColor: string | null;
  groupIcon: string | null;
  category: string | null;
}

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return addr || null;
}

export function useEmailAddressGroups() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: groupsByName } = useQuery({
    queryKey: ["email-address-groups", "groups", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await untypedFrom("email_sender_groups")
        .select("nome_gruppo, colore, icon")
        ;
      if (error) return new Map<string, { color: string | null; icon: string | null }>();
      const map = new Map<string, { color: string | null; icon: string | null }>();
      (data ?? []).forEach((g: { nome_gruppo: string; colore: string | null; icon: string | null }) => {
        map.set(g.nome_gruppo, { color: g.colore, icon: g.icon });
      });
      return map;
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["email-address-groups", "rules", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => findEmailAddressRules(userId!),
  });

  const byEmail = useMemo(() => {
    const map = new Map<string, EmailGroupInfo>();
    (rules ?? []).forEach((r) => {
      const key = (r.email_address || "").toLowerCase();
      if (!key) return;
      const groupName = r.group_name ?? null;
      const fromGroup = groupName ? groupsByName?.get(groupName) : undefined;
      map.set(key, {
        groupName,
        groupColor: fromGroup?.color ?? null,
        groupIcon: fromGroup?.icon ?? null,
        category: r.category ?? null,
      });
    });
    return map;
  }, [rules, groupsByName]);

  function getGroup(rawAddress: string | null | undefined): EmailGroupInfo | null {
    const addr = extractEmail(rawAddress);
    if (!addr) return null;
    const exact = byEmail.get(addr);
    if (exact) return exact;
    const domain = addr.split("@")[1];
    if (!domain) return null;
    // Match domain-level rule (es. "@github.com" or "github.com")
    const domainHit = byEmail.get(`@${domain}`) || byEmail.get(domain);
    return domainHit ?? null;
  }

  return { getGroup, byEmail };
}