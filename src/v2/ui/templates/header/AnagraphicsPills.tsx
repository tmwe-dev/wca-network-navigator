/**
 * AnagraphicsPills — 3 cliccable pills mounted into the top bar slot
 * (#campaign-header-controls) by Network / Biglietti / CRM pages.
 *
 * Replaces both the sidebar voices for "CRM" and "Biglietti" and the
 * old single "WCA Partner · 12286 partner" badge.
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Contact, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnagraphicsCounts } from "@/v2/hooks/useAnagraphicsCounts";

export type AnagraphicsKey = "partners" | "biglietti" | "crm";

interface PillSpec {
  readonly key: AnagraphicsKey;
  readonly label: string;
  readonly to: string;
  readonly icon: React.ReactNode;
  readonly count: number;
}

interface Props {
  readonly active: AnagraphicsKey;
}

function fmt(n: number): string {
  return n.toLocaleString("it-IT");
}

export function AnagraphicsPills({ active }: Props): React.ReactElement {
  const navigate = useNavigate();
  const { data } = useAnagraphicsCounts();

  const pills: readonly PillSpec[] = [
    {
      key: "partners",
      label: "WCA Partner",
      to: "/v2/explore/network",
      icon: <Globe className="w-3.5 h-3.5 text-primary/80 animate-spin-slow" />,
      count: data?.partners ?? 0,
    },
    {
      key: "biglietti",
      label: "Biglietti",
      to: "/v2/pipeline/biglietti",
      icon: <Contact className="w-3.5 h-3.5 text-primary/80" />,
      count: data?.businessCards ?? 0,
    },
    {
      key: "crm",
      label: "CRM",
      to: "/v2/pipeline/contacts",
      icon: <Users className="w-3.5 h-3.5 text-primary/80" />,
      count: data?.contacts ?? 0,
    },
  ];

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {pills.map((p) => {
        const isActive = p.key === active;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => { if (!isActive) navigate(p.to); }}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 h-7 text-[11px] font-medium transition-colors shrink-0",
              isActive
                ? "bg-primary/15 text-primary border border-primary/30 cursor-default"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground border border-transparent",
            )}
            title={`${p.label} · ${fmt(p.count)}`}
          >
            {p.icon}
            <span className="hidden md:inline">{p.label}</span>
            <span className="font-mono text-[10px] tabular-nums opacity-90">{fmt(p.count)}</span>
          </button>
        );
      })}
    </div>
  );
}