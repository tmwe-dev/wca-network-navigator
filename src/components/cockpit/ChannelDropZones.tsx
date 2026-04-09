import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Linkedin, MessageCircle, Smartphone, BookOpen, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DraftChannel } from "@/pages/Cockpit";

const channels: { id: DraftChannel; label: string; icon: any; hoverBg: string; hoverBorder: string; hoverText: string; requiredField: string }[] = [
  { id: "email", label: "Email", icon: Mail, hoverBg: "bg-primary/10", hoverBorder: "border-primary", hoverText: "text-primary", requiredField: "email" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, hoverBg: "bg-[hsl(210,80%,55%)]/10", hoverBorder: "border-[hsl(210,80%,55%)]", hoverText: "text-[hsl(210,80%,55%)]", requiredField: "linkedinUrl" },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, hoverBg: "bg-[hsl(142,71%,45%)]/10", hoverBorder: "border-[hsl(142,71%,45%)]", hoverText: "text-[hsl(142,71%,45%)]", requiredField: "phone" },
  { id: "sms", label: "SMS / Chat", icon: Smartphone, hoverBg: "bg-accent/20", hoverBorder: "border-accent-foreground/50", hoverText: "text-accent-foreground", requiredField: "phone" },
];

export interface ContactAvailability {
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasLinkedinUrl?: boolean;
}

interface ChannelDropZonesProps {
  isDragging: boolean;
  draggedContactId: string | null;
  dragCount: number;
  onDrop: (channel: DraftChannel, contactId: string, contactName: string) => void;
  onReadProfile?: () => void;
  onDeepSearch?: () => void;
  hasActiveContact?: boolean;
  contactAvailability?: ContactAvailability;
}

export function ChannelDropZones({ isDragging, draggedContactId, dragCount, onDrop, onReadProfile, onDeepSearch, hasActiveContact }: ChannelDropZonesProps) {
  const [hoveredChannel, setHoveredChannel] = useState<DraftChannel>(null);

  // Compact mode: show horizontal row of buttons when not dragging
  if (!isDragging) {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-[400px]">
        {/* Quick actions */}
        {hasActiveContact && (onReadProfile || onDeepSearch) && (
          <div className="flex gap-2 w-full">
            {onReadProfile && (
              <button
                onClick={onReadProfile}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card/80 hover:bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Leggi Profilo
              </button>
            )}
            {onDeepSearch && (
              <button
                onClick={onDeepSearch}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-border/60 bg-card/80 hover:bg-muted/60 text-xs font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                <Search className="w-3.5 h-3.5" />
                Deep Search
              </button>
            )}
          </div>
        )}

        {/* Channel drop zones — same height as contact cards */}
        <div className="flex flex-col gap-3 w-full">
          {channels.map((ch) => {
            const Icon = ch.icon;
            const isHovered = hoveredChannel === ch.id;
            return (
              <div
                key={ch.id}
                onDragOver={(e) => { e.preventDefault(); setHoveredChannel(ch.id); }}
                onDragLeave={() => setHoveredChannel(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setHoveredChannel(null);
                  if (draggedContactId) onDrop(ch.id, draggedContactId, "Contact");
                }}
                className={cn(
                  "flex items-center gap-3 px-5 py-5 rounded-xl border-2 border-dashed transition-all duration-200 min-h-[72px]",
                  !isHovered && "border-border/40 bg-card/40 text-muted-foreground/60",
                  isHovered && cn("border-[3px] shadow-lg", ch.hoverBg, ch.hoverBorder, ch.hoverText),
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                  isHovered ? cn(ch.hoverBg, ch.hoverText) : "bg-muted/40"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={cn("text-sm font-semibold", isHovered && "text-foreground")}>{ch.label}</span>
                {isHovered && (
                  <span className={cn("text-xs font-medium ml-auto", ch.hoverText)}>
                    Rilascia{dragCount > 1 ? ` (×${dragCount})` : ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground/40 text-center">
          Trascina un contatto qui per generare un messaggio
        </p>
      </div>
    );
  }

  // Expanded mode: full drop zones during drag
  return (
    <div className="flex flex-col gap-3 w-full max-w-[360px]">
      {channels.map((ch, i) => {
        const isHovered = hoveredChannel === ch.id;
        const Icon = ch.icon;

        return (
          <motion.div
            key={ch.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{
              opacity: 1,
              scale: isHovered ? 1.03 : 1,
            }}
            transition={{ delay: i * 0.04, duration: 0.2, type: "spring", stiffness: 300, damping: 20 }}
            onDragOver={(e) => { e.preventDefault(); setHoveredChannel(ch.id); }}
            onDragLeave={() => setHoveredChannel(null)}
            onDrop={(e) => {
              e.preventDefault();
              setHoveredChannel(null);
              if (draggedContactId) onDrop(ch.id, draggedContactId, "Contact");
            }}
            className={cn(
              "relative flex items-center gap-3 px-4 py-4 rounded-xl border-2 border-dashed transition-all duration-200",
              !isHovered && "border-muted-foreground/30 bg-card/40",
              isHovered && cn("border-[3px] shadow-lg", ch.hoverBg, ch.hoverBorder),
            )}
          >
            {isHovered && (
              <motion.div
                className={cn("absolute inset-0 rounded-xl opacity-20", ch.hoverBg)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.2 }}
              />
            )}

            <div className={cn(
              "relative w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              isHovered ? cn(ch.hoverBg, ch.hoverText) : "bg-muted/40 text-muted-foreground/60"
            )}>
              <Icon className="w-5 h-5" />
            </div>

            <span className={cn(
              "text-sm font-semibold transition-colors",
              isHovered ? "text-foreground" : "text-muted-foreground"
            )}>
              {ch.label}
            </span>

            {isHovered && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={cn("text-xs font-medium ml-auto", ch.hoverText)}
              >
                Rilascia{dragCount > 1 ? ` (×${dragCount})` : ""}
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
