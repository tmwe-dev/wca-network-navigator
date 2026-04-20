/**
 * EnrichmentSettings — Orchestrator (refactored from 638-line monolith)
 */
import { useCallback } from "react";
import { useEnrichmentData } from "@/hooks/useEnrichmentData";
import { useBaseEnrichment } from "@/hooks/useBaseEnrichment";
import type { BaseEnrichTarget } from "@/v2/services/enrichment/baseEnrichment";
import { SourceTabBar } from "./enrichment/SourceTabBar";
import { EnrichmentToolbar } from "./enrichment/EnrichmentToolbar";
import { BulkActionBar } from "./enrichment/BulkActionBar";
import { EnrichmentRowList } from "./enrichment/EnrichmentRowList";
import { DeepSearchOptionsDialog } from "./enrichment/DeepSearchOptionsDialog";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";

// Re-export kept for backward compat
export { EnrichmentFilters } from "./enrichment/EnrichmentFilters";
export type { SourceFilter, EnrichFilter, SortField, SortDir } from "./enrichment/EnrichmentFilters";
export type { EnrichedRow } from "@/hooks/useEnrichmentData";

export default function EnrichmentSettings() {
  const d = useEnrichmentData();

  const getTargets = useCallback((): BaseEnrichTarget[] => {
    return d.getSelectedRows()
      .filter((r) => r.source === "wca" || r.source === "contacts" || r.source === "bca")
      .map((r) => {
        // BCA → trattato come azienda (logo + sito + LinkedIn azienda); persiste su business_cards.raw_data.enrichment
        const isCompanyLike = r.source === "wca" || r.source === "bca";
        return {
          id: r.realId || r.id,
          source: r.source as "wca" | "contacts" | "bca",
          name: r.name,
          companyName: isCompanyLike ? r.name : undefined,
          domain: r.domain,
          email: r.email,
          hasLogo: r.hasLogo,
          hasLinkedin: r.hasLinkedin,
          hasWebsiteExcerpt: false,
        };
      });
  }, [d]);

  const { progress, start, stop } = useBaseEnrichment(getTargets);

  const handleStart = useCallback(async () => {
    await start();
    d.refetchPartners();
    d.refetchContacts();
  }, [start, d]);

  return (
    <PageErrorBoundary>
    <div className="flex-1 min-w-0 space-y-3">
      <SourceTabBar
        activeTab={d.sourceTab}
        counts={d.sourceCounts}
        onTabChange={d.changeSourceTab}
      />

      <EnrichmentToolbar
        search={d.search}
        enrichFilter={d.enrichFilter}
        stats={d.stats}
        onSearchChange={d.setSearch}
        onFilterChange={d.setEnrichFilter}
      />

      {d.someSelected && (
        <BulkActionBar
          selectedCount={d.selectedCount}
          onLinkedInBatch={d.handleLinkedInBatch}
          onBulkLogoSearch={d.handleBulkLogoSearch}
          onDeepSearch={d.openDeepSearchDialog}
          getSelectedRows={d.getSelectedRows}
          progress={progress}
          onStartBaseEnrichment={handleStart}
          onStopBaseEnrichment={stop}
        />
      )}

      <EnrichmentRowList
        rows={d.allRows}
        selected={d.selected}
        allSelected={d.allSelected}
        sortField={d.sortField}
        sortDir={d.sortDir}
        rowStates={progress.rowStates}
        onToggleAll={d.toggleAll}
        onToggleOne={d.toggleOne}
        onToggleSort={d.toggleSort}
        onDeepSearch={d.openDeepSearchDialog}
      />

      <p className="text-[10px] text-muted-foreground">
        Loghi via Clearbit/Google Favicon · LinkedIn via Partner Connect · Deep Search configurabile per record
      </p>

      <DeepSearchOptionsDialog
        open={d.dsDialogOpen}
        onOpenChange={d.setDsDialogOpen}
        count={d.dsTargetIds.length}
        onConfirm={d.handleDeepSearchConfirm}
        loading={d.deepSearch.running}
      />
    </div>
    </PageErrorBoundary>
  );
}
