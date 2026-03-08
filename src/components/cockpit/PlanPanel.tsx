import { motion } from "framer-motion";
import { CalendarClock, Phone, Users, RotateCcw, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftChannel } from "@/pages/Cockpit";

const planActions = [
  { id: "email" as DraftChannel, label: "Email programmata", icon: Mail, gradient: "from-primary/20 to-primary/5" },
  { id: "linkedin" as DraftChannel, label: "Follow-up LinkedIn", icon: Users, gradient: "from-[hsl(210,80%,45%)]/20 to-[hsl(210,80%,45%)]/5" },
  { id: "whatsapp" as DraftChannel, label: "Chiamata / Meeting", icon: Phone, gradient: "from-success/20 to-success/5" },
  { id: "sms" as DraftChannel, label: "Promemoria", icon: RotateCcw, gradient: "from-chart-3/20 to-chart-3/5" },
];

interface PlanPanelProps {
  isDragging: boolean;
  draggedContactId: string | null;
  dragCount: number;
  onDrop: (channel: DraftChannel, contactId: string, contactName: string) => void;
}

export function PlanPanel({ isDragging, draggedContactId, dragCount, onDrop }: PlanPanelProps) {
  if (!isDragging) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.4, 0.6, 0.4] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-chart-3/10 to-primary/10 flex items-center justify-center"
        >
          <CalendarClock className="w-7 h-7 text-chart-3/70" />
        </motion.div>
        <h3 className="text-sm font-medium text-foreground">Pianifica Attività</h3>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Trascina un contatto qui per generare un'email e salvarla come attività pianificata nel circuito di attesa
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 w-full max-w-[480px] p-8">
      {planActions.map((action, i) => (
        <motion.div
          key={action.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            if (draggedContactId) onDrop(action.id, draggedContactId, "Contact");
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all duration-300",
            "border-chart-3/40 bg-gradient-to-br", action.gradient,
            "hover:scale-105 hover:border-chart-3 hover:shadow-lg"
          )}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center bg-chart-3/10 text-chart-3"
          >
            <action.icon className="w-6 h-6" />
          </motion.div>
          <span className="text-sm font-medium text-muted-foreground">{action.label}</span>
          <span className="text-[11px] text-muted-foreground/70">
            {dragCount > 1 ? `Rilascia ${dragCount} contatti` : "Rilascia qui"}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
