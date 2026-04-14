import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Loader2, CheckCircle2, FileText, Download, KeyRound, Package } from "lucide-react";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";

const log = createLogger("RASettings");

interface RASettingsProps {
  settings: Record<string, string> | undefined;
  updateSetting: (key: string, value: string) => void;
}

export function RASettings({ settings, updateSetting }: RASettingsProps) {
  const [raUser, setRaUser] = useState(settings?.["ra_username"] || "");
  const [raPass, setRaPass] = useState(settings?.["ra_password"] || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setRaUser(settings["ra_username"] || "");
      setRaPass(settings["ra_password"] || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "ra_username", value: raUser.trim() });
      await updateSetting.mutateAsync({ key: "ra_password", value: raPass.trim() });
      toast.success("Credenziali Report Aziende salvate!");
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast.error("Errore nel salvataggio"); }
    finally { setSaving(false); }
  };

  const hasCredentials = !!(settings?.["ra_username"] && settings?.["ra_password"]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Report Aziende</h2>
        </div>
        <Badge variant={hasCredentials ? "default" : "secondary"} className={hasCredentials ? "bg-primary text-primary-foreground" : ""}>
          {hasCredentials ? <><CheckCircle2 className="w-3 h-3 mr-1" /> Configurato</> : "Non configurato"}
        </Badge>
      </div>

      <Tabs defaultValue="credenziali" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="credenziali" className="gap-1.5 text-xs">
            <KeyRound className="w-3.5 h-3.5" /> Credenziali
          </TabsTrigger>
          <TabsTrigger value="estensione" className="gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5" /> Estensione
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credenziali" className="m-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Credenziali di accesso</CardTitle>
              <CardDescription>Username e password per reportaziende.it</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Username / Email</Label>
                <Input value={raUser} onChange={(e) => setRaUser(e.target.value)} placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={raPass} onChange={(e) => setRaPass(e.target.value)} placeholder="••••••••" />
              </div>
              <Button onClick={handleSave} disabled={saving || !raUser.trim() || !raPass.trim()}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva Credenziali
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estensione" className="m-0">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  Scarica l'estensione Chrome per ReportAziende, installala e clicca <strong>"🚀 Connetti"</strong>.
                </p>
              </div>
              <Button className="w-full" size="lg" onClick={() => window.open("/download-ra-extension.html", "_blank")}>
                <Download className="w-4 h-4 mr-2" /> Scarica Estensione RA
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Chrome → chrome://extensions/ → Modalità sviluppatore → Carica estensione non pacchettizzata
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
