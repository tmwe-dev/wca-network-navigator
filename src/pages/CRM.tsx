import { lazy, Suspense, useState } from "react";
import { UserCheck, ContactRound } from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { CRMFilterSlot } from "@/components/filters/CRMFilterSlot";

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

  const filterSlot = tab === "contatti" ? <CRMFilterSlot /> : undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} filterSlot={filterSlot} />
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
    </div>
  );
}
