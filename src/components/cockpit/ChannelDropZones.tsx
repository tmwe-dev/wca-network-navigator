import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Linkedin, MessageCircle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftChannel } from "@/pages/Cockpit";

const channels: { id: DraftChannel; label: string; icon: any; color: string }[] = [
  { id: "email", label: "Email", icon: Mail, color: "hsl(var(--primary))" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "hsl(210, 80%, 55%)" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "hsl(142, 71%, 45%)" },
  { id: "sms", label: "SMS / Chat", icon: Smartphone, color: "hsl(var(--chart-3))" },
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
    <div className="flex flex-col gap-3 w-full max-w-[240px]">
      {channels.map((ch, i) => {
        const isHovered = hoveredChannel === ch.id;
        const Icon = ch.icon;

        return (
          <motion.div
            key={ch.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: isHovered ? 1.06 : 1,
            }}
            transition={{ delay: i * 0.08, duration: 0.3, type: "spring", stiffness: 300, damping: 20 }}
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
              "relative flex flex-row items-center gap-3 p-5 rounded-xl border-2 border-dashed transition-all duration-300 cursor-default overflow-hidden",
              // Idle state: subtle, neutral
              !isDragging && "border-border/60 bg-card/60 hover:border-border/50",
              // Dragging but NOT hovered: just show it's a valid target, no color
              isDragging && !isHovered && "border-muted-foreground/30 bg-card/40",
              // Hovered = active target: strong highlight
              isHovered && "border-[hsl(210,80%,55%)] bg-[hsl(210,80%,55%)]/8 shadow-lg shadow-[hsl(210,80%,55%)]/15",
            )}
          >
            {/* Glow overlay only on hovered */}
            {isHovered && (
              <motion.div
                className="absolute inset-0 rounded-xl bg-[hsl(210,80%,55%)]/5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
            )}

            <div
              className={cn(
                "relative w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300",
                isHovered
                  ? "bg-[hsl(210,80%,55%)]/15 text-[hsl(210,80%,55%)]"
                  : isDragging
                  ? "bg-muted/40 text-muted-foreground/60"
                  : "bg-muted/50 text-muted-foreground"
              )}
            >
              <Icon className="w-6 h-6" />
            </div>
            <span className={cn(
              "text-base font-medium transition-colors duration-300",
              isHovered ? "text-foreground" : "text-muted-foreground"
            )}>
              {ch.label}
            </span>
            {isDragging && dragCount > 1 && (
              <span className="text-[9px] text-muted-foreground/70 ml-auto">
                ×{dragCount}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
