import { Suspense, useState, useEffect } from "react";
import { Rocket, ArrowUpFromLine, ListTodo, Plane, Mail, MessageCircle, Linkedin } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useUnreadCount } from "@/hooks/useChannelMessages";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { lazyRetry } from "@/lib/lazyRetry";

const Cockpit = lazyRetry(() => import("./Cockpit"));
const AttivitaTab = lazyRetry(() => import("@/components/outreach/AttivitaTab").then(m => ({ default: m.AttivitaTab })));
const InUscitaTab = lazyRetry(() => import("@/components/outreach/InUscitaTab").then(m => ({ default: m.InUscitaTab })));
const HoldingPatternTab = lazyRetry(() => import("@/components/outreach/HoldingPatternTab").then(m => ({ default: m.HoldingPatternTab })));
const EmailInboxView = lazyRetry(() => import("@/components/outreach/EmailInboxView").then(m => ({ default: m.EmailInboxView })));
const WhatsAppInboxView = lazyRetry(() => import("@/components/outreach/WhatsAppInboxView").then(m => ({ default: m.WhatsAppInboxView })));
const LinkedInInboxView = lazyRetry(() => import("@/components/outreach/LinkedInInboxView").then(m => ({ default: m.LinkedInInboxView })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Outreach() {
  const [tab, setTab] = useState("cockpit");
  const { setOutreachTab } = useGlobalFilters();
  const { data: emailUnread = 0 } = useUnreadCount("email");
  const { data: waUnread = 0 } = useUnreadCount("whatsapp");
  const { data: liUnread = 0 } = useUnreadCount("linkedin");

  useEffect(() => { setOutreachTab(tab); }, [tab, setOutreachTab]);

  const tabs: VerticalTab[] = [
    { value: "cockpit", label: "Cockpit", icon: Rocket },
    { value: "inuscita", label: "In Uscita", icon: ArrowUpFromLine },
    { value: "attivita", label: "Attività", icon: ListTodo },
    { value: "circuito", label: "Circuito", icon: Plane },
    { value: "email", label: "Email", icon: Mail, badge: emailUnread },
    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, badge: waUnread },
    { value: "linkedin", label: "LinkedIn", icon: Linkedin, badge: liUnread },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            {tab === "cockpit" && <Cockpit />}
            {tab === "inuscita" && <InUscitaTab />}
            {tab === "attivita" && <AttivitaTab />}
            {tab === "circuito" && <HoldingPatternTab />}
            {tab === "email" && <EmailInboxView />}
            {tab === "whatsapp" && <WhatsAppInboxView />}
            {tab === "linkedin" && <LinkedInInboxView />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
