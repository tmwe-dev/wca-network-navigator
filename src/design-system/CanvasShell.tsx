import { motion } from "framer-motion";
import { Download, X } from "lucide-react";
import type { ReactNode } from "react";

interface CanvasShellProps {
  children: ReactNode;
  onClose: () => void;
  title: string;
}

const CanvasShell = ({ children, onClose, title }: CanvasShellProps) => (
  <div
    className="h-full flex flex-col rounded-2xl p-6"
    style={{
      background: "hsl(var(--card) / 0.75)",
      backdropFilter: "blur(40px) saturate(1.1)",
      border: "1px solid hsl(var(--foreground) / 0.12)",
      boxShadow: "0 0 80px hsl(var(--primary) / 0.03), 0 30px 60px -20px hsl(0 0% 0% / 0.65)",
    }}
  >
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{ opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-[10px] text-muted-foreground font-mono tracking-wider">{title}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="text-muted-foreground hover:text-foreground transition-colors duration-500 p-1.5">
          <Download className="w-3 h-3" />
        </button>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors duration-500 p-1.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">{children}</div>
  </div>
);

export default CanvasShell;
