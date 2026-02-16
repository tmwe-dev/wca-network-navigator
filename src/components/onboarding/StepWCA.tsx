import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { KeyRound, ExternalLink, Eye, EyeOff } from "lucide-react";

interface StepWCAProps {
  wcaUsername: string;
  wcaPassword: string;
  onUsernameChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function StepWCA({ wcaUsername, wcaPassword, onUsernameChange, onPasswordChange, onNext, onSkip }: StepWCAProps) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <KeyRound className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Credenziali WCA</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Inserisci le credenziali del tuo account WCA per accedere alla directory e scaricare i contatti dei tuoi network
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Username WCA</Label>
          <Input
            value={wcaUsername}
            onChange={e => onUsernameChange(e.target.value)}
            placeholder="Il tuo username WCA"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Password WCA</Label>
          <div className="relative mt-1">
            <Input
              type={showPw ? "text" : "password"}
              value={wcaPassword}
              onChange={e => onPasswordChange(e.target.value)}
              placeholder="La tua password WCA"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <a
          href="https://www.wcaworld.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" /> Non hai un account WCA? Registrati qui
        </a>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1">
          Salta per ora
        </Button>
        <Button onClick={onNext} className="flex-1" disabled={!wcaUsername.trim() || !wcaPassword.trim()}>
          Continua
        </Button>
      </div>
    </div>
  );
}
