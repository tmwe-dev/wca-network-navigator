import { motion } from "framer-motion";
import { ArrowDown, Zap, Users, Mail, CheckCircle2 } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface FlowNode {
  label: string;
  type: "trigger" | "action" | "condition" | "end";
  detail?: string;
}

interface FlowCanvasProps {
  nodes: FlowNode[];
  title?: string;
  badge?: string;
  sourceLabel?: string;
}

const nodeIcon = {
  trigger: <Zap className="w-3 h-3 text-warning/70" />,
  action: <Mail className="w-3 h-3 text-primary/70" />,
  condition: <Users className="w-3 h-3 text-accent/70" />,
  end: <CheckCircle2 className="w-3 h-3 text-success/70" />,
};

const nodeBorder = {
  trigger: "border-warning/20",
  action: "border-primary/20",
  condition: "border-accent/20",
  end: "border-success/20",
};

const FlowCanvas = ({ nodes, title, badge, sourceLabel }: FlowCanvasProps) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider ${badge === "LIVE" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
        {badge ?? "DEMO"}
      </span>
      {title && <span className="text-[10px] text-muted-foreground font-mono">{title}</span>}
      {sourceLabel && <span className="text-[9px] text-muted-foreground/60 font-mono ml-auto">{sourceLabel}</span>}
    </div>

    <div className="flex flex-col items-center gap-0">
      {nodes.map((node, i) => (
        <div key={i} className="flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.12 + i * 0.1, duration: 0.4, ease }}
            className={`float-panel-subtle px-5 py-3 rounded-xl border ${nodeBorder[node.type]} flex items-center gap-3 min-w-[200px]`}
          >
            <div className="flex-shrink-0">{nodeIcon[node.type]}</div>
            <div>
              <div className="text-[11px] font-light text-foreground">{node.label}</div>
              {node.detail && <div className="text-[9px] text-muted-foreground font-mono mt-0.5">{node.detail}</div>}
            </div>
          </motion.div>

          {i < nodes.length - 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="py-1"
            >
              <ArrowDown className="w-3 h-3 text-muted-foreground/30" />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  </div>
);

export default FlowCanvas;
