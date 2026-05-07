import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Inbox, Building2, Briefcase, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessibleMailbox } from "@/data/mailboxes";

function iconFor(m: AccessibleMailbox) {
  if (m.kind === "personal") return Inbox;
  if (m.department === "admin") return Briefcase;
  return Building2;
}

/**
 * Selettore casella di posta: appare nell'header in alto a destra.
 * Mostra Personale + tutte le caselle aziendali a cui l'operatore è autorizzato.
 */
export function MailboxSelector() {
  const { mailboxes, activeMailbox, setActiveMailboxId } = useActiveMailbox();

  if (!mailboxes.length || !activeMailbox) return null;
  // Se l'operatore ha solo la casella personale (senza condivise) il selettore resta nascosto.
  const sharedCount = mailboxes.filter((m) => m.kind === "shared").length;
  if (sharedCount === 0) return null;

  const ActiveIcon = iconFor(activeMailbox);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs",
            activeMailbox.kind === "shared" && "border border-primary/40 bg-primary/5",
          )}
          title={`Casella attiva: ${activeMailbox.email}`}
          aria-label="Cambia casella di posta"
        >
          <ActiveIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:inline truncate max-w-[140px]">{activeMailbox.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs">Casella di posta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {mailboxes.map((m) => {
          const Icon = iconFor(m);
          const isActive = m.mailbox_id === activeMailbox.mailbox_id;
          return (
            <DropdownMenuItem
              key={`${m.kind}-${m.mailbox_id}`}
              onSelect={() => setActiveMailboxId(m.mailbox_id)}
              className="flex items-start gap-2"
            >
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                  {m.label}
                  {m.kind === "shared" && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">aziendale</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}