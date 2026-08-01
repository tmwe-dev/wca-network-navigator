/**
 * KBSupervisorFooter — Footer con statistiche audit/documenti
 */
import { Clock, FileText, AlertTriangle } from "lucide-react";

interface Props {
  readonly lastAuditDate: Date | null;
  readonly totalDocuments: number;
  readonly totalIssues: number;
}

export function KBSupervisorFooter({ lastAuditDate, totalDocuments, totalIssues }: Props) {
  return (
    <footer className="border-t border-border px-4 py-1.5 flex items-center gap-4 bg-card text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        Ultimo audit: {lastAuditDate ? lastAuditDate.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "Mai"}
      </span>
      <span className="flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />
        {totalDocuments} documenti
      </span>
      <span className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        {totalIssues} issues
      </span>
    </footer>
  );
}
