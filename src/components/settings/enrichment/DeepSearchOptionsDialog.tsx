import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe, Linkedin, Phone, Brain, Loader2 } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";

interface DeepSearchOption {
  key: "scrapeWebsite" | "scrapeLinkedin" | "verifyWhatsapp" | "aiAnalysis";
  label: string;
  description: string;
  icon: React.ElementType;
}

const OPTIONS: DeepSearchOption[] = [
  { key: "scrapeWebsite", label: "Scrape sito web", description: "Analizza il sito aziendale", icon: Globe },
  { key: "scrapeLinkedin", label: "Scrape LinkedIn", description: "Analizza profilo LinkedIn", icon: Linkedin },
  { key: "verifyWhatsapp", label: "Verifica WhatsApp", description: "Controlla numero su WhatsApp", icon: Phone },
  { key: "aiAnalysis", label: "Analisi AI profilo", description: "Genera briefing AI", icon: Brain },
];

const DEFAULT_CONFIG = {
  scrapeWebsite: true,
  scrapeLinkedin: true,
  verifyWhatsapp: false,
  aiAnalysis: true,
};

interface DeepSearchOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onConfirm: (options: Record<string, boolean>) => void;
  loading?: boolean;
}

export function DeepSearchOptionsDialog({
  open, onOpenChange, count, onConfirm, loading,
}: DeepSearchOptionsDialogProps) {
  const { data: settings } = useAppSettings();
  const [options, setOptions] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    if (settings?.deep_search_config) {
      try {
        const parsed = JSON.parse(settings.deep_search_config);
        const ctx = parsed.contacts || parsed.cockpit || DEFAULT_CONFIG;
        setOptions({ ...DEFAULT_CONFIG, ...ctx });
      } catch { /* use defaults */ }
    }
  }, [settings?.deep_search_config]);

  const toggle = (key: keyof typeof DEFAULT_CONFIG) => {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCount = Object.values(options).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Configura Deep Search</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {count} record selezionat{count === 1 ? "o" : "i"} — scegli le operazioni da eseguire
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {OPTIONS.map(opt => (
            <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
              <Checkbox
                checked={options[opt.key]}
                onCheckedChange={() => toggle(opt.key)}
              />
              <opt.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium">{opt.label}</span>
                <p className="text-[10px] text-muted-foreground">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Annulla
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5"
            disabled={activeCount === 0 || loading}
            onClick={() => onConfirm(options)}
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            Avvia ({activeCount} operazion{activeCount === 1 ? "e" : "i"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
