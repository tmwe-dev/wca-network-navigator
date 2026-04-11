import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Save, Loader2, CheckCircle2, Download, KeyRound, Eye, EyeOff, Mail, Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("LinkedInTab");

interface LinkedInTabProps {
  liHasCreds: boolean;
  liEmail: string;
  setLiEmail: (v: string) => void;
  liPass: string;
  setLiPass: (v: string) => void;
  liAtCookie: string;
  setLiAtCookie: (v: string) => void;
  updateSetting: any;
}

export function LinkedInTab({
  liHasCreds, liEmail, setLiEmail, liPass, setLiPass,
  liAtCookie, setLiAtCookie, updateSetting,
}: LinkedInTabProps) {
  const [showLiPass, setShowLiPass] = useState(false);
  const [savingLiCreds, setSavingLiCreds] = useState(false);
  const [showLiAt, setShowLiAt] = useState(false);
  const [savingLi, setSavingLi] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Linkedin className="w-5 h-5 text-[#0A66C2]" />
          <h2 className="text-lg font-semibold">LinkedIn</h2>
        </div>
        <Badge variant={liHasCreds ? "default" : "secondary"} className={liHasCreds ? "bg-primary text-primary-foreground" : ""}>
          {liHasCreds ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#0A66C2]/10">
              <Mail className="w-5 h-5 text-[#0A66C2]" />
            </div>
            <div>
              <CardTitle className="text-base">Credenziali LinkedIn</CardTitle>
              <CardDescription>Email e password per l'auto-login dell'estensione</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email LinkedIn</Label>
            <Input value={liEmail} onChange={(e) => setLiEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Password LinkedIn</Label>
            <div className="relative">
              <Input type={showLiPass ? "text" : "password"} value={liPass} onChange={(e) => setLiPass(e.target.value)} placeholder="••••••••" className="pr-10" />
              <button type="button" onClick={() => setShowLiPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showLiPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            onClick={async () => {
              setSavingLiCreds(true);
              try {
                await updateSetting.mutateAsync({ key: "linkedin_email", value: liEmail.trim() });
                await updateSetting.mutateAsync({ key: "linkedin_password", value: liPass.trim() });
                toast.success("Credenziali LinkedIn salvate!");
              } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
              finally { setSavingLiCreds(false); }
            }}
            disabled={savingLiCreds || !liEmail.trim() || !liPass.trim()}
          >
            {savingLiCreds ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva Credenziali LinkedIn
          </Button>
        </CardContent>
      </Card>

      <details className="group">
        <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
          ⚙️ Avanzate (estensione Chrome, cookie li_at manuale)
        </summary>
        <div className="mt-3 space-y-3">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button className="w-full" size="sm" variant="outline" onClick={() => {
                fetch("/linkedin-extension.zip")
                  .then(r => { if (!r.ok) throw new Error("Download failed"); return r.blob(); })
                  .then(blob => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "linkedin-extension.zip"; a.click(); URL.revokeObjectURL(a.href); })
                  .catch(() => toast.error("File non disponibile"));
              }}>
                <Download className="w-4 h-4 mr-2" /> Scarica Estensione LinkedIn
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#0A66C2]/10">
                  <KeyRound className="w-5 h-5 text-[#0A66C2]" />
                </div>
                <div>
                  <CardTitle className="text-base">Cookie di Sessione (li_at)</CardTitle>
                  <CardDescription>Inserimento manuale del cookie per la Deep Search</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Cookie li_at</Label>
                <div className="relative">
                  <Input
                    type={showLiAt ? "text" : "password"}
                    value={liAtCookie}
                    onChange={(e) => setLiAtCookie(e.target.value)}
                    placeholder="AQEDAx..."
                    className="pr-10 font-mono text-xs"
                  />
                  <button type="button" onClick={() => setShowLiAt((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showLiAt ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                onClick={async () => {
                  if (!liAtCookie.trim()) return;
                  setSavingLi(true);
                  try {
                    await updateSetting.mutateAsync({ key: "linkedin_li_at", value: liAtCookie.trim() });
                    toast.success("Cookie LinkedIn salvato!");
                  } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
                  finally { setSavingLi(false); }
                }}
                disabled={savingLi || !liAtCookie.trim()}
              >
                {savingLi ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva Cookie LinkedIn
              </Button>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}
