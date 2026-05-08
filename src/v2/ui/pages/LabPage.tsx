/**
 * LabPage — Hub unificato "Lab & Verifiche".
 *
 * Aggrega in un'unica pagina, tramite tab + querystring deep-link,
 * tutte le aree di test/diagnostica/verifica del sistema:
 *  - Scenari AI (AiTestHub)
 *  - E2E Smoke
 *  - Diagnostica
 *  - Telemetria
 *  - Observability
 *  - Test Extensions (WA/LI/FireScrape)
 *  - Design System Preview
 *
 * Nessuna logica nuova: ogni tab importa il componente esistente as-is.
 */
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
import { FlaskConical, Activity, Stethoscope, BarChart3, Eye, Puzzle, Palette } from "lucide-react";

const AiTestHubPage = lazy(() => import("./AiTestHubPage").then((m) => ({ default: m.AiTestHubPage })));
const E2EStatusPage = lazy(() => import("./E2EStatusPage").then((m) => ({ default: m.E2EStatusPage })));
const DiagnosticsPage = lazy(() => import("./DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage })));
const TelemetryPage = lazy(() => import("./TelemetryPage").then((m) => ({ default: m.TelemetryPage })));
const ObservabilityPage = lazy(() => import("./ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
const DesignSystemPreviewPage = lazy(() => import("./DesignSystemPreviewPage").then((m) => ({ default: m.DesignSystemPreviewPage })));
const TestExtensionsContent = lazy(() => import("@/components/test-extensions/TestExtensionsView").then((m) => ({ default: m.TestExtensionsContent })));

const TABS = [
  { id: "scenari", label: "Scenari AI", icon: FlaskConical, Comp: AiTestHubPage },
  { id: "e2e", label: "E2E Smoke", icon: Activity, Comp: E2EStatusPage },
  { id: "diagnostica", label: "Diagnostica", icon: Stethoscope, Comp: DiagnosticsPage },
  { id: "telemetria", label: "Telemetria", icon: BarChart3, Comp: TelemetryPage },
  { id: "observability", label: "Observability", icon: Eye, Comp: ObservabilityPage },
  { id: "extensions", label: "Extensions", icon: Puzzle, Comp: TestExtensionsContent },
  { id: "design", label: "Design System", icon: Palette, Comp: DesignSystemPreviewPage },
] as const;

type TabId = typeof TABS[number]["id"];
const VALID: ReadonlySet<string> = new Set(TABS.map((t) => t.id));

export function LabPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const active: TabId = (raw && VALID.has(raw) ? raw : "scenari") as TabId;

  const onChange = (v: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageTitleHeader
        title="Lab & Verifiche"
        subtitle="Cabina unica di test, diagnostica, telemetria e QA"
        icon={FlaskConical}
      />
      <Tabs value={active} onValueChange={onChange} className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/40 p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS.map((t) => {
          const Comp = t.Comp;
          return (
            <TabsContent key={t.id} value={t.id} className="mt-4 focus-visible:outline-none">
              {active === t.id ? (
                <FeatureErrorBoundary featureName={`Lab/${t.id}`}>
                  <Suspense fallback={<PageSkeleton />}>
                    <Comp />
                  </Suspense>
                </FeatureErrorBoundary>
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default LabPage;
