import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Zap, MessageCircle, Linkedin, Mail } from "lucide-react";
import { downloadWhatsAppExtensionZip } from "@/lib/whatsappExtensionZip";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("ExtensionsTab");

export function ExtensionsTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Estensioni Chrome</h2>
        <p className="text-sm text-muted-foreground">Scarica e installa le estensioni per abilitare i canali di comunicazione.</p>
      </div>

      <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
        <p className="text-xs font-medium">Istruzioni di installazione:</p>
        <ol className="text-[11px] text-muted-foreground list-decimal list-inside space-y-0.5">
          <li>Scarica lo ZIP dell'estensione</li>
          <li>Decomprimi il file</li>
          <li>Apri <code className="font-mono bg-muted px-1 rounded">chrome://extensions</code></li>
          <li>Attiva <strong>Modalità sviluppatore</strong> (toggle in alto a destra)</li>
          <li>Clicca <strong>Carica estensione non pacchettizzata</strong> e seleziona la cartella</li>
          <li>Ricarica questa pagina</li>
        </ol>
      </div>

      {/* Partner Connect */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Partner Connect</p>
                <p className="text-xs text-muted-foreground">Scraping, Deep Search, Hydra Memory</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              fetch("/partner-connect-extension.zip")
                .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "partner-connect-extension.zip"; a.click(); URL.revokeObjectURL(a.href); toast.success("Partner Connect scaricato!"); })
                .catch(() => toast.error("File non disponibile"));
            }}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-sm">WhatsApp Direct Send</p>
                <p className="text-xs text-muted-foreground">Invio automatico messaggi WhatsApp</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                await downloadWhatsAppExtensionZip();
                toast.success("Estensione WhatsApp scaricata!");
              } catch (e) {
                log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
                toast.error("File non disponibile");
              }
            }}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                <Linkedin className="w-5 h-5 text-[#0A66C2]" />
              </div>
              <div>
                <p className="font-medium text-sm">LinkedIn Cookie Sync</p>
                <p className="text-xs text-muted-foreground">Login automatico e invio messaggi LinkedIn</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              fetch("/linkedin-extension.zip")
                .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); toast.success("LinkedIn extension scaricata!"); })
                .catch(() => toast.error("File non disponibile — pacchettizzazione necessaria"));
            }}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Client */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Email Client Universale</p>
                <p className="text-xs text-muted-foreground">Download IMAP, auto-discovery, sync e notifiche</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              fetch("/email-extension.zip")
                .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "email-extension.zip"; a.click(); URL.revokeObjectURL(a.href); toast.success("Email Client scaricato!"); })
                .catch(() => toast.error("File non disponibile"));
            }}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> Scarica ZIP
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
