import { Phone, Users, MoreHorizontal, Mail, Linkedin, MessageCircle, CalendarClock, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodayActivities, type TodayActivity } from "@/hooks/useTodayActivities";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

const typeIcon: Record<string, any> = {
  phone_call: Phone,
  meeting: Users,
  email: Mail,
  linkedin_message: Linkedin,
  whatsapp_message: MessageCircle,
  follow_up: CalendarClock,
  other: StickyNote,
};

const typeColor: Record<string, string> = {
  phone_call: "bg-chart-1/15 text-chart-1 border-chart-1/30",
  meeting: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  email: "bg-primary/15 text-primary border-primary/30",
  linkedin_message: "bg-[hsl(210,80%,55%)]/15 text-[hsl(210,80%,55%)] border-[hsl(210,80%,55%)]/30",
  whatsapp_message: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  follow_up: "bg-chart-3/15 text-chart-3 border-chart-3/30",
  other: "bg-muted text-muted-foreground border-border",
};

export function TodayActivityCarousel() {
  const { data: activities = [], isLoading } = useTodayActivities();

  if (isLoading || activities.length === 0) return null;

  return (
    <div className="px-1 pb-1">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Oggi · {activities.length}</span>
      </div>
      <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
        <TooltipProvider delayDuration={200}>
          {activities.map((act) => (
            <ActivityMini key={act.id} activity={act} />
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}

function ActivityMini({ activity }: { activity: TodayActivity }) {
  const Icon = typeIcon[activity.activityType] || MoreHorizontal;
  const colors = typeColor[activity.activityType] || typeColor.other;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-medium whitespace-nowrap flex-shrink-0 hover:opacity-80 transition-opacity",
          colors
        )}>
          <Icon className="w-2.5 h-2.5" />
          <span className="max-w-[60px] truncate">{activity.contactName}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
        <div className="font-semibold">{activity.contactName}</div>
        {activity.company && <div className="text-muted-foreground">{activity.company}</div>}
        {activity.description && <div className="text-muted-foreground/80 mt-0.5 line-clamp-2">{activity.description}</div>}
      </TooltipContent>
    </Tooltip>
  );
}
