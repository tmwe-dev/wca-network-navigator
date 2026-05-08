/**
 * DownloadExtensionsButton — scarica in automatico i due ZIP delle estensioni
 * Chrome (WhatsApp + LinkedIn) con un solo click, dalla top bar.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  EMAIL_EXTENSION_REQUIRED_VERSION,
  LINKEDIN_EXTENSION_REQUIRED_VERSION,
  PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION,
  RA_EXTENSION_REQUIRED_VERSION,
  WCA_EXTENSION_REQUIRED_VERSION,
  WHATSAPP_EXTENSION_REQUIRED_VERSION,
} from "@/lib/whatsappExtensionZip";

// Sempre file VERSIONATI: il filename cambia a ogni release, quindi non si scontra
// mai con un .zip vecchio già scaricato dall'utente, e bypassa la cache HTTP.
const FILES: Array<{ url: string; name: string; label: string }> = [
  {
    url: `/chrome-extensions/partner-connect/partner-connect-extension-${PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION}.zip`,
    name: `partner-connect-extension-${PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION}.zip`,
    label: `Partner Connect v${PARTNER_CONNECT_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    url: `/chrome-extensions/whatsapp/whatsapp-extension-${WHATSAPP_EXTENSION_REQUIRED_VERSION}.zip`,
    name: `whatsapp-extension-${WHATSAPP_EXTENSION_REQUIRED_VERSION}.zip`,
    label: `WhatsApp v${WHATSAPP_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    url: `/chrome-extensions/linkedin/linkedin-extension-${LINKEDIN_EXTENSION_REQUIRED_VERSION}.zip`,
    name: `linkedin-extension-${LINKEDIN_EXTENSION_REQUIRED_VERSION}.zip`,
    label: `LinkedIn v${LINKEDIN_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    url: `/chrome-extensions/email/email-extension-${EMAIL_EXTENSION_REQUIRED_VERSION}.zip`,
    name: `email-extension-${EMAIL_EXTENSION_REQUIRED_VERSION}.zip`,
    label: `Email v${EMAIL_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    url: `/chrome-extensions/ra/ra-extension-${RA_EXTENSION_REQUIRED_VERSION}.zip`,
    name: `ra-extension-${RA_EXTENSION_REQUIRED_VERSION}.zip`,
    label: `ReportAziende v${RA_EXTENSION_REQUIRED_VERSION}`,
  },
  {
    url: `/chrome-extensions/wca/wca-extension-${WCA_EXTENSION_REQUIRED_VERSION}.zip`,
    name: `wca-extension-${WCA_EXTENSION_REQUIRED_VERSION}.zip`,
    label: `WCA v${WCA_EXTENSION_REQUIRED_VERSION}`,
  },
];

async function downloadOne(url: string, filename: string): Promise<void> {
  // Cache-buster via query: alcuni proxy ignorano cache:no-store sul fetch.
  const bust = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const res = await fetch(bust, { cache: "no-store" });
  if (!res.ok) throw new Error(`${filename}: HTTP ${res.status}`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function DownloadExtensionsButton(): React.ReactElement {
  const [busy, setBusy] = React.useState(false);

  const handleClick = React.useCallback(async () => {
    setBusy(true);
    const ok: string[] = [];
    const ko: string[] = [];
    for (const f of FILES) {
      try {
        await downloadOne(f.url, f.name);
        ok.push(f.label);
        // pausa breve così il browser non blocca i download multipli
        await new Promise((r) => setTimeout(r, 400));
      } catch (e) {
        ko.push(`${f.label} (${e instanceof Error ? e.message : String(e)})`);
      }
    }
    setBusy(false);
    if (ko.length === 0) {
      toast.success("Estensioni scaricate", { description: ok.join(" · ") });
    } else {
      toast.error("Alcuni download falliti", { description: ko.join(" · ") });
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={busy}
      aria-label="Scarica tutte le estensioni Chrome"
      title="Scarica tutte le estensioni Chrome"
      className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}