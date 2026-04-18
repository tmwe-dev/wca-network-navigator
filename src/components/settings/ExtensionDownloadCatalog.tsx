import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_EXTENSION_CATALOG,
  downloadStaticExtensionZip,
  fetchExtensionCatalog,
  type ExtensionCatalog,
  type ExtensionCatalogChannel,
  type ExtensionCatalogItem,
} from "@/lib/whatsappExtensionZip";
import { createLogger } from "@/lib/log";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

const log = createLogger("ExtensionDownloadCatalog");

interface ExtensionDownloadCatalogProps {
  channel: ExtensionCatalogChannel;
}

function VersionRow({ item }: { item: ExtensionCatalogItem }) {
  const [downloading, setDownloading] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">v{item.version}</span>
          {item.current ? <Badge>Corrente</Badge> : <Badge variant="secondary">Archivio</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground">{item.filename}{item.note ? ` — ${item.note}` : ""}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={downloading}
        onClick={async () => {
          setDownloading(true);
          try {
            await downloadStaticExtensionZip(item.path, item.filename);
            toast.success(`Scaricato ${item.filename}`);
          } catch (error) {
            log.warn("download failed", { error: error instanceof Error ? error.message : String(error), item });
            toast.error(`Download fallito: ${item.filename}`);
          } finally {
            setDownloading(false);
          }
        }}
      >
        {downloading ? <Loader2 className="animate-spin" /> : <Download />}
        Scarica
      </Button>
    </div>
  );
}

export function ExtensionDownloadCatalog({ channel }: ExtensionDownloadCatalogProps) {
  const [catalog, setCatalog] = useState<ExtensionCatalog>(DEFAULT_EXTENSION_CATALOG);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchExtensionCatalog();
        if (active) {
          setCatalog(data);
        }
      } catch (error) {
        log.warn("catalog load failed", { error: error instanceof Error ? error.message : String(error), channel });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [channel]);

  const section = catalog?.[channel];

  if (!loading && (!section || section.items.length === 0)) {
    return null;
  }

  return (
    <details
      className="rounded-md border border-border bg-muted/30"
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium">
        <span>Versioni disponibili{section ? ` (${section.items.length})` : ""}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : "rotate-0"}`} />
      </summary>

      <div className="space-y-2 border-t border-border px-3 py-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Carico elenco file...
          </div>
        ) : section ? (
          <>
            <p className="text-xs text-muted-foreground">
              Qui vedi tutti gli ZIP attualmente pubblicati e scaricabili per questa estensione.
            </p>
            <div className="space-y-2">
              {section.items.map((item) => (
                <VersionRow key={`${channel}-${item.filename}`} item={item} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Nessun file disponibile.</p>
        )}
      </div>
    </details>
  );
}
