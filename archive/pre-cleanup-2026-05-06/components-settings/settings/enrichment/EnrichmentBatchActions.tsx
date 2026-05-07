import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Linkedin, Search, Loader2, StopCircle, CheckCircle2, XCircle, Image } from "lucide-react";
import type { SourceFilter } from "./EnrichmentFilters";

interface BatchProgress {
  status: string;
  current: number;
  total: number;
  found: number;
  notFound: number;
  currentName?: string;
}

interface Props {
  source: SourceFilter;
  contactsWithoutLinkedin: number;
  partnersWithoutLogo: number;
  isExtensionAvailable: boolean;
  onLinkedInBatch: () => void;
  onAbort: () => void;
  progress: BatchProgress;
}

export function EnrichmentBatchActions({
  source, contactsWithoutLinkedin, partnersWithoutLogo,
  isExtensionAvailable, onLinkedInBatch, onAbort, progress,
}: Props) {
  const isRunning = progress.status === "running";
  const isDone = progress.status === "done" || progress.status === "aborted";
  const showLinkedIn = source === "all" || source === "contacts";
  const showLogo = source === "all" || source === "wca";

  if (!showLinkedIn && !showLogo) return null;

  return (
    <div className="space-y-2">
      {/* LinkedIn Batch — solo per contatti */}
      {showLinkedIn && contactsWithoutLinkedin > 0 && (
        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-semibold text-foreground">LinkedIn Batch</div>
                <div className="text-xs text-foreground/70">
                  {contactsWithoutLinkedin} contatti senza profilo
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {isRunning && (
                <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={onAbort}>
                  <StopCircle className="w-3 h-3 mr-1" /> Stop
                </Button>
              )}
              <Button
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={onLinkedInBatch}
                disabled={isRunning || !isExtensionAvailable}
              >
                {isRunning ? <><Loader2 className="w-3 h-3 animate-spin" /> Cercando...</> : <><Search className="w-3 h-3" /> Cerca</>}
              </Button>
            </div>
          </div>
          {(isRunning || isDone) && (
            <div className="space-y-1">
              <Progress value={progress.total > 0 ? (progress.current / progress.total) * 100 : 0} className="h-1" />
              <div className="flex items-center justify-between text-xs text-foreground/70">
                <span>{progress.current}/{progress.total}
                  {progress.currentName && isRunning && <span className="ml-1 text-foreground">{progress.currentName}</span>}
                </span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> {progress.found}</span>
                  <span className="flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5 text-destructive" /> {progress.notFound}</span>
                </div>
              </div>
              {isDone && <div className="text-[10px] font-medium text-green-600">✅ Completato — {progress.found} trovati</div>}
            </div>
          )}
        </div>
      )}

      {/* Logo Batch — solo per WCA */}
      {showLogo && partnersWithoutLogo > 0 && (
        <div className="border border-border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-amber-500" />
              <div>
                <div className="text-xs font-semibold text-foreground">Logo Batch</div>
                <div className="text-xs text-foreground/70">
                  {partnersWithoutLogo} partner senza logo
                </div>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] text-foreground/70">
              Automatico via Clearbit
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}
