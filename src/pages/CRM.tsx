import { lazy, Suspense, useState } from "react";
import { UserCheck, ContactRound } from "lucide-react";
import { cn } from "@/lib/utils";

const Contacts = lazy(() => import("./Contacts"));
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function CRM() {
  const [tab, setTab] = useState("contatti");

  const tabs = [
    { value: "contatti", label: "Contatti", icon: UserCheck },
    { value: "biglietti", label: "Biglietti", icon: ContactRound },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Horizontal tab bar */}
      <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border/40 bg-muted/10 shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                active
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
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
