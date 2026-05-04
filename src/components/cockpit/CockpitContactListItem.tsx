import { motion } from "framer-motion";
import { GripVertical, Mail, Linkedin, MessageCircle, Smartphone, Sparkles, Building2, FileSearch, Users, CreditCard, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { cn } from "@/lib/utils";
import type { ContactOrigin } from "@/types/cockpit";
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
  enrichmentData?: Record<string, unknown>;
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

const channelIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail, linkedin: Linkedin, whatsapp: MessageCircle, sms: Smartphone,
};

const originConfig: Record<ContactOrigin, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  wca:            { label: "WCA",      icon: Building2,  color: "text-primary" },
  report_aziende: { label: "Prospect", icon: FileSearch, color: "text-chart-3" },
  import:         { label: "Contatto", icon: Users,      color: "text-muted-foreground" },
  bca:            { label: "BCA",      icon: CreditCard, color: "text-warning" },
  manual:         { label: "Manuale",  icon: Users,      color: "text-emerald-500" },
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
          "group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors border border-transparent",
          isAiProcessed
            ? isSelected ? "bg-primary/10 border-primary/30" : "bg-primary/[0.06] hover:bg-primary/10"
            : isSelected ? "bg-primary/10 border-primary/30" : "hover:bg-card/60"
        )}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          className="h-3.5 w-3.5 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/80 flex-shrink-0" />
        <InfoTooltip content={contact.country || "?"}>
          <span className="text-base leading-none flex-shrink-0">{flag}</span>
        </InfoTooltip>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
            {isAiProcessed && (
              <InfoTooltip content="Deep Search effettuata">
                <Sparkles className="w-3 h-3 text-primary shrink-0" />
              </InfoTooltip>
            )}
            <InfoTooltip content={`Origine: ${contact.originDetail}`}>
              <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wider flex-shrink-0", oc.color)}>
                <oc.icon className="w-2.5 h-2.5" />
                {oc.label}
              </span>
            </InfoTooltip>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground min-w-0">
            <span className="truncate font-medium text-foreground/70">{contact.company}</span>
            {contact.role && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate">{contact.role}</span>
              </>
            )}
            {contact.country && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <MapPin className="w-2.5 h-2.5" />
                  {contact.country}
                </span>
              </>
            )}
          </div>
        </div>
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
