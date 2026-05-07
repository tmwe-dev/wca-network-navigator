import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, Globe, RefreshCw, ExternalLink,
  ClipboardPaste, XCircle, KeyRound,
} from "lucide-react";

interface WcaTabProps {
  isWcaOk: boolean;
  verifying: boolean;
  onVerify: () => void;
  cookieInput: string;
  setCookieInput: (v: string) => void;
  savingCookie: boolean;
  onSaveCookie: () => void;
}

export function WcaTab({ isWcaOk, verifying, onVerify, cookieInput, setCookieInput, savingCookie, onSaveCookie }: WcaTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Connessione WCA World</h2>
        </div>
        <Badge variant={isWcaOk ? "default" : "destructive"} className={isWcaOk ? "bg-primary text-primary-foreground" : ""}>
          {isWcaOk ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Connesso</> : <><XCircle className="w-3 h-3 mr-1" /> Non connesso</>}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <KeyRound className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Login Automatico WCA</CardTitle>
                <CardDescription>Connessione gestita da Claude Engine V8 via wca-app</CardDescription>
              </div>
            </div>
            <Badge variant={isWcaOk ? "default" : "secondary"} className={isWcaOk ? "bg-emerald-600 text-white" : ""}>
              {isWcaOk ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Automatico</> : "Da verificare"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Le credenziali WCA sono gestite automaticamente lato server. Non devi inserire username o password.
            Il sistema effettua il login SSO tramite <code className="font-mono bg-muted px-1 rounded text-xs">wca-app.vercel.app</code>.
          </p>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-sm">🤖</span>
            <span className="text-xs text-amber-700 dark:text-amber-300">Claude Engine V8 — Login server-side, cache 8 min</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Button onClick={onVerify} disabled={verifying} variant="outline" className="w-full">
            {verifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {verifying ? "Verifica..." : "Verifica Sessione"}
          </Button>
        </CardContent>
      </Card>

      <details className="group">
        <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          ⚙️ Avanzate (cookie manuale, link diretto)
        </summary>
        <div className="mt-3 space-y-3">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Button className="w-full" variant="outline" size="sm" onClick={() => window.open("https://www.wcaworld.com/MemberSection", "_blank")}>
                <ExternalLink className="w-4 h-4 mr-2" /> Apri WCA World
              </Button>
              <div className="flex gap-2">
                <Input placeholder="Incolla header Cookie completo..." value={cookieInput} onChange={(e) => setCookieInput(e.target.value)} className="font-mono text-xs" />
                <Button onClick={onSaveCookie} disabled={savingCookie || !cookieInput.trim()} size="sm" className="shrink-0">
                  {savingCookie ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Emergenza: F12 → Network → Headers → Cookie → incolla qui.</p>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}
