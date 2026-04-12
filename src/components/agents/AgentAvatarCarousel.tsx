import { useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agent } from "@/hooks/useAgents";
import { resolveAgentAvatar } from "@/data/agentAvatars";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const roleBadgeColor: Record<string, string> = {
  account: "bg-primary/20 text-primary",
  strategy: "bg-primary/20 text-primary",
  sales: "bg-emerald-500/20 text-emerald-400",
  research: "bg-muted text-muted-foreground",
  download: "bg-muted text-muted-foreground",
  outreach: "bg-primary/20 text-primary",
};

interface Props {
  agents: Agent[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function AgentAvatarCarousel({ agents, activeId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  return (
    <div className="relative flex items-center gap-1 px-2 py-3">
      <button
        onClick={() => scroll(-1)}
        className="flex-shrink-0 p-1.5 rounded-full bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        ref={scrollRef}
        className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory px-1"
        style={{ scrollbarWidth: "none" }}
      >
        {agents.map((agent) => {
          const isActive = agent.id === activeId;
          const badge = roleBadgeColor[agent.role] || "bg-muted text-muted-foreground";
          const avatarSrc = resolveAgentAvatar(agent.name, agent.avatar_emoji);

          return (
            <motion.button
              key={agent.id}
              onClick={() => onSelect(agent.id)}
              className={cn(
                "flex-shrink-0 snap-center flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-[90px]",
                isActive
                  ? "bg-primary/10 ring-1 ring-primary/40 shadow-[0_0_16px_hsl(var(--primary)/0.15)]"
                  : "hover:bg-muted/30"
              )}
              animate={{ scale: isActive ? 1.08 : 0.95, opacity: isActive ? 1 : 0.6 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              whileTap={{ scale: 0.92 }}
            >
              {avatarSrc ? (
                <Avatar className={cn("transition-all", isActive ? "h-10 w-10" : "h-8 w-8")}>
                  <AvatarImage src={avatarSrc} alt={agent.name} />
                  <AvatarFallback>{agent.avatar_emoji}</AvatarFallback>
                </Avatar>
              ) : (
                <span className={cn("text-2xl transition-all", isActive && "text-3xl")}>
                  {agent.avatar_emoji}
                </span>
              )}
              <span className={cn("text-[11px] font-medium truncate max-w-[80px]", isActive ? "text-foreground" : "text-muted-foreground")}>
                {agent.name}
              </span>
              <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium capitalize", badge)}>
                {agent.role}
              </span>
            </motion.button>
          );
        })}
      </div>

      <button
        onClick={() => scroll(1)}
        className="flex-shrink-0 p-1.5 rounded-full bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
