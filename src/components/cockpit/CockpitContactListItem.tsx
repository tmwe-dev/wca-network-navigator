import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/lib/utils";
import type { ContactOrigin } from "@/pages/Cockpit";
import { ContactActionMenu } from "./ContactActionMenu";
import type { CockpitContact } from "@/hooks/useCockpitContacts";

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
  phone?: string;
  linkedinUrl?: string;
  origin: ContactOrigin;
  originDetail: string;
  deepSearchAt?: string;
  enrichmentData?: any;
}

interface Props {
  contact: Contact;
  cockpitContact?: CockpitContact;
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
  bca: { label: "BCA", bg: "bg-amber-500/15", text: "text-amber-500", dot: "bg-amber-500" },
  manual: { label: "Manuale", bg: "bg-emerald-500/15", text: "text-emerald-500", dot: "bg-emerald-500" },
};

const priorityLabel = (p: number) => p >= 9 ? "Urgente" : p >= 7 ? "Alta" : p >= 5 ? "Media" : "Bassa";

export function CockpitContactListItem({ contact, cockpitContact, flag, index, isSelected, onToggleSelect, onDragStart, onDragEnd }: Props) {
  const oc = originConfig[contact.origin];
  const isAiProcessed = !!contact.deepSearchAt;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03, duration: 0.2 }}
        draggable
        onDragStart={onDragStart}
        onDragStartCapture={(e: React.DragEvent) => {
          const el = e.currentTarget as HTMLElement;
          const clone = el.cloneNode(true) as HTMLElement;
          clone.style.transform = "scale(0.5)";
          clone.style.transformOrigin = "top left";
          clone.style.position = "absolute";
          clone.style.top = "-9999px";
          clone.style.width = `${el.offsetWidth}px`;
          document.body.appendChild(clone);
          e.dataTransfer.setDragImage(clone, el.offsetWidth * 0.25, 10);
          requestAnimationFrame(() => document.body.removeChild(clone));
        }}
        onDragEnd={onDragEnd}
        className={cn(
          "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors",
          isAiProcessed
            ? isSelected ? "bg-amber-500/10 border border-amber-400/30" : "bg-amber-500/[0.08] hover:bg-amber-500/10"
            : contact.origin === "bca"
            ? isSelected ? "bg-amber-500/10 border border-amber-500/30" : "hover:bg-amber-500/5"
            : isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-card/60"
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
          <span className="text-sm font-medium text-foreground truncate w-[120px] flex items-center gap-1">
            {contact.name}
            {isAiProcessed && <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />}
          </span>
          <span className="text-xs text-foreground/80 truncate w-[130px]">{contact.company}</span>
          <span className="text-[11px] text-muted-foreground truncate w-[70px]">{contact.role}</span>
        </div>
        {/* Origin badge */}
        <InfoTooltip content={`Origine: ${contact.originDetail}`}>
          <span
            className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0", oc.bg, oc.text)}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", oc.dot)} />
            {oc.label}
          </span>
        </InfoTooltip>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {contact.channels.map(ch => {
            const Icon = channelIcon[ch];
            if (!Icon) return null;
            const isAvailable = ch === "email" ? !!contact.email
              : ch === "linkedin" ? !!contact.linkedinUrl
              : !!contact.phone;
            return (
              <InfoTooltip key={ch} content={isAvailable ? `${ch} disponibile` : `${ch} non disponibile`}>
                <span><Icon className={cn("w-3 h-3", isAvailable ? "text-muted-foreground/80" : "text-muted-foreground/25")} /></span>
              </InfoTooltip>
            );
          })}
        </div>
        <InfoTooltip content={`Priorità ${contact.priority} — ${priorityLabel(contact.priority)}`}>
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0",
            contact.priority >= 9 ? "text-destructive bg-destructive/15" :
            contact.priority >= 7 ? "text-warning bg-warning/15" :
            "text-muted-foreground bg-muted"
          )}>
            {contact.priority}
          </span>
        </InfoTooltip>
        {cockpitContact && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>
            <ContactActionMenu contact={cockpitContact} />
          </div>
        )}
      </motion.div>
    </TooltipProvider>
  );
}
