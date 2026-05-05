import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookText, Inbox, RefreshCw, Download, Loader2, Package, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  selectedId: string | undefined;
  loadingId: string | null;
  downloading: string | null;
  onReload: () => void;
  onDownloadAgent: () => void;
  onDownloadAll: () => void;
  onDownloadTools: () => void;
}

export function Header({ selectedId, loadingId, downloading, onReload, onDownloadAgent, onDownloadAll, onDownloadTools }: Props) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2 flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Button asChild size="sm" variant="ghost" className="h-7 px-2">
          <Link to="/v2">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Home
          </Link>
        </Button>
        <span className="text-muted-foreground text-xs">/</span>
        <BookText className="h-4 w-4 text-primary" />
        <h1 className="text-sm font-semibold">Prompt Reader</h1>
        <span className="text-muted-foreground text-xs hidden md:inline truncate">
          — leggi in chiaro tutti i prompt assemblati di ciascun agente
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        <Button asChild size="sm" variant="ghost" className="h-7 gap-1.5" title="Review change request del Co-pilot">
          <Link to="/v2/prompt-lab/proposals">
            <Inbox className="h-3.5 w-3.5" /> Proposte
          </Link>
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 gap-1.5"
          onClick={onReload}
          disabled={loadingId === selectedId}
          title="Ricarica prompt assemblato"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loadingId === selectedId && "animate-spin")} />
          Ricarica
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 gap-1.5"
          onClick={onDownloadAgent}
          disabled={!selectedId || downloading !== null}
          title="Scarica prompt + KB di questo agente (Markdown)"
        >
          {downloading === "agent" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Scarica persona
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 gap-1.5"
          onClick={onDownloadAll}
          disabled={downloading !== null}
          title="Scarica prompt + KB di tutti gli agenti"
        >
          {downloading === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
          Scarica tutto
        </Button>
        <Button
          size="sm" variant="default" className="h-7 gap-1.5"
          onClick={onDownloadTools}
          disabled={downloading !== null}
          title="Documento delle funzioni e degli strumenti chiamati dagli agenti"
        >
          {downloading === "tools" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
          Funzioni & Strumenti
        </Button>
      </div>
    </div>
  );
}