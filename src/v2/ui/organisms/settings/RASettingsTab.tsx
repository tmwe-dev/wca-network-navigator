/**
 * RASettingsTab — Report Aziende credentials
 */
import * as React from "react";
import { useState } from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { FormSection } from "../../organisms/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function RASettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const currentUser = settings?.["ra_username"] ?? "";
  const hasPassword = !!settings?.["ra_password"];

  const handleSave = () => {
    if (username) updateSetting.mutate({ key: "ra_username", value: username });
    if (password) updateSetting.mutate({ key: "ra_password", value: password });
    toast.success("Credenziali RA salvate");
  };

  return (
    <div className="space-y-6">
      <FormSection title="Report Aziende" description="Credenziali per l'accesso al network RA.">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Username</Label>
            <Input
              value={username || currentUser}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username RA"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={hasPassword ? "••••••••" : "Password RA"}
            />
          </div>
          <Button onClick={handleSave} disabled={updateSetting.isPending}>
            Salva credenziali
          </Button>
        </div>
      </FormSection>
    </div>
  );
}
