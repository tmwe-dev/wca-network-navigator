import { memo } from "react";
import { Mail, Linkedin, MessageCircle, Smartphone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface UnifiedContact {
  id: string;
  name: string;
  company: string;
  role?: string;
  city?: string;
  country?: string;
  flag?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  status?: string;
  origin?: string;
  originLabel?: string;
}

interface UnifiedContactRowProps {
  contact: UnifiedContact;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onClick?: () => void;
  onDoubleClick?: () => void;
  showCheckbox?: boolean;
  isActive?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "Nuovo", color: "text-muted-foreground", bg: "bg-muted/60" },
  contacted: { label: "Contattato", color: "text-primary", bg: "bg-primary/15" },
  in_progress: { label: "In Corso", color: "text-amber-500", bg: "bg-amber-500/15" },
  negotiation: { label: "Trattativa", color: "text-chart-3", bg: "bg-chart-3/15" },
  converted: { label: "Chiuso", color: "text-emerald-500", bg: "bg-emerald-500/15" },
  lost: { label: "Perso", color: "text-destructive", bg: "bg-destructive/15" },
};

const CHANNEL_ICONS = [
  { key: "email", icon: Mail, check: (c: UnifiedContact) => !!c.email },
  { key: "linkedin", icon: Linkedin, check: (c: UnifiedContact) => !!c.linkedinUrl },
  { key: "whatsapp", icon: MessageCircle, check: (c: UnifiedContact) => !!c.phone },
  { key: "sms", icon: Smartphone, check: (c: UnifiedContact) => !!c.phone },
];

export const UnifiedContactRow = memo(function UnifiedContactRow({
  contact,
  isSelected,
  onToggleSelect,
  onClick,
  onDoubleClick,
  showCheckbox = false,
  isActive = false,
  className,
}: UnifiedContactRowProps) {
  const statusCfg = STATUS_CONFIG[contact.status || "new"] || STATUS_CONFIG.new;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        "hover:bg-muted/40 border border-transparent",
        contact.status && contact.status !== "new" && "border-l-2 border-l-muted-foreground/40",
        isActive && "bg-primary/10 border-primary/20",
        className
      )}
    >
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect?.()}
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Flag */}
      {contact.flag && (
        <span className="text-base shrink-0" title={contact.country}>{contact.flag}</span>
      )}

      {/* Company + Name */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground truncate">{contact.company || "—"}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {contact.name}{contact.role ? ` · ${contact.role}` : ""}
          </div>
        </div>
      </div>

      {/* City */}
      {contact.city && (
        <span className="text-[10px] text-muted-foreground truncate max-w-[80px] hidden sm:block">
          {contact.city}
        </span>
      )}

      {/* Status badge */}
      <span className={cn("text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded", statusCfg.bg, statusCfg.color)}>
        {statusCfg.label}
      </span>

      {/* Channel icons */}
      <div className="flex items-center gap-1 shrink-0">
        {CHANNEL_ICONS.map(({ key, icon: Icon, check }) =>
          check(contact) ? (
            <Icon key={key} className="w-3 h-3 text-muted-foreground/60" />
          ) : null
        )}
      </div>

      {/* Origin */}
      {contact.originLabel && (
        <span className="text-[9px] text-muted-foreground/50 shrink-0">{contact.originLabel}</span>
      )}
    </div>
  );
});
