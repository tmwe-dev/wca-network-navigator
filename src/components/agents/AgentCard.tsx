import { motion } from "framer-motion";
import { Power, PowerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/hooks/useAgents";
import { AGENT_ROLES } from "@/data/agentTemplates";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface Props {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

export function AgentCard({ agent, isSelected, onClick }: Props) {
  const roleMeta = AGENT_ROLES.find((r) => r.value === agent.role);
  const avatarSrc = resolveAgentAvatar(agent.name, agent.avatar_emoji);

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all duration-200 group",
        isSelected
          ? "bg-accent/60 border-primary/40 shadow-sm"
          : "bg-card/50 border-border/50 hover:bg-accent/30 hover:border-border"
      )}
    >
      <div className="flex items-start gap-3">
        {avatarSrc ? (
          <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-border/30">
            <AvatarImage src={avatarSrc} alt={agent.name} />
            <AvatarFallback>{agent.avatar_emoji || "🤖"}</AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-2xl flex-shrink-0">{agent.avatar_emoji || roleMeta?.emoji || "🤖"}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{agent.name}</span>
            {agent.is_active ? (
              <Power className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            ) : (
              <PowerOff className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <span className={cn("text-xs", roleMeta?.color || "text-muted-foreground")}>
            {roleMeta?.label || agent.role}
          </span>
          <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span>{agent.stats?.tasks_completed ?? 0} task</span>
            <span>{(agent.assigned_tools as string[])?.length ?? 0} tool</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
