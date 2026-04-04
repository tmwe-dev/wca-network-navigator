import { lazy, Suspense, useState, useEffect } from "react";

import { Rocket, ArrowUpFromLine, ListTodo, Plane, Mail, MessageCircle, Linkedin } from "lucide-react";
import { AttivitaTab } from "@/components/outreach/AttivitaTab";
import { InUscitaTab } from "@/components/outreach/InUscitaTab";
import { HoldingPatternTab } from "@/components/outreach/HoldingPatternTab";
import { EmailInboxView } from "@/components/outreach/EmailInboxView";
import { WhatsAppInboxView } from "@/components/outreach/WhatsAppInboxView";
import { LinkedInInboxView } from "@/components/outreach/LinkedInInboxView";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useUnreadCount } from "@/hooks/useChannelMessages";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";

const Cockpit = lazy(() => import("./Cockpit"));

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
        {tab === "cockpit" && (
          <Suspense fallback={<TabFallback />}>
            <Cockpit />
          </Suspense>
        )}
        {tab === "inuscita" && <InUscitaTab />}
        {tab === "attivita" && <AttivitaTab />}
        {tab === "circuito" && <HoldingPatternTab />}
        {tab === "email" && <EmailInboxView />}
        {tab === "whatsapp" && <WhatsAppInboxView />}
        {tab === "linkedin" && <LinkedInInboxView />}
      </div>
      </div>
    </div>
  );
}
