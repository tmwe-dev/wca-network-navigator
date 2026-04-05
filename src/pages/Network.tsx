import { lazy, Suspense, useState } from "react";
import { Globe, CreditCard } from "lucide-react";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";
import { NetworkFilterSlot } from "@/components/filters/NetworkFilterSlot";

const Operations = lazy(() => import("./Operations"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Network() {
  const [tab, setTab] = useState("partners");

  const tabs: VerticalTab[] = [
    { value: "partners", label: "Partner", icon: Globe },
    { value: "bca", label: "Biglietti", icon: CreditCard },
  ];

  const filterSlot = <NetworkFilterSlot />;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <VerticalTabNav tabs={tabs} value={tab} onChange={setTab} filterSlot={filterSlot} />
        <div className="flex-1 min-w-0 overflow-hidden">
          <Suspense fallback={<TabFallback />}>
            <Operations activeView={tab as "partners" | "bca"} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
