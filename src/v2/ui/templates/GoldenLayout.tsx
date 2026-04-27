/**
 * GoldenLayout — Reference split-panel layout for V2 pages (40/60).
 * Wraps ResizablePanelGroup with predictable sizes, header, and responsive
 * collapse (mobile = list-only, detail opens as full-screen overlay).
 *
 * Reference implementation: see ContactsPage.
 */
import * as React from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
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
}

export function GoldenLayout({
  list,
  detail,
  trailingLabel,
  actions,
  hideHeader,
  testId,
  className,
}: GoldenLayoutProps): React.ReactElement {
  const hasDetail = detail !== null && detail !== undefined && detail !== false;

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
          <div className="fixed inset-0 z-40 bg-background animate-in slide-in-from-right duration-200">
            {detail}
          </div>
        )}
      </div>

      {/* Desktop: 40/60 resizable split */}
      <div className="flex-1 min-h-0 hidden md:block">
        <ResizablePanelGroup direction="horizontal" className="h-full">
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
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
