import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText } from "lucide-react";

interface CapturedPage {
  id: string;
  pipelineKey: string | "manual";
  url: string;
  status: "pending" | "running" | "done" | "error";
  markdown: string;
  error?: string;
  startedAt: number;
  durationMs?: number;
  persisted?: boolean;
}

interface DeepSearchPageListProps {
  pages: CapturedPage[];
  selectedId: string | null;
  running: boolean;
  onSelectPage: (id: string) => void;
}

function StatusIcon({ status }: { status: CapturedPage["status"] }) {
  const cls = "w-3 h-3 mt-0.5";
  if (status === "running")
    return (
      <Loader2 className={`${cls} animate-spin text-primary shrink-0`} />
    );
  if (status === "done")
    return <div className={`${cls} rounded-full bg-emerald-500 shrink-0`} />;
  if (status === "pending")
    return (
      <div
        className={`${cls} rounded-full border border-muted-foreground/40 shrink-0`}
      />
    );
  return <div className={`${cls} rounded-full bg-destructive shrink-0`} />;
}

function PageRow({
  page,
  active,
  onClick,
}: {
  page: CapturedPage;
  active: boolean;
  onClick: () => void;
}) {
  let host = page.url;
  try {
    host = new URL(page.url).hostname.replace(/^www\./, "");
  } catch {}

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-[11px] flex items-start gap-1.5 transition-colors ${
        active
          ? "bg-primary/15 border border-primary/30"
          : "hover:bg-muted/60 border border-transparent"
      }`}
    >
      <StatusIcon status={page.status} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{host}</div>
        <div className="text-[11px] text-foreground/70 font-mono truncate">
          {page.url}
        </div>
        {page.status === "done" && (
          <div className="text-[11px] text-foreground/70 mt-0.5">
            {page.markdown.length.toLocaleString()} char
            {page.durationMs && ` · ${(page.durationMs / 1000).toFixed(1)}s`}
          </div>
        )}
        {page.status === "error" && (
          <div className="text-[9px] text-destructive mt-0.5 truncate">
            {page.error}
          </div>
        )}
      </div>
    </button>
  );
}

export function DeepSearchPageList({
  pages,
  selectedId,
  running,
  onSelectPage,
}: DeepSearchPageListProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/80 border-b border-border/60 shrink-0 flex items-center justify-between">
        <span>Pagine lette · {pages.length}</span>
        {running && (
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
        )}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {pages.length === 0 && (
            <div className="text-xs text-foreground/70 italic px-2 py-4 text-center">
              Nessuna pagina ancora letta. Lancia una pipeline o un URL.
            </div>
          )}
          {pages.map((p) => (
            <PageRow
              key={p.id}
              page={p}
              active={p.id === selectedId}
              onClick={() => onSelectPage(p.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
