import { useState, useEffect, useMemo } from "react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, Loader2, Globe, Linkedin, Phone, Brain, Mail, LayoutDashboard, Users, CreditCard, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("DeepSearchConfig");

interface ContextConfig {
  scrapeWebsite: boolean;
  scrapeLinkedin: boolean;
  verifyWhatsapp: boolean;
  aiAnalysis: boolean;
}

const DEFAULT_CONFIG: Record<string, ContextConfig> = {
  email_composer: { scrapeWebsite: true, scrapeLinkedin: true, verifyWhatsapp: false, aiAnalysis: true },
  cockpit: { scrapeWebsite: true, scrapeLinkedin: true, verifyWhatsapp: true, aiAnalysis: true },
  contacts: { scrapeWebsite: false, scrapeLinkedin: true, verifyWhatsapp: false, aiAnalysis: false },
  bca: { scrapeWebsite: false, scrapeLinkedin: true, verifyWhatsapp: true, aiAnalysis: false },
};

const CONTEXT_LABELS: Record<string, { label: string; description: string; icon: LucideIcon }> = {
  email_composer: { label: "Email Composer", description: "Quando generi email con l'Oracolo", icon: Mail },
  cockpit: { label: "Cockpit", description: "Quando prepari messaggi dal Cockpit", icon: LayoutDashboard },
  contacts: { label: "Contatti", description: "Arricchimento nella sezione contatti", icon: Users },
  bca: { label: "Biglietti da Visita", description: "Arricchimento BCA", icon: CreditCard },
};

const OPTIONS = [
  { key: "scrapeWebsite" as const, label: "Scrape sito web", icon: Globe, description: "Analizza il sito aziendale del partner" },
  { key: "scrapeLinkedin" as const, label: "Scrape LinkedIn", icon: Linkedin, description: "Analizza il profilo LinkedIn (se URL presente)" },
  { key: "verifyWhatsapp" as const, label: "Verifica WhatsApp", icon: Phone, description: "Controlla se il numero è su WhatsApp" },
  { key: "aiAnalysis" as const, label: "Analisi AI profilo", icon: Brain, description: "Genera un briefing AI sul partner" },
];

export function DeepSearchConfig() {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [config, setConfig] = useState<Record<string, ContextConfig>>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.deep_search_config) {
      try {
        const parsed = JSON.parse(settings.deep_search_config);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      } catch (e) { log.debug("fallback used", { error: e instanceof Error ? e.message : String(e) }); /* use defaults */ }
    }
  }, [settings?.deep_search_config]);

  const handleToggle = (context: string, option: keyof ContextConfig) => {
    setConfig(prev => ({
      ...prev,
      [context]: { ...prev[context], [option]: !prev[context][option] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "deep_search_config", value: JSON.stringify(config) });
      toast.success("Configurazione Deep Search salvata");
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
    finally { setSaving(false); }
  };

  const activeCount = (ctx: ContextConfig) => Object.values(ctx).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Configura quali operazioni di deep search eseguire per ogni contesto dell'app.
        </p>
        <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salva
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(CONTEXT_LABELS).map(([key, meta]) => (
          <Card key={key}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <meta.icon className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">{meta.label}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-[10px]">{activeCount(config[key])} / 4</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{meta.description}</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {OPTIONS.map(opt => (
                <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={config[key]?.[opt.key] ?? false}
                    onCheckedChange={() => handleToggle(key, opt.key)}
                  />
                  <opt.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs">{opt.label}</span>
                    <p className="text-[9px] text-muted-foreground">{opt.description}</p>
                  </div>
                </label>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
