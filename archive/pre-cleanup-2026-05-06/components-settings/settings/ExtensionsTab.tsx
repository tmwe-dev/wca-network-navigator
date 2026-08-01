import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Zap, MessageCircle, Linkedin, Mail } from "lucide-react";
import {
  downloadLinkedInExtensionZip,
  downloadWhatsAppExtensionZip,
} from "@/lib/whatsappExtensionZip";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { ExtensionDownloadCatalog } from "@/components/settings/ExtensionDownloadCatalog";

const log = createLogger("ExtensionsTab");

async function downloadGenericZip(path: string, filename: string, successMessage: string) {
  const response = await fetch(`${path}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success(successMessage);
}

export function ExtensionsTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Estensioni Chrome</h2>
        <p className="text-sm text-muted-foreground">Scarica e installa le estensioni per abilitare i canali di comunicazione.</p>
      </div>

      <div className="space-y-1 rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium">Istruzioni di installazione:</p>
        <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-muted-foreground">
          <li>Scarica lo ZIP dell'estensione</li>
          <li>Decomprimi il file</li>
          <li>Apri <code className="rounded bg-muted px-1 font-mono">chrome://extensions</code></li>
          <li>Attiva <strong>Modalità sviluppatore</strong> (toggle in alto a destra)</li>
          <li>Clicca <strong>Carica estensione non pacchettizzata</strong> e seleziona la cartella</li>
          <li>Ricarica questa pagina</li>
        </ol>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Partner Connect</p>
                <p className="text-xs text-muted-foreground">Scraping, Deep Search, Hydra Memory</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              void downloadGenericZip("/partner-connect-extension.zip", "partner-connect-extension.zip", "Partner Connect scaricato!")
                .catch(() => toast.error("File non disponibile"));
            }}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica ZIP
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">WhatsApp Direct Send</p>
                <p className="text-xs text-muted-foreground">Invio automatico messaggi WhatsApp</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                await downloadWhatsAppExtensionZip();
                toast.success("Estensione WhatsApp scaricata!", {
                  description:
                    "PRIMA di caricarla: vai su chrome://extensions e RIMUOVI la versione vecchia. Estrai lo ZIP in una cartella NUOVA e vuota, poi 'Carica estensione non pacchettizzata'.",
                  duration: 15000,
                });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log.warn("operation failed", { error: msg });
                toast.error(msg.startsWith("ZIP corrotto") ? msg : "File non disponibile");
              }
            }}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica ZIP
            </Button>
          </div>
          <ExtensionDownloadCatalog channel="whatsapp" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Linkedin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">LinkedIn Cookie Sync</p>
                <p className="text-xs text-muted-foreground">Login automatico e invio messaggi LinkedIn</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                await downloadLinkedInExtensionZip();
                toast.success("LinkedIn extension scaricata!", {
                  description:
                    "PRIMA di caricarla: vai su chrome://extensions e RIMUOVI la versione vecchia. Estrai lo ZIP in una cartella NUOVA e vuota, poi 'Carica estensione non pacchettizzata'.",
                  duration: 15000,
                });
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                log.warn("operation failed", { error: msg });
                toast.error(msg.startsWith("ZIP corrotto") ? msg : "File non disponibile");
              }
            }}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica ZIP
            </Button>
          </div>
          <ExtensionDownloadCatalog channel="linkedin" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Email Client Universale</p>
                <p className="text-xs text-muted-foreground">Download IMAP, auto-discovery, sync e notifiche</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              void downloadGenericZip("/email-extension.zip", "email-extension.zip", "Email Client scaricato!")
                .catch(() => toast.error("File non disponibile"));
            }}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Scarica ZIP
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
