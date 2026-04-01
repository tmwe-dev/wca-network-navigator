import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Linkedin, MessageCircle, Smartphone, BookOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftChannel } from "@/pages/Cockpit";

const channels: { id: DraftChannel; label: string; icon: any; hoverBg: string; hoverBorder: string; hoverText: string }[] = [
  { id: "email", label: "Email", icon: Mail, hoverBg: "bg-primary/10", hoverBorder: "border-primary", hoverText: "text-primary" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, hoverBg: "bg-[hsl(210,80%,55%)]/10", hoverBorder: "border-[hsl(210,80%,55%)]", hoverText: "text-[hsl(210,80%,55%)]" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, hoverBg: "bg-[hsl(142,71%,45%)]/10", hoverBorder: "border-[hsl(142,71%,45%)]", hoverText: "text-[hsl(142,71%,45%)]" },
  { id: "sms", label: "SMS / Chat", icon: Smartphone, hoverBg: "bg-accent/20", hoverBorder: "border-accent-foreground/50", hoverText: "text-accent-foreground" },
];

interface ChannelDropZonesProps {
  isDragging: boolean;
  draggedContactId: string | null;
  dragCount: number;
  onDrop: (channel: DraftChannel, contactId: string, contactName: string) => void;
  onReadProfile?: () => void;
  onDeepSearch?: () => void;
  hasActiveContact?: boolean;
}

export function ChannelDropZones({ isDragging, draggedContactId, dragCount, onDrop, onReadProfile, onDeepSearch, hasActiveContact }: ChannelDropZonesProps) {
  const [hoveredChannel, setHoveredChannel] = useState<DraftChannel>(null);

  return (
    <div className="flex flex-col gap-4 w-full max-w-[360px]">
      {/* Quick action bar */}
      {(hasActiveContact || isDragging) && (onReadProfile || onDeepSearch) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2"
        >
          {onReadProfile && (
            <button
              onClick={onReadProfile}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-card/80 hover:bg-muted/60 text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Leggi Profilo
            </button>
          )}
          {onDeepSearch && (
            <button
              onClick={onDeepSearch}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/60 bg-card/80 hover:bg-muted/60 text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
            >
              <Search className="w-4 h-4" />
              Deep Search
            </button>
          )}
        </motion.div>
      )}

      {/* Channel drop zones */}
      {channels.map((ch, i) => {
        const isHovered = hoveredChannel === ch.id;
        const Icon = ch.icon;

        return (
          <motion.div
            key={ch.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{
              opacity: 1,
              scale: isHovered ? 1.04 : 1,
            }}
            transition={{ delay: i * 0.06, duration: 0.3, type: "spring", stiffness: 300, damping: 20 }}
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
              "relative flex flex-row items-center gap-4 p-6 min-h-[80px] rounded-xl border-2 border-dashed transition-all duration-300 cursor-default overflow-hidden",
              !isDragging && "border-border/60 bg-card/60 hover:border-border/50",
              isDragging && !isHovered && "border-muted-foreground/40 bg-card/40 border-[3px]",
              isHovered && cn("border-[3px] shadow-lg", ch.hoverBg, ch.hoverBorder),
            )}
          >
            {/* Glow overlay on hover */}
            {isHovered && (
              <motion.div
                className={cn("absolute inset-0 rounded-xl opacity-30", ch.hoverBg)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ duration: 0.2 }}
              />
            )}

            <div
              className={cn(
                "relative w-14 h-14 rounded-lg flex items-center justify-center transition-all duration-300",
                isHovered
                  ? cn(ch.hoverBg, ch.hoverText)
                  : isDragging
                  ? "bg-muted/40 text-muted-foreground/60"
                  : "bg-muted/50 text-muted-foreground"
              )}
            >
              <Icon className="w-8 h-8" />
            </div>

            <div className="flex flex-col gap-0.5">
              <span className={cn(
                "text-lg font-semibold transition-colors duration-300",
                isHovered ? "text-foreground" : "text-muted-foreground"
              )}>
                {ch.label}
              </span>
              {isHovered && isDragging && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={cn("text-xs font-medium", ch.hoverText)}
                >
                  Rilascia qui{dragCount > 1 ? ` (×${dragCount})` : ""}
                </motion.span>
              )}
            </div>

            {isDragging && !isHovered && dragCount > 1 && (
              <span className="text-xs text-muted-foreground/70 ml-auto">
                ×{dragCount}
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
