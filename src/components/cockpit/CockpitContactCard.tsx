import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone, Search, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ContactOrigin } from "@/pages/Cockpit";

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
  origin: ContactOrigin;
  originDetail: string;
}

interface CockpitContactCardProps {
  contact: Contact;
  flag: string;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDeepSearch: () => void;
  onAlias: () => void;
}

const channelIcon: Record<string, any> = {
  email: Mail, linkedin: Linkedin, whatsapp: MessageCircle, sms: Smartphone,
};

const priorityColor = (p: number) => {
  if (p >= 9) return "bg-destructive/20 text-destructive border-destructive/30";
  if (p >= 7) return "bg-warning/20 text-warning border-warning/30";
  if (p >= 5) return "bg-primary/20 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
};

const originConfig: Record<ContactOrigin, { label: string; bg: string; text: string; border: string; dot: string }> = {
  wca: {
    label: "WCA",
    bg: "bg-chart-1/15",
    text: "text-chart-1",
    border: "border-chart-1/30",
    dot: "bg-chart-1",
  },
  report_aziende: {
    label: "RA",
    bg: "bg-chart-4/15",
    text: "text-chart-4",
    border: "border-chart-4/30",
    dot: "bg-chart-4",
  },
  import: {
    label: "Import",
    bg: "bg-chart-3/15",
    text: "text-chart-3",
    border: "border-chart-3/30",
    dot: "bg-chart-3",
  },
};

// Left accent bar color per origin
const originAccent: Record<ContactOrigin, string> = {
  wca: "from-chart-1/60 to-chart-1/10",
  report_aziende: "from-chart-4/60 to-chart-4/10",
  import: "from-chart-3/60 to-chart-3/10",
};

export function CockpitContactCard({ contact, flag, index, isSelected, onToggleSelect, onDragStart, onDragEnd, onDeepSearch, onAlias }: CockpitContactCardProps) {
  const oc = originConfig[contact.origin];

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
      className={cn(
        "group relative rounded-xl border bg-card backdrop-blur-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden",
        isSelected
          ? "border-primary/60 bg-primary/5 shadow-md shadow-primary/10"
          : "border-border/80 hover:border-primary/30"
      )}
    >
      {/* Left accent bar based on origin */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l-xl", originAccent[contact.origin])} />

      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative flex gap-3">
        {/* Checkbox + Drag Handle */}
        <div className="flex flex-col items-center gap-1.5 pt-0.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            className="h-3.5 w-3.5"
            onClick={(e) => e.stopPropagation()}
          />
          <GripVertical className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
                <span className="text-sm">{flag}</span>
              </div>
              <div className="text-xs text-foreground/80 truncate">{contact.company}</div>
              <div className="text-[11px] text-muted-foreground">{contact.role}</div>
            </div>
            {/* Origin badge + Priority */}
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span
                className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md border flex items-center gap-1", oc.bg, oc.text, oc.border)}
                title={contact.originDetail}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", oc.dot)} />
                {oc.label}
              </span>
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", priorityColor(contact.priority))}>
                P{contact.priority}
              </span>
            </div>
          </div>

          {/* Origin detail line */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/90 mb-2">
            <span className={cn("truncate max-w-[140px]", oc.text)} title={contact.originDetail}>
              {contact.originDetail}
            </span>
            <span>·</span>
            <span>{contact.language}</span>
            <span>·</span>
            <span>{contact.lastContact}</span>
          </div>

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
              <button
                className="p-1 rounded-md text-muted-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors"
                title="Deep Search"
                onClick={(e) => { e.stopPropagation(); onDeepSearch(); }}
              >
                <Search className="w-3 h-3" />
              </button>
              <button
                className="p-1 rounded-md text-muted-foreground/80 hover:text-chart-3 hover:bg-chart-3/10 transition-colors"
                title="Genera Alias"
                onClick={(e) => { e.stopPropagation(); onAlias(); }}
              >
                <Sparkles className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
