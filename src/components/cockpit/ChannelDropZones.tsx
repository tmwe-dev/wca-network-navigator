import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Linkedin, MessageCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftChannel } from "@/pages/Cockpit";

const channels: { id: DraftChannel; label: string; icon: any; gradient: string; glowColor: string }[] = [
  { id: "email", label: "Email", icon: Mail, gradient: "from-primary/20 to-primary/5", glowColor: "shadow-primary/20" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, gradient: "from-[hsl(210,80%,45%)]/20 to-[hsl(210,80%,45%)]/5", glowColor: "shadow-[hsl(210,80%,45%)]/20" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, gradient: "from-success/20 to-success/5", glowColor: "shadow-success/20" },
  { id: "sms", label: "SMS / Chat", icon: Smartphone, gradient: "from-chart-3/20 to-chart-3/5", glowColor: "shadow-chart-3/20" },
];

interface ChannelDropZonesProps {
  isDragging: boolean;
  draggedContactId: string | null;
  dragCount: number;
  onDrop: (channel: DraftChannel, contactId: string, contactName: string) => void;
}

export function ChannelDropZones({ isDragging, draggedContactId, dragCount, onDrop }: ChannelDropZonesProps) {
  const [hoveredChannel, setHoveredChannel] = useState<DraftChannel>(null);

  return (
    <div className="grid grid-cols-2 gap-4 w-full max-w-[480px]">
      {channels.map((ch, i) => {
        const isHovered = hoveredChannel === ch.id;
        const Icon = ch.icon;

        return (
          <motion.div
            key={ch.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            onDragOver={(e) => { e.preventDefault(); setHoveredChannel(ch.id); }}
            onDragLeave={() => setHoveredChannel(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHoveredChannel(null);
              if (draggedContactId) {
                onDrop(ch.id, draggedContactId, "Contact");
              }
            }}
            className={cn(
              "relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-default",
              isDragging ? "border-primary/40 bg-gradient-to-br " + ch.gradient : "border-border/60 bg-card/60",
              isHovered && "scale-105 border-primary shadow-xl " + ch.glowColor,
              !isDragging && "hover:border-border/50 hover:bg-card/40"
            )}
          >
            {isHovered && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 to-transparent"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              />
            )}

            <motion.div
              animate={isDragging ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-300",
                isHovered ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
              )}
            >
              <Icon className="w-6 h-6" />
            </motion.div>
            <span className={cn(
              "text-sm font-medium transition-colors duration-300",
              isHovered ? "text-foreground" : "text-muted-foreground"
            )}>
              {ch.label}
            </span>
            {isDragging && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-[11px] text-muted-foreground/70"
              >
                {dragCount > 1 ? `Rilascia ${dragCount} contatti` : "Rilascia qui"}
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
