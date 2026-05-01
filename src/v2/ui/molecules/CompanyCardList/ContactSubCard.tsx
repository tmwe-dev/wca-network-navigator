/**
 * ContactSubCard — sub-card di un contatto dentro una CompanyCard.
 * Componente puramente presentazionale.
 */
import * as React from "react";
import { Mail, MessageCircle, Linkedin, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactEntity, CompanyEntity } from "./types";

export interface ContactSubCardProps {
  contact: ContactEntity;
  company: CompanyEntity;
  onOpen?: (contact: ContactEntity, company: CompanyEntity) => void;
}

export function ContactSubCard({ contact, company, onOpen }: ContactSubCardProps): React.ReactElement {
  const { channels } = contact;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(contact, company)}
      className={cn(
        "group w-full text-left rounded-lg border border-border/40 bg-card/40",
        "px-3 py-2 transition-all hover:border-primary/40 hover:bg-primary/[0.04]",
        "flex items-center gap-2 min-w-0"
      )}
    >
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-muted/40 border border-border/40 flex items-center justify-center">
        <User className="w-3.5 h-3.5 text-muted-foreground/60" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground truncate">
          {contact.name || "—"}
        </div>
        {contact.role && (
          <div className="text-[10px] text-muted-foreground truncate">{contact.role}</div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {channels.email && <Mail className="w-3 h-3 text-primary/70" />}
        {channels.whatsapp && <MessageCircle className="w-3 h-3 text-emerald-500/80" />}
        {channels.linkedin && <Linkedin className="w-3 h-3 text-sky-500/80" />}
        {channels.phone && !channels.email && !channels.whatsapp && (
          <Phone className="w-3 h-3 text-muted-foreground/70" />
        )}
        {contact.unreadCount && contact.unreadCount > 0 ? (
          <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">
            {contact.unreadCount}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default ContactSubCard;