import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, RefreshCw, Download,
  MessageCircle, Linkedin, Bot, Zap, WifiOff,
} from "lucide-react";
import {
  downloadLinkedInExtensionZip,
  downloadWhatsAppExtensionZip,
} from "@/lib/whatsappExtensionZip";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { ExtensionDownloadCatalog } from "@/components/settings/ExtensionDownloadCatalog";

const log = createLogger("ChannelsTab");

interface ChannelsTabProps {
  waConnected: boolean;
  liConnected: boolean;
  liHasCreds: boolean;
  liExtAvailable: boolean;
  waExt: { isAvailable: boolean; verifySession: () => Promise<{ success?: boolean }> };
  liExt: { isAvailable: boolean; verifySession: () => Promise<{ success?: boolean }> };
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
          {connectingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Connetti Tutto
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">Invio messaggi via estensione Chrome</p>
              </div>
            </div>
            <Badge variant={waConnected ? "default" : "secondary"}>
              {waConnected
                ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Connesso</>
                : <><WifiOff className="mr-1 h-3 w-3" /> Non rilevato</>}
            </Badge>
          </div>
          {waConnected && (
            <Button variant="outline" size="sm" onClick={async () => {
              const res = await waExt.verifySession();
              toast[res.success ? "success" : "error"](res.success ? "Sessione WhatsApp verificata!" : "Sessione WhatsApp non attiva");
            }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Verifica Sessione
            </Button>
          )}
          {!waConnected && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                ⚙️ Setup avanzato (estensione Chrome)
              </summary>
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    await downloadWhatsAppExtensionZip();
                    toast.success("Estensione WhatsApp scaricata!");
                  } catch (e) {
                    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
                    toast.error("File non disponibile");
                  }
                }}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica Estensione
                </Button>
                <ExtensionDownloadCatalog channel="whatsapp" />
                <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-muted-foreground">
                  <li>Decomprimi il file ZIP</li>
                  <li>Apri <code className="rounded bg-muted px-1 font-mono">chrome://extensions</code></li>
                  <li>Attiva <strong>Modalità sviluppatore</strong></li>
                  <li>Clicca <strong>Carica estensione non pacchettizzata</strong></li>
                </ol>
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Linkedin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">LinkedIn</p>
                <p className="text-xs text-muted-foreground">
                  {liHasCreds ? "Credenziali configurate" : "Configura nel tab LinkedIn"}
                </p>
              </div>
            </div>
            <Badge variant={liConnected ? "default" : "secondary"}>
              {liConnected
                ? <><CheckCircle2 className="mr-1 h-3 w-3" /> {liExtAvailable ? "Connesso" : "Configurato"}</>
                : <><WifiOff className="mr-1 h-3 w-3" /> Non configurato</>}
            </Badge>
          </div>
          {liExtAvailable && (
            <Button variant="outline" size="sm" onClick={async () => {
              const res = await liExt.verifySession();
              toast[res.success ? "success" : "error"](res.success ? "Sessione LinkedIn verificata!" : "Sessione LinkedIn non attiva");
            }}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Verifica Sessione
            </Button>
          )}
          {!liExtAvailable && !liHasCreds && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                ⚙️ Setup avanzato (estensione Chrome)
              </summary>
              <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted/50 p-3">
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    await downloadLinkedInExtensionZip();
                    toast.success("LinkedIn extension scaricata!");
                  } catch (e) {
                    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
                    toast.error("File non disponibile");
                  }
                }}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica Estensione
                </Button>
                <ExtensionDownloadCatalog channel="linkedin" />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">AI Agent</p>
                <p className="text-xs text-muted-foreground">Engine di generazione outreach e analisi</p>
              </div>
            </div>
            <Badge>
              <CheckCircle2 className="mr-1 h-3 w-3" /> Attivo
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
