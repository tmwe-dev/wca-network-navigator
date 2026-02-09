import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, EyeOff, Globe, Shield, CheckCircle2, Loader2 } from "lucide-react";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "sonner";

export default function Settings() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateSetting();

  const [wcaUsername, setWcaUsername] = useState("");
  const [wcaPassword, setWcaPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setWcaUsername(settings["wca_username"] || "");
      setWcaPassword(settings["wca_password"] || "");
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "wca_username", value: wcaUsername });
      await updateSetting.mutateAsync({ key: "wca_password", value: wcaPassword });
      toast.success("Credenziali WCA salvate con successo");
    } catch (err) {
      toast.error("Errore nel salvataggio delle credenziali");
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!settings?.["wca_username"] && !!settings?.["wca_password"];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-muted-foreground mt-1">Configurazione della piattaforma</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Credenziali WCA World</CardTitle>
                <CardDescription>
                  Utilizzate per accedere ai dati completi dei partner (email, telefoni, contatti)
                </CardDescription>
              </div>
            </div>
            {isConfigured ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Configurato
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-amber-600">
                Non configurato
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wca-username">Username WCA</Label>
            <Input
              id="wca-username"
              value={wcaUsername}
              onChange={(e) => setWcaUsername(e.target.value)}
              placeholder="Il tuo username WCA"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wca-password">Password WCA</Label>
            <div className="relative">
              <Input
                id="wca-password"
                type={showPassword ? "text" : "password"}
                value={wcaPassword}
                onChange={(e) => setWcaPassword(e.target.value)}
                placeholder="La tua password WCA"
                autoComplete="off"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              Le credenziali sono salvate in modo sicuro nel database
            </div>
            <Button onClick={handleSave} disabled={saving || !wcaUsername || !wcaPassword}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salva Credenziali
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
