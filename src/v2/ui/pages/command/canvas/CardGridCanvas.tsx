import { motion } from "framer-motion";
import { User, Clock, ArrowRight } from "lucide-react";

const ease = [0.2, 0.8, 0.2, 1] as const;

export interface CardGridItem {
  name: string;
  company: string;
  lastContact: string;
  action: string;
  avatar?: string;
}

interface CardGridCanvasProps {
  items: CardGridItem[];
}

const CardGridCanvas = ({ items }: CardGridCanvasProps) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2">
      <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-semibold tracking-wider bg-warning/20 text-warning">DEMO</span>
      <span className="text-[10px] text-muted-foreground font-mono">{items.length} contatti inattivi</span>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((item, i) => (
        <motion.div
          key={item.name}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease }}
          className="float-panel-interactive p-4 rounded-xl group cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-primary/60" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-light text-foreground truncate">{item.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{item.company}</div>
              <div className="flex items-center gap-1 mt-1.5">
                <Clock className="w-2.5 h-2.5 text-muted-foreground/50" />
                <span className="text-[9px] text-muted-foreground font-mono">{item.lastContact}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/10 flex items-center justify-between">
            <span className="text-[9px] text-primary/70 font-light">{item.action}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors duration-300" />
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default CardGridCanvas;
