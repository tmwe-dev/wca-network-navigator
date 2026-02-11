import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";

interface WcaSessionCardProps {
  onVerify: () => void;
  verifying: boolean;
}

export function WcaSessionCard({ onVerify, verifying }: WcaSessionCardProps) {
  const { status, checkedAt } = useWcaSessionStatus();
  const isOk = status === "ok";

  const statusLabel = isOk
    ? "Sessione attiva"
    : status === "expired"
    ? "Sessione scaduta"
    : status === "no_cookie"
    ? "Nessun cookie"
    : status === "checking"
    ? "Verifica in corso..."
    : "Errore";

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${isOk ? "bg-emerald-500" : "bg-destructive"}`} />
          <div>
            <p className="text-sm font-medium">{statusLabel}</p>
            {checkedAt && (
              <p className="text-xs text-muted-foreground">
                Ultimo controllo: {new Date(checkedAt).toLocaleString("it-IT")}
              </p>
            )}
          </div>
        </div>
      </div>

      <Button asChild variant={isOk ? "outline" : "default"} className="w-full" size="sm">
        <Link to="/wca">
          <ExternalLink className="w-4 h-4 mr-2" />
          Gestisci Connessione WCA
        </Link>
      </Button>

      <Button onClick={onVerify} disabled={verifying} variant="outline" className="w-full" size="sm">
        {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
        {verifying ? "Verifica..." : "Ricontrolla Sessione"}
      </Button>
    </div>
  );
}
