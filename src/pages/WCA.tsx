import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, XCircle, Globe,
  RefreshCw, Bookmark,
} from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const BOOKMARKLET = `javascript:void(fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message)))`;

export default function WCAIntegration() {
  const { status, checkedAt, triggerCheck } = useWcaSessionStatus();
  const [verifying, setVerifying] = useState(false);

  const isOk = status === "ok";

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await triggerCheck();
      toast.success("Verifica completata!");
    } catch {
      toast.error("Errore durante la verifica");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-4">
      {/* Header + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">WCA World</h1>
        </div>
        <Badge
          variant={isOk ? "default" : "destructive"}
          className={isOk ? "bg-emerald-600 hover:bg-emerald-700" : ""}
        >
          {isOk ? (
            <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</>
          ) : (
            <><XCircle className="w-3 h-3 mr-1" /> Non connesso</>
          )}
        </Badge>
      </div>

      {/* Main card */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Bookmarklet */}
          <div className="flex flex-col items-center gap-3 p-5 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
            <p className="text-sm text-muted-foreground">
              Trascina nei preferiti del browser
            </p>
            <a
              href={BOOKMARKLET}
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 cursor-grab active:cursor-grabbing select-none"
              draggable
            >
              <Bookmark className="w-4 h-4" />
              📡 Cattura WCA
            </a>
          </div>

          {/* Steps */}
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Trascina <strong>"📡 Cattura WCA"</strong> nei preferiti (una volta sola)</li>
            <li>
              Vai su{" "}
              <a href="https://www.wcaworld.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                wcaworld.com
              </a>{" "}
              e accedi
            </li>
            <li>Clicca il bookmark → vedrai <strong>"Cookie salvato!"</strong></li>
          </ol>

          {/* Verify */}
          <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {verifying ? "Verifica..." : "Verifica Sessione"}
          </Button>

          {/* Last check */}
          {checkedAt && (
            <p className="text-xs text-center text-muted-foreground">
              Ultimo controllo: {new Date(checkedAt).toLocaleString("it-IT")}
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center text-muted-foreground">
        Quando il cookie scade, clicca di nuovo il bookmark su wcaworld.com.
      </p>
    </div>
  );
}
