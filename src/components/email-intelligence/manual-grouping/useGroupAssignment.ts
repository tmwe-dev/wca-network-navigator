/**
 * useGroupAssignment — Group assignment logic including AI decision logging and KB learning.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { EmailSenderGroup, SenderAnalysis } from "@/types/email-management";

export function useGroupAssignment(
  groups: EmailSenderGroup[],
  onSendersChange: (fn: (prev: SenderAnalysis[]) => SenderAnalysis[]) => void,
) {
  const qc = useQueryClient();

  const assignToGroup = useCallback(
    async (sender: SenderAnalysis, groupName: string, groupId: string) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return;

      const group = groups.find((g) => g.id === groupId);
      // operator_id opzionale: alcuni utenti non hanno record in `operators`.
      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const operatorId = opRow?.id ?? null;

      // Update or insert rule
      if (sender.ruleId) {
        await supabase
          .from("email_address_rules")
          .update({
            group_id: groupId,
            group_name: groupName,
            group_color: group?.colore,
            group_icon: group?.icon,
          })
          .eq("id", sender.ruleId);
      } else {
        await supabase.from("email_address_rules").insert({
          email_address: sender.email,
          user_id: user.id,
          operator_id: operatorId,
          group_id: groupId,
          group_name: groupName,
          group_color: group?.colore,
          group_icon: group?.icon,
          domain: sender.domain,
          company_name: sender.companyName,
          email_count: sender.emailCount,
          is_active: true,
        });
      }

      // Log decision for learning
      await supabase.from("ai_decision_log").insert({
        user_id: user.id,
        decision_type: "email_group_assignment",
        input_context: {
          email_address: sender.email,
          email_count: sender.emailCount,
          domain: sender.domain,
        },
        decision_output: { group_name: groupName, group_id: groupId },
        confidence: 1.0,
      });

      // Check domain pattern for auto-learning
      const domain = sender.email.split("@")[1];
      if (domain) {
        const { data: pattern } = await supabase.rpc("check_domain_group_pattern", {
          p_user_id: user.id,
          p_domain: domain,
          p_min_count: 3,
        });

        if (pattern && pattern.length > 0) {
          const p = pattern[0];
          // Check if KB entry already exists
          const { data: existingKb } = await supabase
            .from("kb_entries")
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

      // Update UI and invalidate queries
      onSendersChange((prev) => prev.filter((s) => s.email !== sender.email));
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
      toast.success(`${sender.companyName} → ${groupName}`);
    },
    [groups, onSendersChange, qc],
  );

  const bulkAssignGroup = useCallback(
    async (senders: SenderAnalysis[], groupName: string, groupId: string) => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) return;

      const group = groups.find((g) => g.id === groupId);
      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const operatorId = opRow?.id ?? null;

      for (const sender of senders) {
        if (sender.ruleId) {
          await supabase
            .from("email_address_rules")
            .update({
              group_id: groupId,
              group_name: groupName,
              group_color: group?.colore,
              group_icon: group?.icon,
            })
            .eq("id", sender.ruleId);
        } else {
          await supabase.from("email_address_rules").insert({
            email_address: sender.email,
            user_id: user.id,
            operator_id: operatorId,
            group_id: groupId,
            group_name: groupName,
            group_color: group?.colore,
            group_icon: group?.icon,
            domain: sender.domain,
            company_name: sender.companyName,
            email_count: sender.emailCount,
            is_active: true,
          });
        }

        // Log decision
        await supabase.from("ai_decision_log").insert({
          user_id: user.id,
          decision_type: "email_group_assignment",
          input_context: {
            email_address: sender.email,
            email_count: sender.emailCount,
            domain: sender.domain,
          },
          decision_output: { group_name: groupName, group_id: groupId },
          confidence: 1.0,
        });
      }

      // Update UI
      onSendersChange((prev) => prev.filter((s) => !senders.some((sender) => sender.email === s.email)));
      qc.invalidateQueries({ queryKey: queryKeys.emailIntel.uncategorizedCount });
      toast.success(`${senders.length} mittenti → ${groupName}`);
    },
    [groups, onSendersChange, qc],
  );

  return { assignToGroup, bulkAssignGroup };
}
