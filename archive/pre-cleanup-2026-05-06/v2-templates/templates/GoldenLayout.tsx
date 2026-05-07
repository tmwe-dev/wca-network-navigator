/**
 * GoldenLayout — Reference split-panel layout for V2 pages (40/60).
 * Wraps ResizablePanelGroup with predictable sizes, header, and responsive
 * collapse (mobile = list-only, detail opens as full-screen overlay).
 *
 * Reference implementation: see ContactsPage.
 */
import * as React from "react";
import { ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PersistentResizablePanelGroup } from "@/v2/ui/atoms/PersistentResizablePanelGroup";
import { GoldenHeaderBar } from "./GoldenHeaderBar";
import { cn } from "@/lib/utils";

interface GoldenLayoutProps {
  /** Left panel = list. */
  list: React.ReactNode;
  /** Right panel = detail. Pass `null` when nothing is selected. */
  detail: React.ReactNode | null;
  /** Optional breadcrumb tail (e.g. selected entity name). */
  trailingLabel?: string | null;
  /** Header right-side actions. */
  actions?: React.ReactNode;
  /** Hide the header (rare). */
  hideHeader?: boolean;
  /** Test id wrapper. */
  testId?: string;
  className?: string;
  /**
   * Identificatore stabile per persistere il layout in localStorage.
   * Default: derivato da `testId` quando presente, altrimenti generico.
   * Convenzione: `<feature>:golden-split` (es. `contacts:golden-split`).
   */
  storageId?: string;
}

export function GoldenLayout({
  list,
  detail,
  trailingLabel,
  actions,
  hideHeader,
  testId,
  className,
  storageId,
}: GoldenLayoutProps): React.ReactElement {
  const hasDetail = detail !== null && detail !== undefined && detail !== false;
  const persistId = storageId ?? `${testId ?? "golden-layout"}:list-vs-detail`;

  return (
    <div
      data-testid={testId ?? "golden-layout"}
      className={cn("flex flex-col h-full overflow-hidden", className)}
    >
      {!hideHeader && <GoldenHeaderBar trailingLabel={trailingLabel} actions={actions} />}

      {/* Mobile: list only, detail is overlay */}
      <div className="flex-1 min-h-0 md:hidden">
        {!hasDetail ? (
          <div className="h-full">{list}</div>
        ) : (
          <div className="fixed inset-0 z-40 bg-background animate-in slide-in-from-right duration-200 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {detail}
          </div>
        )}
      </div>

      {/* Desktop: 40/60 resizable split */}
      <div className="flex-1 min-h-0 hidden md:block">
        {/*
          Force remount when the panel count changes. react-resizable-panels
          stores layout per Group instance; mounting/unmounting a child panel
          on the fly leads to "Previous layout not found for panel index -1".
          Keying on hasDetail recreates the group cleanly on selection toggle.
        */}
        <PersistentResizablePanelGroup
          storageId={persistId}
          key={hasDetail ? "split" : "list-only"}
          direction="horizontal"
          className="h-full"
        >
          <ResizablePanel
            defaultSize={hasDetail ? 40 : 100}
            minSize={hasDetail ? 30 : 100}
            maxSize={hasDetail ? 70 : 100}
          >
            <div className="h-full transition-all duration-200">{list}</div>
          </ResizablePanel>

          {hasDetail && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={60} minSize={30} maxSize={70}>
                <div className="h-full bg-card/40">{detail}</div>
              </ResizablePanel>
            </>
          )}
        </PersistentResizablePanelGroup>
      </div>
    </div>
  );
}
