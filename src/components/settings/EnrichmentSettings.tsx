/**
 * EnrichmentSettings — Orchestrator (refactored from 638-line monolith)
 */
import { useEnrichmentData } from "@/hooks/useEnrichmentData";
import { SourceTabBar } from "./enrichment/SourceTabBar";
import { EnrichmentToolbar } from "./enrichment/EnrichmentToolbar";
import { BulkActionBar } from "./enrichment/BulkActionBar";
import { EnrichmentRowList } from "./enrichment/EnrichmentRowList";
import { DeepSearchOptionsDialog } from "./enrichment/DeepSearchOptionsDialog";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { ListSkeleton } from "@/components/ui/ListSkeleton";

// Re-export kept for backward compat
export { EnrichmentFilters } from "./enrichment/EnrichmentFilters";
export type { SourceFilter, EnrichFilter, SortField, SortDir } from "./enrichment/EnrichmentFilters";
export type { EnrichedRow } from "@/hooks/useEnrichmentData";

export default function EnrichmentSettings() {
  const d = useEnrichmentData();

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
        />
      )}

      <EnrichmentRowList
        rows={d.allRows}
        selected={d.selected}
        allSelected={d.allSelected}
        sortField={d.sortField}
        sortDir={d.sortDir}
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
