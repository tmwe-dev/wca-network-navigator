import * as React from "react";
import { ArrowUpRight, AlertOctagon, Rocket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it as itLocale } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import type { CestinoItem } from "@/data/cestinone";
import { CHANNEL_META, STATUS_META, TRIGGER_META, PARTNER_TYPE_META } from "./meta";

interface Props {
  item: CestinoItem;
  selected: boolean;
  onSelect: () => void;
  departingSoon?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
}

export function ListRow({ item, selected, onSelect, departingSoon, checked, onToggleCheck }: Props): React.ReactElement {
  const ch = CHANNEL_META[item.channel] ?? CHANNEL_META.other;
  const st = STATUS_META[item.status] ?? STATUS_META.pending;
  const tr = TRIGGER_META[item.triggerKind] ?? TRIGGER_META.manual;
  const pt = item.partnerType ? PARTNER_TYPE_META[item.partnerType] : null;
  const flag = item.partnerCountryCode ? countryCodeToFlag(item.partnerCountryCode) : "";
  const when = item.scheduledAt ?? item.createdAt;
  const ageLabel = item.scheduledAt
    ? `tra ${formatDistanceToNow(new Date(when), { locale: itLocale })}`
    : `${formatDistanceToNow(new Date(when), { locale: itLocale })} fa`;
  return (
    <div
      className={cn(
        "w-full text-left rounded-lg border border-l-4 bg-card p-3 transition-all hover:border-primary/40 hover:bg-accent/30",
        ch.borderL,
        selected && "border-primary ring-1 ring-primary/30 bg-accent/40",
        "flex gap-2"
      )}
    >
      {onToggleCheck && (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={!!checked} onCheckedChange={onToggleCheck} aria-label="Seleziona elemento" />
        </div>
      )}
      <button type="button" onClick={onSelect} className="flex-1 min-w-0 text-left">
        <div className="flex items-start gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight line-clamp-2">
              {item.subject ?? "(senza oggetto)"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.partnerName ?? item.recipientName ?? item.recipientHandle ?? "—"}</span>
            </div>
          </div>
          <span
            title={tr.label}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium",
              tr.tone, "border-current/30 bg-current/10"
            )}
          >
            <tr.Icon className="h-2.5 w-2.5" />
            <span className="hidden sm:inline">{tr.label}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          <span title={ch.label} className="inline-flex"><ch.Icon className={cn("h-3.5 w-3.5 shrink-0", ch.tone)} /></span>
          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border", st.tone)}>{st.label}</Badge>
          {pt && (
            <span className={cn("px-1.5 py-0.5 rounded border font-medium text-[9px]", pt.tone)}>{pt.label}</span>
          )}
          {departingSoon && (
            <Badge className="text-[9px] px-1.5 py-0 gap-1 bg-primary/15 text-primary border border-primary/30">
              <Rocket className="h-2.5 w-2.5" /> in partenza
            </Badge>
          )}
          {item.status === "blocked" && <AlertOctagon className="h-3 w-3 text-rose-500" />}
          <span className="ml-auto text-[10px] text-muted-foreground whitespace-nowrap">{ageLabel}</span>
          {flag && <span className="text-base leading-none" title={item.partnerCountryCode ?? ""}>{flag}</span>}
        </div>
      </button>
    </div>
  );
}