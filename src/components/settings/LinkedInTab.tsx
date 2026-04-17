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
import { downloadLinkedInExtensionZip } from "@/lib/whatsappExtensionZip";
import { ExtensionDownloadCatalog } from "@/components/settings/ExtensionDownloadCatalog";

const log = createLogger("LinkedInTab");

interface LinkedInTabProps {
  liHasCreds: boolean;
  liEmail: string;
  setLiEmail: (v: string) => void;
  liPass: string;
  setLiPass: (v: string) => void;
  liAtCookie: string;
  setLiAtCookie: (v: string) => void;
  updateSetting: { mutateAsync: (params: { key: string; value: string }) => Promise<unknown> };
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
          <Linkedin className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">LinkedIn</h2>
        </div>
        <Badge variant={liHasCreds ? "default" : "secondary"}>
          {liHasCreds ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Configurato</> : "Non configurato"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
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
                {showLiPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            {savingLiCreds ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salva Credenziali LinkedIn
          </Button>
        </CardContent>
      </Card>

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          ⚙️ Avanzate (estensione Chrome, cookie li_at manuale)
        </summary>
        <div className="mt-3 space-y-3">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <Button className="w-full" size="sm" variant="outline" onClick={async () => {
                try {
                  await downloadLinkedInExtensionZip();
                  toast.success("LinkedIn extension scaricata!");
                } catch (e) {
                  log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
                  toast.error("File non disponibile");
                }
              }}>
                <Download className="mr-2 h-4 w-4" /> Scarica Estensione LinkedIn
              </Button>
              <ExtensionDownloadCatalog channel="linkedin" />
              <p className="text-center text-[11px] text-muted-foreground">
                Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <KeyRound className="h-5 w-5 text-primary" />
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
                    {showLiAt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                {savingLi ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salva Cookie LinkedIn
              </Button>
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}
