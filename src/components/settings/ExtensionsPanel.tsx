/**
 * ExtensionsPanel — Download centralizzato delle Chrome Extension del sistema.
 * I file ZIP sono già pubblicati in /public e vengono scaricati via fetch+blob
 * (i link diretti <a download> non funzionano nella preview Lovable).
 */
import { useState } from "react";
import { Download, Search, MessageSquare, Linkedin, Mail, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ExtensionDownloadCatalog } from "@/components/settings/ExtensionDownloadCatalog";
import {
  downloadEmailExtensionZip,
  downloadLinkedInExtensionZip,
  downloadPartnerConnectExtensionZip,
  downloadRaExtensionZip,
  downloadWcaExtensionZip,
  downloadWhatsAppExtensionZip,
  EMAIL_EXTENSION_REQUIRED_VERSION,
  LINKEDIN_EXTENSION_REQUIRED_VERSION,
  PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION,
  RA_EXTENSION_REQUIRED_VERSION,
  WCA_EXTENSION_REQUIRED_VERSION,
  WHATSAPP_EXTENSION_REQUIRED_VERSION,
  type ExtensionCatalogChannel,
} from "@/lib/whatsappExtensionZip";

type ExtId = ExtensionCatalogChannel;

interface ExtensionDef {
  id: ExtId;
  name: string;
  description: string;
  filename: string;
  icon: typeof Download;
  badge?: string;
}

const EXTENSIONS: ExtensionDef[] = [
  {
    id: "partner-connect",
    name: "Partner Connect",
    description: "Bridge per Deep Search legacy (batch enrichment client-side, scraping Google/LinkedIn/Maps a costo zero).",
    filename: `partner-connect-extension-${PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION}.zip`,
    icon: Search,
    badge: `v${PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    id: "whatsapp",
    name: "WhatsApp Direct Send",
    description: "Sync conversazioni WhatsApp Web con il CRM, invio messaggi multimodali e backfill cursor persistente.",
    filename: `whatsapp-extension-${WHATSAPP_EXTENSION_REQUIRED_VERSION}.zip`,
    icon: MessageSquare,
    badge: `v${WHATSAPP_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    id: "linkedin",
    name: "LinkedIn Cookie Sync",
    description: "ReadInbox, readThread, backfill, dedup e sync messaggi LinkedIn con ID reali.",
    filename: `linkedin-extension-${LINKEDIN_EXTENSION_REQUIRED_VERSION}.zip`,
    icon: Linkedin,
    badge: `v${LINKEDIN_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    id: "email",
    name: "Email Client Universale",
    description: "Discover automatico account email e notifier inbound per il sistema di Email Intelligence.",
    filename: `email-extension-${EMAIL_EXTENSION_REQUIRED_VERSION}.zip`,
    icon: Mail,
    badge: `v${EMAIL_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    id: "ra",
    name: "ReportAziende",
    description: "Acquisizione dati anagrafici e visure da ReportAziende per arricchimento prospect italiani.",
    filename: `ra-extension-${RA_EXTENSION_REQUIRED_VERSION}.zip`,
    icon: FileText,
    badge: `v${RA_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    id: "wca",
    name: "WCA Cookie Sync",
    description: "Login automatico, sincronizzazione cookie ed estrazione contatti WCA.",
    filename: `wca-extension-${WCA_EXTENSION_REQUIRED_VERSION}.zip`,
    icon: FileText,
    badge: `v${WCA_EXTENSION_REQUIRED_VERSION}`,
  },
];

const DOWNLOADERS: Record<ExtId, () => Promise<void>> = {
  "partner-connect": downloadPartnerConnectExtensionZip,
  whatsapp: downloadWhatsAppExtensionZip,
  linkedin: downloadLinkedInExtensionZip,
  email: downloadEmailExtensionZip,
  ra: downloadRaExtensionZip,
  wca: downloadWcaExtensionZip,
};

export default function ExtensionsPanel() {
  const [downloading, setDownloading] = useState<ExtId | null>(null);
  const [completed, setCompleted] = useState<Set<ExtId>>(new Set());

  const handleDownload = async (ext: ExtensionDef) => {
    if (downloading) return;
    setDownloading(ext.id);
    try {
      await DOWNLOADERS[ext.id]();
      setCompleted((prev) => new Set(prev).add(ext.id));
      toast.success(`${ext.name} scaricata`, { description: `File: ${ext.filename}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore download";
      toast.error(`Download ${ext.name} fallito`, { description: msg });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold mb-1">Estensioni Browser</h2>
        <p className="text-sm text-muted-foreground">
          Scarica le estensioni Chrome/Edge/Brave necessarie per i flussi che operano lato browser
          (Deep Search legacy, sync WhatsApp / LinkedIn, Email auto-discover).
        </p>
      </div>

      <div className="grid gap-3">
        {EXTENSIONS.map((ext) => {
          const Icon = ext.icon;
          const isDownloading = downloading === ext.id;
          const isCompleted = completed.has(ext.id);
          return (
            <div
              key={ext.id}
              className="flex items-start gap-4 p-4 border border-border rounded-lg bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="shrink-0 w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-sm">{ext.name}</h3>
                  {ext.badge && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {ext.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ext.description}</p>
                <p className="mt-1 font-mono text-xs font-semibold text-primary">{ext.filename}</p>
                <div className="mt-3">
                  <ExtensionDownloadCatalog channel={ext.id} />
                </div>
              </div>
              <Button
                size="sm"
                variant={isCompleted ? "outline" : "default"}
                disabled={isDownloading}
                onClick={() => handleDownload(ext)}
                className="shrink-0"
              >
                {isDownloading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Download…</>
                ) : isCompleted ? (
                  <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Scaricata</>
                ) : (
                  <><Download className="w-3.5 h-3.5 mr-1.5" /> Scarica</>
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30 text-xs space-y-2">
        <p className="font-semibold">Come installare (unpacked):</p>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Decomprimi il file ZIP in una cartella stabile (non temporanea).</li>
          <li>Apri <code className="px-1 bg-background rounded">chrome://extensions</code> nel browser.</li>
          <li>Attiva la <strong>Modalità sviluppatore</strong> in alto a destra.</li>
          <li>Clicca <strong>Carica estensione non pacchettizzata</strong> e seleziona la cartella decompressa.</li>
        </ol>
        <p className="text-muted-foreground pt-1">
          Compatibile con Chrome, Edge, Brave, Arc, Opera. Non installare da fonti diverse.
        </p>
      </div>
    </div>
  );
}