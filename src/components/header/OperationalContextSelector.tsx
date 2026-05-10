import * as React from "react";
import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { useActiveMailbox } from "@/contexts/ActiveMailboxContext";
import { useCurrentOperator } from "@/hooks/useOperators";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Inbox, Building2, Briefcase, Check, Eye, Shield, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessibleMailbox } from "@/data/mailboxes";

function iconForMailbox(m: AccessibleMailbox) {
  if (m.kind === "personal") return Inbox;
  if (m.department === "admin") return Briefcase;
  return Building2;
}

/**
 * Selettore di CONTESTO OPERATIVO unificato.
 * Sostituisce i due selettori separati (Operatore + Casella) con un solo trigger
 * che mostra in un unico menu:
 *   - Visibilità (solo admin): Tutti gli operatori / un singolo operatore
 *   - Casella attiva: personale + caselle aziendali (booking, amministrazione, ...)
 *
 * La logica di business resta invariata: ActiveOperatorContext + ActiveMailboxContext.
 */
export function OperationalContextSelector(): React.ReactElement | null {
  const { data: currentOp } = useCurrentOperator();
  const {
    operators,
    activeOperator,
    setActiveOperatorId,
    viewingAll,
    isImpersonating,
    setViewingAll,
  } = useActiveOperator();
  const { mailboxes, activeMailbox, setActiveMailboxId } = useActiveMailbox();

  const isAdmin = !!currentOp?.is_admin;
  const showOperatorSection = isAdmin && operators.filter((o) => o.is_active).length > 1;
  const showMailboxSection = mailboxes.length > 1; // personale + almeno una condivisa

  if (!showOperatorSection && !showMailboxSection) return null;

  const ActiveMailboxIcon = activeMailbox ? iconForMailbox(activeMailbox) : Inbox;

  // Trigger: mostriamo solo la casella attiva (l'utente loggato è implicito).
  // Eventuale impersonation/visibilità "tutti" resta visibile via icona Shield
  // e bordo primario sul bottone.
  const mailboxLabel = activeMailbox?.label ?? "Casella";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-2 text-xs",
            (isImpersonating || viewingAll) && "border border-primary/40 bg-primary/5",
          )}
          title="Contesto operativo: visibilità operatori e casella di posta attiva"
          aria-label="Contesto operativo"
        >
          {/*
            UX: l'utente loggato è implicito (path /v2/* protetto).
            Mostriamo SOLO la casella di posta attiva, così è subito chiaro
            su quale account email si sta operando. L'eventuale impersonation
            admin resta segnalata dal bordo primario sul bottone e dall'icona
            scudo a sinistra.
          */}
          {isImpersonating || viewingAll ? (
            <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <ActiveMailboxIcon className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="hidden md:inline truncate max-w-[220px]">
            {activeMailbox?.email ?? mailboxLabel}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {showOperatorSection && (
          <>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Visibilità (admin)
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => setViewingAll()}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm font-medium">Tutti gli operatori</span>
              {viewingAll && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            {operators
              .filter((o) => o.is_active)
              .map((op) => {
                const isActive = !viewingAll && activeOperator?.id === op.id;
                return (
                  <DropdownMenuItem
                    key={op.id}
                    onSelect={() => setActiveOperatorId(op.id)}
                    className="flex items-start gap-2"
                  >
                    <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{op.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{op.email}</div>
                    </div>
                    {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            {showMailboxSection && <DropdownMenuSeparator />}
          </>
        )}

        {showMailboxSection && activeMailbox && (
          <>
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Casella di posta attiva
            </DropdownMenuLabel>
            {mailboxes.map((m) => {
              const Icon = iconForMailbox(m);
              const isActive = m.mailbox_id === activeMailbox.mailbox_id;
              return (
                <DropdownMenuItem
                  key={`${m.kind}-${m.mailbox_id}`}
                  onSelect={() => setActiveMailboxId(m.mailbox_id)}
                  className="flex items-start gap-2"
                >
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium truncate">
                      {m.label}
                      {m.kind === "shared" && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          aziendale
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}