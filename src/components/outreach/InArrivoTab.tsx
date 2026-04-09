import { useState, Suspense } from "react";
import { Mail, MessageCircle, Linkedin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/useChannelMessages";
import { lazyRetry } from "@/lib/lazyRetry";
import { WhatsAppToolbar } from "@/components/outreach/WhatsAppToolbar";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
import { useWhatsAppBackfill } from "@/hooks/useWhatsAppBackfill";

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

  // Lift WhatsApp hooks here so toolbar + view share the same state
  const waSync = useWhatsAppAdaptiveSync();
  const waBackfill = useWhatsAppBackfill();

  const badges: Record<string, number> = { email: emailUnread, whatsapp: waUnread, linkedin: liUnread };

  return (
    <div className="h-full flex flex-col overflow-hidden">
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

        {/* WhatsApp controls inline — using lifted hooks */}
        {channel === "whatsapp" && (
          <div className="ml-auto">
            <WhatsAppToolbar
              level={waSync.level}
              enabled={waSync.enabled}
              toggle={waSync.toggle}
              isReading={waSync.isReading}
              isAvailable={waSync.isAvailable}
              readNow={waSync.readNow}
              bfProgress={waBackfill.progress}
              startBackfill={waBackfill.startBackfill}
              stopBackfill={waBackfill.stopBackfill}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<div className="h-full animate-pulse bg-muted/20 rounded-lg" />}>
          {channel === "email" && <EmailInboxView />}
          {channel === "whatsapp" && (
            <WhatsAppInboxView
              syncState={waSync}
              backfillState={waBackfill}
            />
          )}
          {channel === "linkedin" && <LinkedInInboxView />}
        </Suspense>
      </div>
    </div>
  );
}
