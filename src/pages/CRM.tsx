import { lazy, Suspense, useState } from "react";
import { UserCheck, ContactRound } from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { ActiveContextBar } from "@/components/shared/ActiveContextBar";

const Contacts = lazy(() => import("./Contacts"));
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function CRM() {
  const [tab, setTab] = useState("contatti");

  const tabs: VerticalTab[] = [
    { value: "contatti", label: "Contatti", icon: UserCheck },
    { value: "biglietti", label: "Biglietti", icon: ContactRound },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ActiveContextBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
      <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} />
      <div className="flex-1 min-w-0 overflow-hidden">
        {tab === "contatti" && (
          <Suspense fallback={<TabFallback />}>
            <Contacts />
          </Suspense>
        )}
        {tab === "biglietti" && (
          <Suspense fallback={<TabFallback />}>
            <BusinessCardsHub />
          </Suspense>
        )}
      </div>
    </div>
  );
}
