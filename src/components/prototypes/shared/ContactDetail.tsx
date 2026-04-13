import { Mail, Phone, Linkedin, Building2, MapPin, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnifiedContact } from "./UnifiedContactList";

interface Props {
  contact: UnifiedContact | null;
  onClose: () => void;
  className?: string;
}

export function ContactDetail({ contact, onClose, className }: Props) {
  if (!contact) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground text-sm", className)}>
        Seleziona un contatto per vedere i dettagli
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex items-center justify-between p-4 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">{contact.name}</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Chiudi">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-foreground">{contact.company}</span>
          </div>
          {contact.country && (
            <div className="flex items-center gap-2 text-xs">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{contact.country}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-xs">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-foreground">{contact.phone}</span>
            </div>
          )}
          {contact.linkedinUrl && (
            <div className="flex items-center gap-2 text-xs">
              <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                Profilo LinkedIn
              </a>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-border/40 space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Azioni rapide</span>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8">
              <Mail className="h-3 w-3 mr-1.5" /> Email
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8">
              <Linkedin className="h-3 w-3 mr-1.5" /> LinkedIn
            </Button>
            <Button size="sm" variant="outline" className="text-xs h-8 col-span-2">
              <Send className="h-3 w-3 mr-1.5" /> Aggiungi al cockpit
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
