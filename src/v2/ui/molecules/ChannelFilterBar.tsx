/**
 * ChannelFilterBar — Filtro multicanale standardizzato (Email, WhatsApp,
 * LinkedIn, Calls). Riutilizzato in Inbox / Outreach / CRM per garantire
 * posizione e stile coerenti.
 *
 * Comportamento:
 *  - Multi-select per default (puoi disattivare passando `singleSelect`).
 *  - Lo stato è controllato dal parent.
 *  - Layout compatto: una riga, scroll orizzontale su mobile.
 */
import * as React from "react";
import { Mail, MessageCircle, Linkedin, Phone, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChannelKey = "email" | "whatsapp" | "linkedin" | "calls";

interface ChannelDef {
  readonly key: ChannelKey;
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly color: string; // semantic color class for active state
}

const CHANNELS: readonly ChannelDef[] = [
  { key: "email",    label: "Email",    icon: Mail,          color: "text-primary" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-400" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin,      color: "text-sky-400" },
  { key: "calls",    label: "Chiamate", icon: Phone,         color: "text-amber-400" },
];

interface ChannelFilterBarProps {
  /** Set dei canali attivi. Vuoto = "tutti". */
  readonly value: ReadonlySet<ChannelKey>;
  readonly onChange: (next: Set<ChannelKey>) => void;
  /** Quando true, selezionare un canale deseleziona gli altri. */
  readonly singleSelect?: boolean;
  /** Mostra il pulsante "Tutti" che resetta. */
  readonly showAll?: boolean;
  /** Slot a destra (es. ricerca, conteggi). */
  readonly trailing?: React.ReactNode;
  readonly className?: string;
  readonly testId?: string;
}

export function ChannelFilterBar({
  value,
  onChange,
  singleSelect = false,
  showAll = true,
  trailing,
  className,
  testId,
}: ChannelFilterBarProps): React.ReactElement {
  const toggle = React.useCallback(
    (key: ChannelKey) => {
      if (singleSelect) {
        const next = new Set<ChannelKey>();
        if (!value.has(key)) next.add(key);
        onChange(next);
        return;
      }
      const next = new Set(value);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onChange(next);
    },
    [value, onChange, singleSelect],
  );

  const reset = React.useCallback(() => onChange(new Set()), [onChange]);

  const allActive = value.size === 0;

  return (
    <div
      data-testid={testId ?? "channel-filter-bar"}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-card/30 overflow-x-auto",
        className,
      )}
    >
      <Filter className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" />

      {showAll && (
        <button
          type="button"
          onClick={reset}
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap border",
            allActive
              ? "bg-primary/15 text-primary border-primary/30"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent",
          )}
        >
          Tutti
        </button>
      )}

      {CHANNELS.map((c) => {
        const Icon = c.icon;
        const active = value.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => toggle(c.key)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap border",
              active
                ? "bg-muted/60 text-foreground border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border-transparent",
            )}
            title={c.label}
          >
            <Icon className={cn("h-3.5 w-3.5", active ? c.color : "")} />
            <span>{c.label}</span>
          </button>
        );
      })}

      {value.size > 0 && (
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 px-1.5 py-1 rounded-md text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          title="Reset filtri"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

export default ChannelFilterBar;