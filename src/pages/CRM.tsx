import { lazy, Suspense, useState } from "react";
import { UserCheck, ContactRound, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { VerticalTabNav, type VerticalTab } from "@/components/ui/VerticalTabNav";

const Contacts = lazy(() => import("./Contacts"));
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function CRM() {
  const [tab, setTab] = useState("contatti");
  const navigate = useNavigate();

  const handleTabChange = (value: string) => {
    if (value === "ra") {
      navigate("/ra");
      return;
    }
    setTab(value);
  };

  const tabs: VerticalTab[] = [
    { value: "contatti", label: "Contatti", icon: UserCheck },
    { value: "biglietti", label: "Biglietti", icon: ContactRound },
    { value: "ra", label: "Report Aziende", icon: Building2 },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <VerticalTabNav tabs={tabs} value={tab} onChange={handleTabChange} />
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
