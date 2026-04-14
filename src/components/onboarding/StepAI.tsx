import { Button } from "@/components/ui/button";
import { Cpu, Sparkles, Zap, Shield } from "lucide-react";

interface StepAIProps {
  apiKeys: Record<string, string>;
  onApiKeyChange: (provider: string, key: string) => void;
  onFinish: () => void;
  onSkip: () => void;
  loading?: boolean;
}

export function StepAI({ onFinish, loading }: StepAIProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Cpu className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Intelligenza Artificiale</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Il sistema AI è già configurato e pronto all'uso. Nessuna configurazione necessaria.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border bg-accent/30 p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Multi-modello integrato</p>
            <p className="text-muted-foreground text-xs mt-1">
              GPT-5, Gemini, Grok e altri modelli disponibili — tutto incluso nel sistema, senza configurare chiavi API.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-accent/30 p-4 flex items-start gap-3">
          <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Crediti inclusi</p>
            <p className="text-muted-foreground text-xs mt-1">
              100 crediti gratuiti per iniziare. I crediti vengono scalati ad ogni operazione AI.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-accent/30 p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Chiavi API personalizzate</p>
            <p className="text-muted-foreground text-xs mt-1">
              Puoi aggiungere le tue chiavi API nelle <strong>Impostazioni → AI</strong> per usare i tuoi account provider senza limiti di crediti.
            </p>
          </div>
        </div>
      </div>

      <Button onClick={onFinish} className="w-full" disabled={loading}>
        {loading ? "Salvataggio..." : "Continua"}
      </Button>
    </div>
  );
}
