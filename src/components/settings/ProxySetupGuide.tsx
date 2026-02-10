import { Button } from "@/components/ui/button";
import { ExternalLink, Terminal, Copy, CheckCircle2, Circle, Loader2, Wifi } from "lucide-react";
import { toast } from "sonner";

interface ProxySetupGuideProps {
  isProxyOnline: boolean;
  hasCredentials: boolean;
  hasCookie: boolean;
  autoLogging: boolean;
  onAutoLogin: () => void;
}

export function ProxySetupGuide({
  isProxyOnline,
  hasCredentials,
  hasCookie,
  autoLogging,
  onAutoLogin,
}: ProxySetupGuideProps) {
  const step1Done = true; // Script file is assumed present
  const step2Done = isProxyOnline;
  const step3Done = hasCredentials;
  const step4Done = hasCookie;

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast.success("Comando copiato!");
  };

  return (
    <div className="rounded-lg border bg-background p-4 space-y-4">
      <p className="font-semibold text-sm">🚀 Configurazione rapida — segui questi passi nell'ordine:</p>

      {/* Step 1 */}
      <div className="flex items-start gap-3">
        <StepIcon done={step1Done} number={1} />
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium">Apri il Terminale sul tuo Mac</p>
          <p className="text-xs text-muted-foreground">
            Cerca "Terminale" in Spotlight (<kbd className="px-1 py-0.5 rounded bg-muted font-mono text-xs">⌘ + Spazio</kbd>) oppure vai in Applicazioni → Utility → Terminale
          </p>
        </div>
      </div>

      {/* Step 2 */}
      <div className="flex items-start gap-3">
        <StepIcon done={step2Done} number={2} />
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium">Avvia il proxy locale</p>
          <p className="text-xs text-muted-foreground">
            Copia e incolla questo comando nel Terminale, poi premi <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-xs">Invio</kbd>:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-muted font-mono text-xs select-all">
              cd ~/Desktop/mixer && python3 wca-auth-proxy.py
            </code>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => copyCommand("cd ~/Desktop/mixer && python3 wca-auth-proxy.py")}
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${isProxyOnline ? 'bg-emerald-500' : 'bg-destructive'}`} />
            <span className={`text-xs ${isProxyOnline ? 'text-emerald-600' : 'text-destructive'}`}>
              {isProxyOnline ? '✓ Proxy connesso e funzionante' : 'In attesa del proxy... (avvia il comando sopra)'}
            </span>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="flex items-start gap-3">
        <StepIcon done={step3Done} number={3} />
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-medium">Inserisci le credenziali WCA</p>
          <p className="text-xs text-muted-foreground">
            Compila i campi <strong>Username</strong> e <strong>Password</strong> nella sezione sopra e clicca <strong>"Salva Credenziali"</strong>.
            {!hasCredentials && (
              <> Non hai un account? <a href="https://www.wcaworld.com/Account/Register" target="_blank" rel="noopener" className="text-primary underline inline-flex items-center gap-0.5">Registrati su WCA World <ExternalLink className="w-3 h-3" /></a></>
            )}
          </p>
        </div>
      </div>

      {/* Step 4 */}
      <div className="flex items-start gap-3">
        <StepIcon done={step4Done} number={4} />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">Ottieni il cookie di sessione</p>
          <p className="text-xs text-muted-foreground">
            Clicca il bottone qui sotto. Il sistema farà login su WCA e salverà il cookie automaticamente.
          </p>
          <Button
            onClick={onAutoLogin}
            disabled={autoLogging || !hasCredentials || !isProxyOnline}
            className="w-full"
            size="sm"
          >
            {autoLogging ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4 mr-2" />
            )}
            {autoLogging
              ? "Login in corso..."
              : !isProxyOnline
              ? "⬆ Avvia prima il proxy (passo 2)"
              : !hasCredentials
              ? "⬆ Salva prima le credenziali (passo 3)"
              : "Ottieni Cookie Automaticamente"}
          </Button>
        </div>
      </div>

      {/* Fallback manuale */}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
          ⚙️ Metodo manuale (se il proxy non funziona)
        </summary>
        <ol className="list-decimal list-inside space-y-1 mt-2 pl-1">
          <li>
            Apri{" "}
            <a href="https://www.wcaworld.com/Account/Login" target="_blank" rel="noopener" className="text-primary underline">
              wcaworld.com
            </a>{" "}
            e fai login
          </li>
          <li>
            Premi <kbd className="px-1 py-0.5 rounded bg-muted font-mono">F12</kbd> → scheda{" "}
            <strong>Application</strong> (o Applicazione)
          </li>
          <li>
            Nel menu a sinistra, espandi <strong>Cookies</strong> → clicca su <strong>www.wcaworld.com</strong>
          </li>
          <li>
            Cerca la riga <code className="px-1 py-0.5 rounded bg-muted font-mono">.ASPXAUTH</code> e copia il <strong>Value</strong>
          </li>
          <li>Incollalo nel campo "Cookie completo" qui sotto nel formato: <code className="px-1 py-0.5 rounded bg-muted font-mono">.ASPXAUTH=valore_copiato</code></li>
        </ol>
        <p className="mt-1 text-amber-600">⚠️ Il cookie scade periodicamente — ripeti se il resync non trova email/telefoni</p>
      </details>
    </div>
  );
}

function StepIcon({ done, number }: { done: boolean; number: number }) {
  return done ? (
    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
  ) : (
    <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mt-0.5 shrink-0">
      <span className="text-[10px] font-bold text-muted-foreground">{number}</span>
    </div>
  );
}
