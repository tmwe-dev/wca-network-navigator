import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone } from "lucide-react";
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

interface Props {
  contact: Contact;
  flag: string;
  index: number;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const channelIcon: Record<string, any> = {
  email: Mail, linkedin: Linkedin, whatsapp: MessageCircle, sms: Smartphone,
};

const originConfig: Record<ContactOrigin, { label: string; bg: string; text: string; dot: string }> = {
  wca: { label: "WCA", bg: "bg-chart-1/15", text: "text-chart-1", dot: "bg-chart-1" },
  report_aziende: { label: "RA", bg: "bg-chart-4/15", text: "text-chart-4", dot: "bg-chart-4" },
  import: { label: "Import", bg: "bg-chart-3/15", text: "text-chart-3", dot: "bg-chart-3" },
};

export function CockpitContactListItem({ contact, flag, index, isSelected, onToggleSelect, onDragStart, onDragEnd }: Props) {
  const oc = originConfig[contact.origin];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors",
        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-card/60"
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        className="h-3.5 w-3.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground flex-shrink-0" />
      <span className="text-sm">{flag}</span>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground truncate w-[120px]">{contact.name}</span>
        <span className="text-xs text-foreground/80 truncate w-[130px]">{contact.company}</span>
        <span className="text-[11px] text-muted-foreground truncate w-[70px]">{contact.role}</span>
      </div>
      {/* Origin badge */}
      <span
        className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0", oc.bg, oc.text)}
        title={contact.originDetail}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", oc.dot)} />
        {oc.label}
      </span>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {contact.channels.map(ch => {
          const Icon = channelIcon[ch];
          return Icon ? <Icon key={ch} className="w-3 h-3 text-muted-foreground/80" /> : null;
        })}
      </div>
      <span className={cn(
        "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
        contact.priority >= 9 ? "text-destructive bg-destructive/15" :
        contact.priority >= 7 ? "text-warning bg-warning/15" :
        "text-muted-foreground bg-muted"
      )}>
        {contact.priority}
      </span>
    </motion.div>
  );
}
