/**
 * DownloadExtensionsButton — scarica in automatico i due ZIP delle estensioni
 * Chrome (WhatsApp + LinkedIn) con un solo click, dalla top bar.
 */
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const FILES: Array<{ url: string; name: string; label: string }> = [
  { url: "/whatsapp-extension.zip", name: "whatsapp-extension.zip", label: "WhatsApp" },
  { url: "/linkedin-extension.zip", name: "linkedin-extension.zip", label: "LinkedIn" },
];

async function downloadOne(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { cache: "no-store" });
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
      aria-label="Scarica estensioni WhatsApp e LinkedIn"
      title="Scarica estensioni Chrome (WhatsApp + LinkedIn)"
      className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
    </Button>
  );
}