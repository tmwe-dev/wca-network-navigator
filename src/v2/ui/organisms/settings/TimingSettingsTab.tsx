/**
 * TimingSettingsTab — Agent schedule configuration
 */
import * as React from "react";
import { useState } from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { FormSection } from "../../organisms/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock } from "lucide-react";
import { toast } from "sonner";

export function TimingSettingsTab(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();

  const workStart = settings?.["agent_work_start"] ?? "08";
  const workEnd = settings?.["agent_work_end"] ?? "18";
  const maxActions = settings?.["agent_max_actions_per_cycle"] ?? "10";

  const [localStart, setLocalStart] = useState("");
  const [localEnd, setLocalEnd] = useState("");
  const [localMax, setLocalMax] = useState("");

  const handleSave = () => {
    if (localStart) updateSetting.mutate({ key: "agent_work_start", value: localStart });
    if (localEnd) updateSetting.mutate({ key: "agent_work_end", value: localEnd });
    if (localMax) updateSetting.mutate({ key: "agent_max_actions_per_cycle", value: localMax });
    toast.success("Timing salvato");
  };

  return (
    <div className="space-y-6">
      <FormSection title="Timing & Schedule" description="Orari operativi e limiti degli agenti AI.">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
            <Clock className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              Finestra operativa attuale: <strong>{workStart}:00 – {workEnd}:00</strong> · Max {maxActions} azioni/ciclo
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Inizio (ora)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={localStart || workStart}
                onChange={(e) => setLocalStart(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Fine (ora)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={localEnd || workEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max azioni/ciclo</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={localMax || maxActions}
                onChange={(e) => setLocalMax(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={updateSetting.isPending}>
            Salva configurazione
          </Button>
        </div>
      </FormSection>
    </div>
  );
}
