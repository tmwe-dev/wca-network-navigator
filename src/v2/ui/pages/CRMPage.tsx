/**
 * CRMPage V2 — Standalone V1 content migration (NO wrapper)
 */
import { lazy, Suspense, useState, useEffect } from "react";
import { UserCheck, ContactRound, Sparkles, Kanban, Copy, Calculator, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIMatchDialog } from "@/components/contacts/AIMatchDialog";
import { ExportDialog } from "@/components/export/ExportDialog";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useUrlState } from "@/hooks/useUrlState";
import { useTrackPage } from "@/hooks/useTrackPage";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useNavigate } from "react-router-dom";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";

const Contacts = lazy(() => import("@/pages/Contacts"));
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));
const ContactPipelineView = lazy(() => import("@/components/contacts/ContactPipelineView").then((m) => ({ default: m.ContactPipelineView })));
const DuplicateDetector = lazy(() => import("@/components/contacts/DuplicateDetector").then((m) => ({ default: m.DuplicateDetector })));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function CRMPage(): React.ReactElement {
  const [tab, setTab] = useUrlState<string>("tab", "contatti");
  const [showAIMatch, setShowAIMatch] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const { setCrmActiveTab } = useGlobalFilters();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const scoreMutation = useMutation({
    mutationFn: () => invokeEdge("calculate-lead-scores", { body: {}, context: "CRM.recalcScore" }),
    onSuccess: () => {
      toast.success("Lead scores ricalcolati");
      qc.invalidateQueries({ queryKey: queryKeys.contacts.all });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.imported() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useMissionDrawerEvents({
    "crm-deep-search": () => {
      window.dispatchEvent(new CustomEvent("crm-trigger-deep-search"));
      toast.info("Deep Search CRM", { description: "Seleziona contatti per avviare la ricerca approfondita." });
    },
    "crm-linkedin-lookup": () => {
      window.dispatchEvent(new CustomEvent("crm-trigger-linkedin"));
      toast.info("LinkedIn lookup", { description: "Avviato sui contatti selezionati con account LinkedIn collegato." });
    },
    "crm-send-cockpit": () => {
      toast.success("Apertura Cockpit Outreach…");
      navigate("/v2/outreach?tab=cockpit&from=crm");
    },
    "crm-export": () => {
      window.dispatchEvent(new CustomEvent("crm-trigger-export"));
      toast.info("Export CSV", { description: "Generazione file in corso…" });
    },
  });

  useTrackPage("crm", { tab });

  useEffect(() => {
    setCrmActiveTab(tab);
  }, [tab, setCrmActiveTab]);

  const tabs = [
    { value: "contatti", label: "Contatti", icon: UserCheck },
    { value: "pipeline", label: "Pipeline", icon: Kanban },
    { value: "biglietti", label: "Biglietti", icon: ContactRound },
    { value: "duplicati", label: "Duplicati", icon: Copy },
  ];

  return (
    <div data-testid="page-contacts" className="flex flex-col h-full overflow-hidden">
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

        <button
          onClick={() => scoreMutation.mutate()}
          disabled={scoreMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ml-auto text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent disabled:opacity-50"
        >
          {scoreMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
          Ricalcola Score
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent"
        >
          <Download className="w-3.5 h-3.5" />
          Esporta
        </button>
        <button
          onClick={() => setShowAIMatch(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Match
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "contatti" && (
          <Suspense fallback={<TabFallback />}>
            <Contacts />
          </Suspense>
        )}
        {tab === "pipeline" && (
          <Suspense fallback={<TabFallback />}>
            <ContactPipelineView />
          </Suspense>
        )}
        {tab === "biglietti" && (
          <Suspense fallback={<TabFallback />}>
            <BusinessCardsHub />
          </Suspense>
        )}
        {tab === "duplicati" && (
          <Suspense fallback={<TabFallback />}>
            <DuplicateDetector />
          </Suspense>
        )}
      </div>

      <AIMatchDialog open={showAIMatch} onOpenChange={setShowAIMatch} />
      <ExportDialog open={showExport} onOpenChange={setShowExport} />
    </div>
  );
}
