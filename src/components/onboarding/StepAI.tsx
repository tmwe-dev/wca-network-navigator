import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Cpu, ExternalLink, ChevronDown, Check, Eye, EyeOff, Coins } from "lucide-react";

interface StepAIProps {
  apiKeys: Record<string, string>;
  onApiKeyChange: (provider: string, key: string) => void;
  onFinish: () => void;
  onSkip: () => void;
  loading?: boolean;
}

const AI_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4, GPT-5 e modelli avanzati per analisi e generazione testo",
    link: "https://platform.openai.com/api-keys",
    linkLabel: "Ottieni API Key da OpenAI",
  },
  {
    id: "google",
    name: "Google AI (Gemini)",
    description: "Modelli Gemini per ragionamento multimodale e contesti lunghi",
    link: "https://aistudio.google.com/apikey",
    linkLabel: "Ottieni API Key da Google AI Studio",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    description: "Claude per analisi precise, sicure e approfondite",
    link: "https://console.anthropic.com/settings/keys",
    linkLabel: "Ottieni API Key da Anthropic",
  },
];

export function StepAI({ apiKeys, onApiKeyChange, onFinish, onSkip, loading }: StepAIProps) {
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const configuredCount = Object.values(apiKeys).filter(k => k.trim()).length;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Cpu className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Configurazione AI</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Porta le tue API key per usare l'intelligenza artificiale senza limiti.
          Oppure usa i <strong>crediti inclusi</strong> nel tuo account.
        </p>
      </div>

      <div className="rounded-lg border bg-accent/30 p-3 flex items-center gap-3">
        <Coins className="w-5 h-5 text-primary shrink-0" />
        <div className="text-xs">
          <p className="font-medium text-foreground">100 crediti gratuiti inclusi</p>
          <p className="text-muted-foreground">Puoi iniziare subito senza configurare nessuna chiave API. I crediti verranno scalati ad ogni operazione AI.</p>
        </div>
      </div>

      <div className="space-y-2">
        {AI_PROVIDERS.map(provider => {
          const hasKey = !!apiKeys[provider.id]?.trim();
          return (
            <Collapsible key={provider.id}>
              <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left">
                <div className="flex items-center gap-2">
                  {hasKey ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className="text-sm font-medium text-foreground">{provider.name}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-2">
                <p className="text-xs text-muted-foreground">{provider.description}</p>
                <div className="relative">
                  <Input
                    type={showKeys[provider.id] ? "text" : "password"}
                    value={apiKeys[provider.id] || ""}
                    onChange={e => onApiKeyChange(provider.id, e.target.value)}
                    placeholder={`sk-... o simile`}
                    className="pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys(p => ({ ...p, [provider.id]: !p[provider.id] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <a
                  href={provider.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> {provider.linkLabel}
                </a>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1" disabled={loading}>
          Usa solo crediti
        </Button>
        <Button onClick={onFinish} className="flex-1" disabled={loading}>
          {loading ? "Salvataggio..." : configuredCount > 0 ? `Salva ${configuredCount} chiav${configuredCount > 1 ? 'i' : 'e'} e inizia` : "Inizia"}
        </Button>
      </div>
    </div>
  );
}
