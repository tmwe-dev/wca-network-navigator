import { lazy, Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCheck, Upload, ContactRound, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Contacts = lazy(() => import("./Contacts"));
const Import = lazy(() => import("./Import"));
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));

function TabFallback() {
  return <div className="h-[calc(100vh-6rem)] animate-pulse bg-muted/20 rounded-lg" />;
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 pt-2">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="contatti" className="gap-1.5 text-xs">
              <UserCheck className="w-3.5 h-3.5" />
              Contatti
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5 text-xs">
              <Upload className="w-3.5 h-3.5" />
              Import
            </TabsTrigger>
            <TabsTrigger value="biglietti" className="gap-1.5 text-xs">
              <ContactRound className="w-3.5 h-3.5" />
              Biglietti
            </TabsTrigger>
            <TabsTrigger value="ra" className="gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5" />
              Report Aziende
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "contatti" && (
          <Suspense fallback={<TabFallback />}>
            <Contacts />
          </Suspense>
        )}
        {tab === "import" && (
          <Suspense fallback={<TabFallback />}>
            <Import />
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
