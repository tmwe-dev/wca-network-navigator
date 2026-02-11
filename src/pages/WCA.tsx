import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, CheckCircle2, XCircle, Globe,
  RefreshCw, ExternalLink, ClipboardPaste,
} from "lucide-react";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function WCAIntegration() {
  const { status, checkedAt, triggerCheck } = useWcaSessionStatus();
  const [verifying, setVerifying] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [saving, setSaving] = useState(false);

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

  const handleSaveCookie = async () => {
    const cookie = cookieInput.trim();
    if (!cookie) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("save-wca-cookie", {
        body: { cookie },
      });
      if (error) throw error;
      if (data?.authenticated) {
        toast.success("Cookie salvato e verificato!");
        setCookieInput("");
      } else {
        toast.warning("Cookie salvato ma la verifica è fallita.");
      }
      triggerCheck();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Sconosciuto"));
    } finally {
      setSaving(false);
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

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* One-click sync */}
          <Button
            className="w-full"
            size="lg"
            onClick={() => window.open("https://www.wcaworld.com/MemberSection", "_blank")}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Apri WCA World e Sincronizza
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Accedi a wcaworld.com, poi clicca l'icona dell'estensione Chrome → <strong>🔄 Sincronizza Cookie</strong>
          </p>

          {/* Verify */}
          <Button onClick={handleVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {verifying ? "Verifica..." : "Verifica Sessione"}
          </Button>

          {checkedAt && (
            <p className="text-xs text-center text-muted-foreground">
              Ultimo controllo: {new Date(checkedAt).toLocaleString("it-IT")}
            </p>
          )}

          {/* Fallback manuale - nascosto */}
          <details className="group">
            <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              ⚙️ Inserimento manuale cookie (emergenza)
            </summary>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Incolla header Cookie completo..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  onClick={handleSaveCookie}
                  disabled={saving || !cookieInput.trim()}
                  size="sm"
                  className="shrink-0"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                F12 → Network → prima richiesta → Headers → Cookie → copia tutto.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
