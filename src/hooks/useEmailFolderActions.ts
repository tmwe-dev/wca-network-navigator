/**
 * useEmailFolderActions — Mutazioni IMAP folder + regole email lato UI.
 *
 * Wrappa le edge function:
 *  - manage-email-folders (move/archive/spam/list/create)
 *  - apply-email-rules (esecuzione retroattiva regole)
 *
 * Aggiorna anche channel_messages.folder/hidden_by_rule lato DB
 * (l'edge function manage-email-folders aggiorna già category, qui aggiorniamo
 * folder esplicitamente).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

export type EmailAction = "archive" | "spam" | "move" | "hide";

export interface BulkActionInput {
  messages: Array<{ id: string; imap_uid: number | null }>;
  action: EmailAction;
  targetFolder?: string;
}

interface FolderListResponse {
  folders?: Array<{ name: string; flags: string }>;
}

export function useImapFolders() {
  return useQuery({
    queryKey: ["imap-folders"],
    queryFn: async (): Promise<string[]> => {
      const result = await invokeEdge<FolderListResponse>("manage-email-folders", {
        body: { action: "list_folders" },
        context: "useImapFolders",
      });
      return (result?.folders ?? []).map(f => f.name);
    },
    staleTime: 5 * 60_000,
  });
}

export function useDbFolders() {
  return useQuery({
    queryKey: ["db-email-folders"],
    queryFn: async (): Promise<Array<{ folder: string; count: number }>> => {
      // RPC-less: select + group lato client
      const { data, error } = await supabase
        .from("channel_messages")
        .select("folder")
        .eq("channel", "email")
        .eq("direction", "inbound")
        .eq("hidden_by_rule", false);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data ?? []).forEach((row: { folder: string | null }) => {
        const f = row.folder || "INBOX";
        counts.set(f, (counts.get(f) ?? 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([folder, count]) => ({ folder, count }))
        .sort((a, b) => a.folder.localeCompare(b.folder));
    },
    staleTime: 60_000,
  });
}

export function useBulkEmailAction() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ messages, action, targetFolder }: BulkActionInput) => {
      // HIDE: solo DB
      if (action === "hide") {
        const ids = messages.map(m => m.id);
        const { error } = await supabase
          .from("channel_messages")
          .update({ hidden_by_rule: true })
          .in("id", ids);
        if (error) throw error;
        return { hidden: ids.length };
      }

      const uids = messages.map(m => m.imap_uid).filter((u): u is number => u != null);
      if (uids.length === 0) {
        // Nessun UID IMAP — solo update folder DB
        const folder = action === "archive" ? "Archive" : action === "spam" ? "Junk" : (targetFolder || "Archive");
        const { error } = await supabase
          .from("channel_messages")
          .update({ folder })
          .in("id", messages.map(m => m.id));
        if (error) throw error;
        return { dbOnly: messages.length };
      }

      // Edge function IMAP
      const result = await invokeEdge<{ moved?: number; folder?: string }>("manage-email-folders", {
        body: {
          action,
          uids: uids.map(String),
          ...(targetFolder ? { target_folder: targetFolder } : {}),
        },
        context: `useBulkEmailAction.${action}`,
      });

      // Sync folder lato DB
      const folder = result?.folder || (action === "archive" ? "Archive" : action === "spam" ? "Junk" : targetFolder!);
      await supabase
        .from("channel_messages")
        .update({ folder })
        .in("imap_uid", uids);

      return { moved: result?.moved ?? 0, folder };
    },
    onSuccess: (res, vars) => {
      const labels: Record<EmailAction, string> = {
        archive: "Archiviate", spam: "Spostate in spam", move: "Spostate", hide: "Nascoste",
      };
      toast.success(`${labels[vars.action]} (${vars.messages.length})`);
      qc.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
      qc.invalidateQueries({ queryKey: ["db-email-folders"] });
      qc.invalidateQueries({ queryKey: queryKeys.email.classifications });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Errore operazione");
    },
  });
}

export interface CreateRuleFromMessageInput {
  email_address: string;
  display_name?: string | null;
  auto_action: string; // 'mark_read' | 'archive' | 'hide' | 'move_to_folder' | 'spam'
  auto_execute: boolean;
  target_folder?: string;
  apply_to_history?: boolean;
}

export function useCreateRuleFromSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRuleFromMessageInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: opRow } = await supabase
        .from("operators").select("id").eq("user_id", user.id).maybeSingle();
      const operator_id = opRow?.id;

      // Upsert regola (per email_address univoca per operator)
      const params = input.target_folder ? { target_folder: input.target_folder } : {};
      const { data: existing } = await supabase
        .from("email_address_rules")
        .select("id")
        .eq("email_address", input.email_address)
        .eq("operator_id", operator_id ?? "")
        .maybeSingle();

      let ruleId: string;
      if (existing?.id) {
        const { error } = await supabase
          .from("email_address_rules")
          .update({
            auto_action: input.auto_action,
            auto_action_params: params,
            auto_execute: input.auto_execute,
            display_name: input.display_name,
            is_active: true,
          })
          .eq("id", existing.id);
        if (error) throw error;
        ruleId = existing.id;
      } else {
        const { data: ins, error } = await supabase
          .from("email_address_rules")
          .insert({
            user_id: user.id,
            operator_id,
            email_address: input.email_address,
            address: input.email_address,
            display_name: input.display_name,
            auto_action: input.auto_action,
            auto_action_params: params,
            auto_execute: input.auto_execute,
            is_active: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        ruleId = ins.id;
      }

      // Applica retroattivamente
      if (input.apply_to_history && operator_id) {
        const { data: msgs } = await supabase
          .from("channel_messages")
          .select("id")
          .eq("from_address", input.email_address)
          .eq("channel", "email")
          .eq("direction", "inbound")
          .limit(500);
        const ids = (msgs ?? []).map((m: { id: string }) => m.id);
        if (ids.length > 0) {
          await invokeEdge("apply-email-rules", {
            body: { operator_id, message_ids: ids },
            context: "useCreateRuleFromSender.applyHistory",
          });
        }
      }

      return { ruleId };
    },
    onSuccess: () => {
      toast.success("Regola creata e applicata");
      qc.invalidateQueries({ queryKey: queryKeys.email.addressRulesTab4 });
      qc.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
      qc.invalidateQueries({ queryKey: ["db-email-folders"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Errore creazione regola");
    },
  });
}

export function useApplyRulesToHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: opRow } = await supabase
        .from("operators").select("id").eq("user_id", user.id).maybeSingle();
      const operator_id = opRow?.id;
      if (!operator_id) throw new Error("Operatore non trovato");

      const { data: rule } = await supabase
        .from("email_address_rules")
        .select("email_address, domain, address, domain_pattern")
        .eq("id", ruleId)
        .maybeSingle();
      if (!rule) throw new Error("Regola non trovata");

      const target = (rule.address || rule.email_address || "").toLowerCase();
      const dom = (rule.domain_pattern || rule.domain || "").toLowerCase();

      let q = supabase
        .from("channel_messages")
        .select("id")
        .eq("channel", "email")
        .eq("direction", "inbound")
        .limit(500);
      if (target) {
        q = q.eq("from_address", target);
      } else if (dom) {
        q = q.ilike("from_address", `%@${dom}`);
      } else {
        throw new Error("Regola senza address né domain");
      }
      const { data: msgs } = await q;
      const ids = (msgs ?? []).map((m: { id: string }) => m.id);
      if (ids.length === 0) return { applied: 0 };
      const result = await invokeEdge<{ applied?: number }>("apply-email-rules", {
        body: { operator_id, message_ids: ids },
        context: "useApplyRulesToHistory",
      });
      return { applied: result?.applied ?? 0, total: ids.length };
    },
    onSuccess: (res) => {
      toast.success(`Applicata a ${res.applied}/${res.total ?? "?"} email storiche`);
      qc.invalidateQueries({ queryKey: queryKeys.email.addressRulesTab4 });
      qc.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Errore applicazione storica");
    },
  });
}
