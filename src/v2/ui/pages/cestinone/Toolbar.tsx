import * as React from "react";
import { Mail, MessageCircle, Linkedin, Inbox, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CestinoChannel } from "@/data/cestinone";

interface ChipGroupProps {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly options: ReadonlyArray<{ value: string; label: string }>;
}
export function ChipGroup({ value, onChange, options }: ChipGroupProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full border transition-colors",
            value === o.value
              ? "bg-card/60 dark:bg-card/40 border-primary text-primary ring-1 ring-primary/30"
              : "bg-background text-muted-foreground border-border hover:bg-accent"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChannelDropdown({
  value, onChange, counts,
}: {
  value: CestinoChannel | "all";
  onChange: (v: CestinoChannel | "all") => void;
  counts: { total: number; byChannel: { email: number; whatsapp: number; linkedin: number } };
}): React.ReactElement {
  const opts: ReadonlyArray<{ v: CestinoChannel | "all"; label: string; Icon: typeof Mail; tone: string; count: number }> = [
    { v: "all",      label: "Tutti i canali", Icon: Inbox,         tone: "text-foreground",     count: counts.total },
    { v: "email",    label: "Email",          Icon: Mail,          tone: "text-violet-500",     count: counts.byChannel.email },
    { v: "whatsapp", label: "WhatsApp",       Icon: MessageCircle, tone: "text-success",    count: counts.byChannel.whatsapp },
    { v: "linkedin", label: "LinkedIn",       Icon: Linkedin,      tone: "text-info",        count: counts.byChannel.linkedin },
  ];
  const current = opts.find((o) => o.v === value) ?? opts[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <current.Icon className={cn("h-3.5 w-3.5", current.tone)} />
          <span>{current.label}</span>
          <span className="text-muted-foreground">({current.count})</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {opts.map((o) => (
          <DropdownMenuItem key={o.v} onClick={() => onChange(o.v)} className="text-xs gap-2">
            <o.Icon className={cn("h-3.5 w-3.5", o.tone)} />
            <span className="flex-1">{o.label}</span>
            <span className="text-muted-foreground">{o.count}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}