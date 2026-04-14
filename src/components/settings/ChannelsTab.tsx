import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, RefreshCw, Download,
  MessageCircle, Linkedin, Bot, Zap, WifiOff,
} from "lucide-react";
import { downloadWhatsAppExtensionZip } from "@/lib/whatsappExtensionZip";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("ChannelsTab");

interface ChannelsTabProps {
  waConnected: boolean;
  liConnected: boolean;
  liHasCreds: boolean;
  liExtAvailable: boolean;
  waExt: { isAvailable: boolean; verifySession: () => Promise<unknown> };
  liExt: { isAvailable: boolean; verifySession: () => Promise<unknown> };
  connectingAll: boolean;
  onConnectAll: () => void;
}

export function ChannelsTab({
  waConnected, liConnected, liHasCreds, liExtAvailable,
  waExt, liExt, connectingAll, onConnectAll,
}: ChannelsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Canali di Comunicazione</h2>
          <p className="text-sm text-muted-foreground">Stato delle connessioni per l'invio automatico.</p>
        </div>
        <Button onClick={onConnectAll} disabled={connectingAll} size="sm" className="gap-1.5">
          {connectingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          Connetti Tutto
        </Button>
      </div>

      {/* WhatsApp */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Invio messaggi via estensione Chrome</p>
              </div>
            </div>
            <Badge variant={waConnected ? "default" : "secondary"} className={waConnected ? "bg-emerald-600 text-white" : ""}>
              {waConnected
                ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</>
                : <><WifiOff className="w-3 h-3 mr-1" /> Non rilevato</>}
            </Badge>
          </div>
          {waConnected && (
            <Button variant="outline" size="sm" onClick={async () => {
              const res = await waExt.verifySession();
              toast[res.success ? "success" : "error"](res.success ? "Sessione WhatsApp verificata!" : "Sessione WhatsApp non attiva");
            }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Verifica Sessione
            </Button>
          )}
          {!waConnected && (
            <details className="group">
              <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                ⚙️ Setup avanzato (estensione Chrome)
              </summary>
              <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    await downloadWhatsAppExtensionZip();
                    toast.success("Estensione WhatsApp scaricata!");
                  } catch (e) {
                    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
                    toast.error("File non disponibile");
                  }
                }}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica Estensione
                </Button>
                <ol className="text-[11px] text-muted-foreground list-decimal list-inside space-y-0.5">
                  <li>Decomprimi il file ZIP</li>
                  <li>Apri <code className="font-mono bg-muted px-1 rounded">chrome://extensions</code></li>
                  <li>Attiva <strong>Modalità sviluppatore</strong></li>
                  <li>Clicca <strong>Carica estensione non pacchettizzata</strong></li>
                </ol>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* LinkedIn */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                <Linkedin className="w-5 h-5 text-[#0A66C2]" />
              </div>
              <div>
                <p className="font-medium text-sm">LinkedIn</p>
                <p className="text-xs text-muted-foreground">
                  {liHasCreds ? "Credenziali configurate" : "Configura nel tab LinkedIn"}
                </p>
              </div>
            </div>
            <Badge variant={liConnected ? "default" : "secondary"} className={liConnected ? "bg-emerald-600 text-white" : ""}>
              {liConnected
                ? <><CheckCircle2 className="w-3 h-3 mr-1" /> {liExtAvailable ? "Connesso" : "Configurato"}</>
                : <><WifiOff className="w-3 h-3 mr-1" /> Non configurato</>}
            </Badge>
          </div>
          {liExtAvailable && (
            <Button variant="outline" size="sm" onClick={async () => {
              const res = await liExt.verifySession();
              toast[res.success ? "success" : "error"](res.success ? "Sessione LinkedIn verificata!" : "Sessione LinkedIn non attiva");
            }}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Verifica Sessione
            </Button>
          )}
          {!liExtAvailable && !liHasCreds && (
            <details className="group">
              <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                ⚙️ Setup avanzato (estensione Chrome)
              </summary>
              <div className="mt-2 space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
                <Button variant="outline" size="sm" onClick={() => {
                  fetch("/linkedin-extension.zip")
                    .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                    .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
                    .catch(() => toast.error("File non disponibile"));
                }}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica Estensione
                </Button>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* AI Agent */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">AI Agent</p>
                <p className="text-xs text-muted-foreground">Engine di generazione outreach e analisi</p>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Attivo
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
