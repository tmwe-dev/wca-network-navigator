/**
 * LabPage — Hub unificato "Lab & Verifiche".
 *
 * Sorgente unica delle tab: `src/v2/config/labTabs.ts` (UNA riga per tab).
 * Nessuna business logic: ogni componente è caricato lazy as-is.
 *
 * Deep-link: /v2/lab?group=<group>&tab=<tab>
 */
import { Suspense, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
import { FlaskConical } from "lucide-react";
import {
  LAB_GROUPS,
  LAB_TABS,
  DEFAULT_LAB_GROUP,
  DEFAULT_LAB_TAB_BY_GROUP,
  getLabTabsByGroup,
  type LabTabGroup,
} from "@/v2/config/labTabs";
import { LabGuideDialog } from "@/v2/ui/organisms/lab/LabGuideDialog";

const VALID_GROUPS = new Set<string>(LAB_GROUPS.map((g) => g.id));

export function LabPage() {
  const [params, setParams] = useSearchParams();

  const rawGroup = params.get("group");
  const group: LabTabGroup =
    rawGroup && VALID_GROUPS.has(rawGroup) ? (rawGroup as LabTabGroup) : DEFAULT_LAB_GROUP;

  const tabsInGroup = useMemo(() => getLabTabsByGroup(group), [group]);
  const validTabIds = useMemo(() => new Set(tabsInGroup.map((t) => t.id)), [tabsInGroup]);

  const rawTab = params.get("tab");
  const activeTab =
    rawTab && validTabIds.has(rawTab) ? rawTab : DEFAULT_LAB_TAB_BY_GROUP[group];

  const setGroup = (next: string) => {
    const np = new URLSearchParams(params);
    np.set("group", next);
    np.set("tab", DEFAULT_LAB_TAB_BY_GROUP[next as LabTabGroup] ?? "");
    setParams(np, { replace: true });
  };

  const setTab = (next: string) => {
    const np = new URLSearchParams(params);
    np.set("group", group);
    np.set("tab", next);
    setParams(np, { replace: true });
  };

  const ActiveComp = LAB_TABS.find((t) => t.id === activeTab)?.Component;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageTitleHeader
          title="Lab & Verifiche"
          subtitle="Cabina unica di test, prompt, observability e QA — sorgente: src/v2/config/labTabs.ts"
          icon={FlaskConical}
        />
        <LabGuideDialog initialGroup={group} initialTabId={activeTab} />
      </div>

      {/* Group selector */}
      <Tabs value={group} onValueChange={setGroup} className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/60 p-1">
          {LAB_GROUPS.map((g) => {
            const Icon = g.icon;
            const count = LAB_TABS.filter((t) => t.group === g.id).length;
            return (
              <TabsTrigger key={g.id} value={g.id} className="gap-2">
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{g.label}</span>
                <span className="text-xs text-muted-foreground">({count})</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Tabs of current group */}
      <Tabs value={activeTab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto justify-start gap-1 bg-muted/30 p-1">
          {tabsInGroup.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger key={t.id} value={t.id} className="gap-2">
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                <span>{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 focus-visible:outline-none">
          {ActiveComp ? (
            <FeatureErrorBoundary featureName={`Lab/${group}/${activeTab}`}>
              <Suspense fallback={<PageSkeleton />}>
                <ActiveComp />
              </Suspense>
            </FeatureErrorBoundary>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default LabPage;
