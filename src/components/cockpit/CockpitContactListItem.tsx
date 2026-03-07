import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone } from "lucide-react";
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

interface Props {
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

export function CockpitContactListItem({ contact, flag, index, onDragStart, onDragEnd }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group flex items-center gap-2 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-card/60 transition-colors"
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 flex-shrink-0" />
      <span className="text-sm">{flag}</span>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="text-sm font-medium text-foreground truncate w-[120px]">{contact.name}</span>
        <span className="text-xs text-muted-foreground truncate w-[140px]">{contact.company}</span>
        <span className="text-[11px] text-muted-foreground/60 truncate w-[80px]">{contact.role}</span>
        <span className="text-[11px] text-muted-foreground/50 w-[80px]">{contact.lastContact}</span>
      </div>
      <div className="flex items-center gap-0.5">
        {contact.channels.map(ch => {
          const Icon = channelIcon[ch];
          return Icon ? <Icon key={ch} className="w-3 h-3 text-muted-foreground/40" /> : null;
        })}
      </div>
      <span className={cn(
        "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
        contact.priority >= 9 ? "text-destructive bg-destructive/15" :
        contact.priority >= 7 ? "text-warning bg-warning/15" :
        "text-muted-foreground bg-muted"
      )}>
        {contact.priority}
      </span>
    </motion.div>
  );
}
