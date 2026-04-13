import * as React from "react";
import { useTranslation } from "react-i18next";
import { useAlertConfig } from "@/hooks/useAlertConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, TestTube2 } from "lucide-react";
import { toast } from "sonner";

export function AlertConfigPanel() {
  const { t } = useTranslation();
  const { config, isLoading, updateConfig, testWebhook } = useAlertConfig();

  const [webhookUrl, setWebhookUrl] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [cooldown, setCooldown] = React.useState("15");

  React.useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhook_url || "");
      setEnabled(config.enabled);
      setCooldown(String(config.cooldown_minutes));
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate(
      { webhook_url: webhookUrl || null, enabled, cooldown_minutes: parseInt(cooldown) },
      {
        onSuccess: () => toast.success(t("common.success")),
        onError: () => toast.error(t("errors.saveFailed")),
      },
    );
  };

  const handleTest = () => {
    if (!webhookUrl) return;
    testWebhook.mutate(webhookUrl, {
      onSuccess: () => toast.success("Test alert inviato!"),
      onError: () => toast.error("Webhook non raggiungibile"),
    });
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4" />
          Alert Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="alert-enabled" className="text-sm">Alerting attivo</Label>
          <Switch id="alert-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Webhook URL (Slack / Discord)</Label>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!webhookUrl || testWebhook.isPending}
              aria-label="Test webhook"
            >
              <TestTube2 className="h-3.5 w-3.5 mr-1" />
              Test
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Cooldown tra alert</Label>
          <Select value={cooldown} onValueChange={setCooldown}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 minuti</SelectItem>
              <SelectItem value="15">15 minuti</SelectItem>
              <SelectItem value="30">30 minuti</SelectItem>
              <SelectItem value="60">1 ora</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={updateConfig.isPending} className="w-full">
          {t("common.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
