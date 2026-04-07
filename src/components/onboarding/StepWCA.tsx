import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Globe, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface StepWCAProps {
  wcaUsername: string;
  wcaPassword: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepWCA({ onNext, onSkip }: StepWCAProps) {
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");

  const handleTest = async () => {
    setTesting(true);
    setStatus("idle");
    try {
      const res = await fetch("https://wca-app.vercel.app/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json();
      if (data.success && data.cookies) {
        setStatus("ok");
        try {
          localStorage.setItem("wca_session_cookie", JSON.stringify({ cookie: data.cookies, savedAt: Date.now() }));
        } catch { /* storage full or unavailable */ }
      } else {
        setStatus("fail");
      }
    } catch {
      setStatus("fail");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Globe className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Connessione WCA</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Il login WCA è gestito automaticamente dal server.
          Verifica la connessione per assicurarti che tutto funzioni.
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
          <span className="text-sm">🤖 Claude Engine V8 — Login automatico server-side</span>
        </div>

        <Button onClick={handleTest} disabled={testing} variant="outline" className="w-full">
          {testing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verificando...</>
          ) : status === "ok" ? (
            <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Connessione OK</>
          ) : status === "fail" ? (
            <><XCircle className="w-4 h-4 mr-2 text-red-500" /> Errore — Riprova</>
          ) : (
            <><Globe className="w-4 h-4 mr-2" /> Verifica Connessione</>
          )}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Salta per ora
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continua
        </Button>
      </div>
    </div>
  );
}
