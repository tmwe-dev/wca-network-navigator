import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useWcaSession } from "@/hooks/useWcaSession";

export function WcaSessionCard() {
  const { isSessionActive } = useWcaSession();
  const isOk = isSessionActive === true;

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full ${isOk ? "bg-emerald-500" : "bg-destructive"}`} />
        <p className="text-sm font-medium">{isOk ? "Sessione attiva" : "Sessione non attiva"}</p>
      </div>
      <Button asChild variant={isOk ? "outline" : "default"} className="w-full" size="sm">
        <Link to="/settings">
          <ExternalLink className="w-4 h-4 mr-2" />
          Gestisci Connessione WCA
        </Link>
      </Button>
    </div>
  );
}
