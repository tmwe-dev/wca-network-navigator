import { Switch } from "@/components/ui/switch";
import type { MissionStepProps, DeepSearchConfig } from "./types";

export function DeepSearchStep({ data, onChange }: MissionStepProps) {
  const ds = data.deepSearch || { enabled: false, scrapeWebsite: true, scrapeLinkedIn: true, verifyWhatsApp: false, aiAnalysis: true };
  const set = (patch: Partial<DeepSearchConfig>) => onChange({ ...data, deepSearch: { ...ds, ...patch } });

  const options: { key: keyof Pick<DeepSearchConfig, "scrapeWebsite" | "scrapeLinkedIn" | "verifyWhatsApp" | "aiAnalysis">; label: string; desc: string }[] = [
    { key: "scrapeWebsite", label: "🌐 Scrape sito web aziendale", desc: "Analizza il sito per capire servizi e specializzazioni" },
    { key: "scrapeLinkedIn", label: "🔗 Scrape profilo LinkedIn", desc: "Raccoglie headline, about e posizione del contatto" },
    { key: "verifyWhatsApp", label: "💬 Verifica WhatsApp", desc: "Controlla se il numero è attivo su WhatsApp" },
    { key: "aiAnalysis", label: "🤖 Analisi AI del profilo", desc: "Genera un riepilogo intelligente per personalizzare il messaggio" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Attivare Deep Search prima dell'invio?</p>
          <p className="text-xs text-muted-foreground">Arricchisce i dati dei contatti per messaggi più personalizzati</p>
        </div>
        <Switch checked={ds.enabled} onCheckedChange={v => set({ enabled: v })} />
      </div>
      {ds.enabled && (
        <div className="space-y-2 pl-1 border-l-2 border-primary/30 ml-2">
          {options.map(opt => (
            <label key={opt.key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
              <Switch checked={ds[opt.key]} onCheckedChange={v => set({ [opt.key]: v })} className="mt-0.5" />
              <div>
                <div className="text-sm">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      )}
      {!ds.enabled && (
        <div className="bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground">
          💡 Senza Deep Search, i messaggi saranno generati con i dati già presenti nel database. Puoi sempre attivarlo dopo.
        </div>
      )}
    </div>
  );
}
