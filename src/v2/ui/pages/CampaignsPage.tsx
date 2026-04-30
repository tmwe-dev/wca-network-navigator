/**
 * CampaignsPage V2
 */
/**
 * Campaigns — Orchestrator using sub-components
 */
import { lazy, Suspense, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
const CampaignAnalyticsTab = lazy(() => import("@/components/analytics/CampaignAnalyticsTab").then(m => ({ default: m.CampaignAnalyticsTab })));
import { Button } from "@/components/ui/button";
import { CompanyList } from "@/components/campaigns/CompanyList";
import { CampaignHeaderControls } from "@/components/campaigns/CampaignHeaderControls";
import { FloatingCampaignPartners } from "@/components/campaigns/FloatingCampaignPartners";
import { CampaignGoalDialog } from "@/components/campaigns/CampaignGoalDialog";
import { useCampaignData } from "@/components/campaigns/useCampaignData";
import { Target, BarChart3 } from "lucide-react";

const CampaignGlobe = lazy(() => import("@/components/campaigns/CampaignGlobe").then(m => ({ default: m.CampaignGlobe })));

export function Campaigns() {
  const c = useCampaignData();
  const [params] = useSearchParams();
  const origine = (params.get("origine") ?? "crm").toLowerCase();

  // Sincronizza la sorgente Partner/BCA con il selettore origine del PipelineSection
  // (wca/crm → partners; biglietti → bca). Evita il toggle duplicato in barra.
  useEffect(() => {
    const desired: "partners" | "bca" = origine === "biglietti" ? "bca" : "partners";
    if (c.source !== desired) c.handleSourceChange(desired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origine]);

  return (
    <div className="h-full min-h-0 relative overflow-hidden flex flex-col">
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-background/80 backdrop-blur-sm z-20 flex-wrap">
        <Button variant={c.viewMode === "globe" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => c.setViewMode("globe")}>
          <Target className="w-3.5 h-3.5" />Mappa
        </Button>
        <Button variant={c.viewMode === "analytics" ? "default" : "ghost"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => c.setViewMode("analytics")}>
          <BarChart3 className="w-3.5 h-3.5" />Analytics
        </Button>
        {c.viewMode === "globe" && (
          <>
            <div className="w-px h-6 bg-border" />
            <CampaignHeaderControls
              countries={c.countries}
              selectedCountry={c.selectedCountry}
              onCountrySelect={c.handleCountrySelect}
              countriesWithPartners={c.countriesWithPartners}
              totalPartners={c.totalPartners}
              campaignPartners={c.campaignPartners}
              onGenerateJobs={() => c.setShowGoalDialog(true)}
              source={c.source}
              onSourceChange={c.handleSourceChange}
              bcaCountryCounts={c.bcaCountryCounts}
            />
          </>
        )}
      </div>

      {c.viewMode === "analytics" ? (
        <div className="flex-1 min-h-0"><Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}><CampaignAnalyticsTab /></Suspense></div>
      ) : (
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-muted-foreground text-sm">Caricamento globo...</div>}>
              <CampaignGlobe selectedCountry={c.selectedCountry} onCountrySelect={c.handleCountrySelect} />
            </Suspense>
          </div>

          <div className="absolute left-4 top-4 bottom-4 w-[360px] z-10 flex flex-col gap-4">
            <div className="flex-1 min-h-0">
              <CompanyList
                partners={c.countryPartners}
                selectedPartners={c.selectedPartnerIds}
                onTogglePartner={c.handleTogglePartner}
                onSelectAll={c.handleSelectAll}
                onDeselectAll={c.handleDeselectAll}
                onAddToCampaign={c.handleAddToCampaign}
                countryName={c.countryName}
                bcaPartnerIds={c.bcaPartnerIds as unknown as Set<string> | undefined}
                source={c.source}
                selectedContacts={c.selectedContactIds as unknown as Set<string> | undefined}
                onToggleContact={c.handleToggleContact}
              />
            </div>
          </div>

          <div className="absolute right-4 top-4 z-10">
            <FloatingCampaignPartners
              campaignPartners={c.campaignPartners}
              onRemoveFromCampaign={c.handleRemoveFromCampaign}
              onClearCampaign={c.handleClearCampaign}
            />
          </div>

          <CampaignGoalDialog
            open={c.showGoalDialog}
            onOpenChange={c.setShowGoalDialog}
            campaignPartners={c.campaignPartners}
            selectedGoal={c.selectedGoal}
            onGoalChange={c.setSelectedGoal}
            onConfirm={c.handleGenerateJobs}
          />
        </div>
      )}
    </div>
  );
}
