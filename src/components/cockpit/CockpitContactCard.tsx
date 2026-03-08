import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  name: string;
  company: string;
  role: string;
  country: string;
  language: string;
  lastContact: string;
  priority: number;
  channels: string[];
  email: string;
}

interface CockpitContactCardProps {
  contact: Contact;
  flag: string;
  index: number;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const channelIcon: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  sms: Smartphone,
};

const priorityColor = (p: number) => {
  if (p >= 9) return "bg-destructive/20 text-destructive border-destructive/30";
  if (p >= 7) return "bg-warning/20 text-warning border-warning/30";
  if (p >= 5) return "bg-primary/20 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
};

export function CockpitContactCard({ contact, flag, index, onDragStart, onDragEnd }: CockpitContactCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="group relative rounded-xl border border-border/80 bg-card backdrop-blur-xl p-3.5 cursor-grab active:cursor-grabbing transition-shadow duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30"
    >
      {/* Subtle glow on hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex gap-3">
        {/* Drag Handle */}
        <div className="flex items-center pt-0.5">
          <GripVertical className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
                <span className="text-sm">{flag}</span>
              </div>
              <div className="text-xs text-foreground/80 truncate">{contact.company}</div>
              <div className="text-[11px] text-muted-foreground">{contact.role}</div>
            </div>
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityColor(contact.priority))}>
              P{contact.priority}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/90 mb-2">
            <span>{contact.language}</span>
            <span>·</span>
            <span>{contact.lastContact}</span>
          </div>

          {/* Channels + Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {contact.channels.map(ch => {
                const Icon = channelIcon[ch];
                return Icon ? (
                  <span key={ch} className="p-1 rounded-md bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                    <Icon className="w-3 h-3" />
                  </span>
                ) : null;
              })}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1 rounded-md text-muted-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors" title="Deep Search">
                <Search className="w-3 h-3" />
              </button>
              <button className="p-1 rounded-md text-muted-foreground/80 hover:text-chart-3 hover:bg-chart-3/10 transition-colors" title="AI Generate">
                <Sparkles className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
