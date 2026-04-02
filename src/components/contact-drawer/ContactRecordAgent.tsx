import { useAssignmentMap } from "@/hooks/useClientAssignments";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Bot, UserCheck } from "lucide-react";

interface Props {
  sourceId: string;
}

export function ContactRecordAgent({ sourceId }: Props) {
  const assignmentMap = useAssignmentMap();
  const assignment = assignmentMap.get(sourceId);

  const { data: agent } = useQuery({
    queryKey: ["agent-for-record", assignment?.agent_id],
    queryFn: async () => {
      if (!assignment?.agent_id) return null;
      const { data } = await supabase
        .from("agents")
        .select("id, name, avatar_emoji, role")
        .eq("id", assignment.agent_id)
        .single();
      return data;
    },
    enabled: !!assignment?.agent_id,
  });

  if (!assignment || !agent) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
        <Bot className="w-4 h-4" />
        <span>Nessun agente assegnato</span>
      </div>
    );
  }

  const avatarSrc = resolveAgentAvatar(agent.name, agent.avatar_emoji);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <UserCheck className="w-3.5 h-3.5 text-primary" />
        Agente di Riferimento
      </div>
      <div className="flex items-center gap-3 bg-primary/5 border border-primary/15 rounded-xl p-3">
        {avatarSrc ? (
          <img src={avatarSrc} alt={agent.name} className="w-8 h-8 rounded-full ring-2 ring-primary/20" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary ring-2 ring-primary/20">
            {agent.avatar_emoji || agent.name.charAt(0)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-foreground">{agent.name}</div>
          <div className="text-[11px] text-muted-foreground">{agent.role}</div>
        </div>
      </div>
    </div>
  );
}