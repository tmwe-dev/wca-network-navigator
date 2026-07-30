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
import {
  fetchDbFolderCounts,
  hideChannelMessagesByIds,
  setChannelMessagesFolderByIds,
  setChannelMessagesFolderByUids,
  findInboundMessageIdsByAddress,
  findInboundMessageIdsByDomain,
} from "@/data/emailFolders";
import { fetchOperatorIdForUser } from "@/data/emailGrouping";
import {
  findAddressRuleIdByAddressAndOperator,
  updateAddressRuleById,
  insertAddressRuleReturningId,
  getAddressRuleMatchTargets,
} from "@/data/emailAddressRules";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";

export type EmailAction = "archive" | "spam" | "move" | "delete" | "hide";

interface BulkActionInput {
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
      return fetchDbFolderCounts();
    },
    staleTime: 60_000,
  });
}

export function useBulkEmailAction() {
  const qc = useQueryClient();
  const { activeMailbox } = useActiveMailbox();
  const mailboxId = activeMailbox?.kind === "shared" ? activeMailbox.mailbox_id : null;

  return useMutation({
    mutationFn: async ({ messages, action, targetFolder }: BulkActionInput) => {
      // HIDE: solo DB
      if (action === "hide") {
        const ids = messages.map(m => m.id);
        await hideChannelMessagesByIds(ids);
        return { hidden: ids.length };
      }

      const uids = messages.map(m => m.imap_uid).filter((u): u is number => u != null);
      if (uids.length === 0) {
        // Nessun UID IMAP — solo update folder DB
        const folder =
          action === "archive" ? "Archive" :
          action === "spam" ? "Junk" :
          action === "delete" ? "Trash" :
          (targetFolder || "Archive");
        await setChannelMessagesFolderByIds(
          messages.map(m => m.id),
          folder,
          action === "delete",
        );
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
        headers: mailboxId ? { "x-mailbox-id": mailboxId } : undefined,
      });

      // Sync folder lato DB
      const folder = result?.folder ||
        (action === "archive" ? "Archive" :
         action === "spam" ? "Junk" :
         action === "delete" ? "Trash" :
         targetFolder!);
      await setChannelMessagesFolderByUids(uids, folder, action === "delete");

      return { moved: result?.moved ?? 0, folder };
    },
    onSuccess: (res, vars) => {
      const labels: Record<EmailAction, string> = {
        archive: "Archiviate", spam: "Spostate in spam", move: "Spostate", delete: "Cestinate", hide: "Nascoste",
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

interface CreateRuleFromMessageInput {
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
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");
      const operator_id = await fetchOperatorIdForUser(user.id);

      // Upsert regola (per email_address univoca per operator)
      const params = input.target_folder ? { target_folder: input.target_folder } : {};
      const existingId = await findAddressRuleIdByAddressAndOperator(
        input.email_address,
        operator_id ?? "",
      );

      let ruleId: string;
      if (existingId) {
        await updateAddressRuleById(existingId, {
          auto_action: input.auto_action,
          auto_action_params: params,
          auto_execute: input.auto_execute,
          display_name: input.display_name,
          is_active: true,
        });
        ruleId = existingId;
      } else {
        ruleId = await insertAddressRuleReturningId({
          user_id: user.id,
          operator_id,
          email_address: input.email_address,
          address: input.email_address,
          display_name: input.display_name,
          auto_action: input.auto_action,
          auto_action_params: params,
          auto_execute: input.auto_execute,
          is_active: true,
        });
      }

      // Applica retroattivamente
      if (input.apply_to_history && operator_id) {
        const ids = await findInboundMessageIdsByAddress(input.email_address);
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

function useApplyRulesToHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Not authenticated");
      const operator_id = await fetchOperatorIdForUser(user.id);
      if (!operator_id) throw new Error("Operatore non trovato");

      const rule = await getAddressRuleMatchTargets(ruleId);
      if (!rule) throw new Error("Regola non trovata");

      const target = (rule.address || rule.email_address || "").toLowerCase();
      const dom = (rule.domain_pattern || rule.domain || "").toLowerCase();

      let ids: string[];
      if (target) {
        ids = await findInboundMessageIdsByAddress(target);
      } else if (dom) {
        ids = await findInboundMessageIdsByDomain(dom);
      } else {
        throw new Error("Regola senza address né domain");
      }
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
