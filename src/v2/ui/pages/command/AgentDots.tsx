import { motion } from "framer-motion";
import { useState } from "react";

interface AgentDot {
  name: string;
  status: "idle" | "running" | "error";
  lastAction: string;
}

const agents: AgentDot[] = [
  { name: "Partner Scout", status: "idle", lastAction: "Scan rete completato 2h fa" },
  { name: "Outreach Runner", status: "running", lastAction: "Invio batch Asia in corso…" },
  { name: "Follow-up Watcher", status: "idle", lastAction: "Nessuna azione recente" },
];

const statusColor = {
  idle: "bg-muted-foreground/30",
  running: "bg-success/60",
  error: "bg-destructive/60",
};

const AgentDots = () => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-muted-foreground/40 font-mono tracking-wider mr-1">AGENTI</span>
      {agents.map((agent, i) => (
        <div key={agent.name} className="relative">
          <motion.div
            className={`w-2 h-2 rounded-full cursor-pointer ${statusColor[agent.status]}`}
            whileHover={{ scale: 1.4 }}
            animate={agent.status === "running" ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={agent.status === "running" ? { duration: 1.5, repeat: Infinity } : { duration: 0.2 }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
          {hoveredIdx === i && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-5 right-0 z-50 float-panel p-2.5 rounded-lg whitespace-nowrap"
            >
              <div className="text-[10px] font-light text-foreground">{agent.name}</div>
              <div className="text-[8px] text-muted-foreground font-mono mt-0.5">{agent.status.toUpperCase()}</div>
              <div className="text-[8px] text-muted-foreground/60 mt-0.5">{agent.lastAction}</div>
            </motion.div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AgentDots;
