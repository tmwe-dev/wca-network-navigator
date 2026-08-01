import { Users, Plane, Clock, CalendarCheck } from "lucide-react";

interface Props {
  totalContacts: number;
  inHolding: number;
  notContacted: number;
  scheduledToday: number;
}

export function BriefingStatsBar({ totalContacts, inHolding, notContacted, scheduledToday }: Props) {
  const stats = [
    { icon: Users, label: "Totale contatti", value: totalContacts, color: "text-primary" },
    { icon: Plane, label: "Nel circuito", value: inHolding, color: "text-amber-500" },
    { icon: Clock, label: "Da contattare", value: notContacted, color: "text-muted-foreground" },
    { icon: CalendarCheck, label: "Oggi", value: scheduledToday, color: "text-emerald-500" },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
          <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-none">{s.value.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground truncate">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
