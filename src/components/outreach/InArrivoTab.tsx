import { useState, Suspense } from "react";
import { Mail, MessageCircle, Linkedin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/useChannelMessages";
import { lazyRetry } from "@/lib/lazyRetry";
import { WhatsAppToolbar } from "@/components/outreach/WhatsAppToolbar";
import { EmailToolbar } from "@/components/outreach/EmailToolbar";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
import { useWhatsAppBackfill } from "@/hooks/useWhatsAppBackfill";
import { useCheckInbox, useContinuousSync } from "@/hooks/useChannelMessages";
import { useResetSync } from "@/hooks/useEmailSync";
import { useEmailAutoSync } from "@/hooks/useEmailAutoSync";
import { useActiveOperator } from "@/contexts/ActiveOperatorContext";
import { useCurrentOperator } from "@/hooks/useOperators";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const EmailInboxView = lazyRetry(() =>
  import("@/components/outreach/EmailInboxView").then(m => ({ default: m.EmailInboxView }))
);
const WhatsAppInboxView = lazyRetry(() =>
  import("@/components/outreach/WhatsAppInboxView").then(m => ({ default: m.WhatsAppInboxView }))
);
const LinkedInInboxView = lazyRetry(() =>
  import("@/components/outreach/LinkedInInboxView").then(m => ({ default: m.LinkedInInboxView }))
);

type Channel = "email" | "whatsapp" | "linkedin";

const CHANNELS: { value: Channel; label: string; icon: typeof Mail; channel: "email" | "whatsapp" | "linkedin" }[] = [
  { value: "email", label: "Email", icon: Mail, channel: "email" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, channel: "whatsapp" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, channel: "linkedin" },
];

export function InArrivoTab() {
  const [channel, setChannel] = useState<Channel>("email");
  const { data: emailUnread = 0 } = useUnreadCount("email");
  const { data: waUnread = 0 } = useUnreadCount("whatsapp");
  const { data: liUnread = 0 } = useUnreadCount("linkedin");

  // Admin multi-operator support
  const { operators } = useActiveOperator();
  const { data: currentOp } = useCurrentOperator();
  const isAdmin = currentOp?.is_admin ?? false;
  const activeOperators = operators.filter(o => o.is_active && o.user_id);

  // "all" = no filter (admin sees everything), or specific user_id
  const [selectedOperatorUserId, setSelectedOperatorUserId] = useState<string | null>(null);
  // operatorUserId to pass to hooks: null means "all" (RLS handles visibility)
  const operatorUserId = selectedOperatorUserId || undefined;

  // Lift WhatsApp hooks
  const waSync = useWhatsAppAdaptiveSync();
  const waBackfill = useWhatsAppBackfill();

  // Lift Email hooks
  const checkInbox = useCheckInbox();
  const emailSync = useContinuousSync();
  const resetSync = useResetSync();
  const emailAutoSync = useEmailAutoSync();

  const badges: Record<string, number> = { email: emailUnread, whatsapp: waUnread, linkedin: liUnread };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Admin: operator tabs */}
      {isAdmin && activeOperators.length > 1 && (
        <div className="px-3 py-1 border-b border-border/30 flex items-center gap-1 overflow-x-auto">
          <Users className="w-3 h-3 text-muted-foreground shrink-0" />
          <button
            onClick={() => setSelectedOperatorUserId(null)}
            className={cn(
              "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all",
              !selectedOperatorUserId
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
            )}
          >
            Tutti
          </button>
          {activeOperators.map(op => (
            <button
              key={op.id}
              onClick={() => setSelectedOperatorUserId(op.user_id!)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-all",
                selectedOperatorUserId === op.user_id
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
              )}
            >
              {op.name}
            </button>
          ))}
        </div>
      )}

      {/* Channel filter bar + channel-specific controls */}
      <div className="px-3 py-1.5 border-b border-border/30 flex items-center gap-1 flex-wrap">
        {CHANNELS.map(ch => {
          const badge = badges[ch.channel];
          return (
            <button
              key={ch.value}
              onClick={() => setChannel(ch.value)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
                channel === ch.value
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
              )}
            >
              <ch.icon className="w-3 h-3" />
              {ch.label}
              {badge > 0 && (
                <span className={cn(
                  "ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none",
                  channel === ch.value
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Channel-specific toolbar inline */}
        <div className="ml-auto">
          {channel === "email" && (
            <EmailToolbar
              onCheckNew={() => checkInbox.mutate()}
              isCheckingNew={checkInbox.isPending}
              onStartSync={emailSync.startSync}
              onStopSync={emailSync.stopSync}
              isSyncing={emailSync.isSyncing}
              syncDownloaded={emailSync.progress.downloaded}
              onReset={() => resetSync.mutate()}
              isResetting={resetSync.isPending}
              autoSyncEnabled={emailAutoSync.enabled}
              onToggleAutoSync={emailAutoSync.toggle}
            />
          )}
          {channel === "whatsapp" && (
            <WhatsAppToolbar
              level={waSync.level}
              enabled={waSync.enabled}
              toggle={waSync.toggle}
              isReading={waSync.isReading}
              isAvailable={waSync.isAvailable}
              isAuthenticated={waSync.isAuthenticated}
              readNow={waSync.readNow}
              bfProgress={waBackfill.progress}
              startBackfill={waBackfill.startBackfill}
              stopBackfill={waBackfill.stopBackfill}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<div className="h-full animate-pulse bg-muted/20 rounded-lg" />}>
          {channel === "email" && <EmailInboxView operatorUserId={operatorUserId} />}
          {channel === "whatsapp" && (
            <WhatsAppInboxView
              syncState={waSync}
              backfillState={waBackfill}
              operatorUserId={operatorUserId}
            />
          )}
          {channel === "linkedin" && <LinkedInInboxView operatorUserId={operatorUserId} />}
        </Suspense>
      </div>
    </div>
  );
}
