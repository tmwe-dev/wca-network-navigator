import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, Globe, FlaskConical, Plus } from "lucide-react";
import { useNetworkConfigs, type NetworkConfig } from "@/hooks/useNetworkConfigs";
import { scrapeWcaPartnerById } from "@/lib/api/wcaScraper";
import { toast } from "@/hooks/use-toast";

export function NetworkAnalysis() {
  const { data: configs, isLoading, updateConfig, addNetwork } = useNetworkConfigs();
  const [testing, setTesting] = useState<string | null>(null);
  const [newNetwork, setNewNetwork] = useState("");

  const handleToggleMember = (config: NetworkConfig) => {
    updateConfig.mutate({ id: config.id, is_member: !config.is_member });
  };

  const handleSampleTest = async (config: NetworkConfig) => {
    setTesting(config.id);
    try {
      // Test 3 sample IDs to check data visibility
      const sampleIds = [11470, 11471, 11472];
      let hasEmails = false;
      let hasNames = false;
      let hasPhones = false;

      for (const id of sampleIds) {
        const result = await scrapeWcaPartnerById(id);
        if (result.success && result.found && result.partner) {
          if (result.partner.email) hasEmails = true;
          if (result.partner.contacts?.some(c => c.name && c.name !== c.title)) hasNames = true;
          if (result.partner.contacts?.some(c => c.email)) {
            hasEmails = true;
            hasNames = true;
          }
          if (result.partner.phone) hasPhones = true;
        }
      }

      updateConfig.mutate({
        id: config.id,
        has_contact_emails: hasEmails,
        has_contact_names: hasNames,
        has_contact_phones: hasPhones,
        sample_tested_at: new Date().toISOString(),
      });

      toast({
        title: "Test completato",
        description: `Email: ${hasEmails ? "Sì" : "No"} | Nomi: ${hasNames ? "Sì" : "No"} | Telefoni: ${hasPhones ? "Sì" : "No"}`,
      });
    } catch (err) {
      toast({ title: "Errore nel test", description: String(err), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  const handleAddNetwork = () => {
    if (newNetwork.trim()) {
      addNetwork.mutate(newNetwork.trim());
      setNewNetwork("");
    }
  };

  const StatusIcon = ({ value }: { value: boolean }) =>
    value ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-muted-foreground/40" />
    );

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Network di Appartenenza
          </CardTitle>
          <CardDescription>
            Seleziona i network a cui appartieni e verifica la visibilità dei dati di contatto con un test a campione.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Network list */}
          <div className="space-y-3">
            {configs?.map((config) => (
              <div
                key={config.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={config.is_member}
                    onCheckedChange={() => handleToggleMember(config)}
                  />
                  <div>
                    <p className="font-medium text-sm">{config.network_name}</p>
                    {config.sample_tested_at && (
                      <p className="text-xs text-muted-foreground">
                        Testato: {new Date(config.sample_tested_at).toLocaleDateString("it-IT")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {config.sample_tested_at && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <StatusIcon value={config.has_contact_emails} />
                        <span className="text-xs">Email</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusIcon value={config.has_contact_names} />
                        <span className="text-xs">Nomi</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <StatusIcon value={config.has_contact_phones} />
                        <span className="text-xs">Telefoni</span>
                      </div>
                    </div>
                  )}

                  {config.is_member && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSampleTest(config)}
                      disabled={testing !== null}
                    >
                      {testing === config.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FlaskConical className="w-4 h-4" />
                      )}
                      <span className="ml-1">Test</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new network */}
          <div className="flex gap-2 pt-2">
            <Input
              placeholder="Aggiungi network..."
              value={newNetwork}
              onChange={(e) => setNewNetwork(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddNetwork()}
            />
            <Button variant="outline" size="icon" onClick={handleAddNetwork} disabled={!newNetwork.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary of member networks */}
      {configs && configs.filter(c => c.is_member).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Riepilogo Accesso Dati</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {configs.filter(c => c.is_member).map((c) => (
                <Badge
                  key={c.id}
                  variant={c.has_contact_emails && c.has_contact_names ? "default" : "secondary"}
                >
                  {c.network_name}
                  {c.sample_tested_at && (
                    <span className="ml-1">
                      {c.has_contact_emails && c.has_contact_names ? "✓" : "⚠"}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
