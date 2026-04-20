/**
 * MultichannelTimingPanel — Configura finestra oraria e delay random per LinkedIn e WhatsApp bulk
 */
import * as React from "react";
import { useSettingsV2, useUpdateSettingV2 } from "@/v2/hooks/useSettingsV2";
import { Button } from "../../atoms/Button";
import { toast } from "sonner";
import { parseTimingFromSettings, estimateBatchDuration } from "@/lib/multichannelTiming";

interface ChannelFormState {
  startHour: string;
  endHour: string;
  minDelay: string;
  maxDelay: string;
}

function ChannelSection({
  title, color, channel, state, setState, onSave, saving,
}: {
  title: string;
  color: string;
  channel: "linkedin" | "whatsapp";
  state: ChannelFormState;
  setState: (s: ChannelFormState) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const cfg = parseTimingFromSettings(
    {
      [`${channel}_send_start_hour`]: state.startHour,
      [`${channel}_send_end_hour`]: state.endHour,
      [`${channel}_min_delay_seconds`]: state.minDelay,
      [`${channel}_max_delay_seconds`]: state.maxDelay,
    },
    channel,
  );
  const preview50 = estimateBatchDuration(50, cfg);
  const preview10 = estimateBatchDuration(10, cfg);

  return (
    <div className="space-y-3 max-w-lg border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Inizio invii (ora)</label>
          <input
            type="number" min={0} max={23}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.startHour}
            onChange={(e) => setState({ ...state, startHour: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Fine invii (ora)</label>
          <input
            type="number" min={1} max={23}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.endHour}
            onChange={(e) => setState({ ...state, endHour: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Delay min (sec)</label>
          <input
            type="number" min={1}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.minDelay}
            onChange={(e) => setState({ ...state, minDelay: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Delay max (sec)</label>
          <input
            type="number" min={1}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={state.maxDelay}
            onChange={(e) => setState({ ...state, maxDelay: e.target.value })}
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 space-y-0.5">
        <div>📊 Preview 10 messaggi → ultimo invio: <span className="font-medium text-foreground">{preview10.humanLabel}</span></div>
        <div>📊 Preview 50 messaggi → ultimo invio: <span className="font-medium text-foreground">{preview50.humanLabel}</span></div>
      </div>
      <Button onClick={onSave} isLoading={saving} variant="primary">Salva timing {title}</Button>
    </div>
  );
}

export function MultichannelTimingPanel(): React.ReactElement {
  const { data: settings } = useSettingsV2();
  const updateSetting = useUpdateSettingV2();

  const [li, setLi] = React.useState<ChannelFormState>({ startHour: "9", endHour: "19", minDelay: "45", maxDelay: "180" });
  const [wa, setWa] = React.useState<ChannelFormState>({ startHour: "8", endHour: "21", minDelay: "4", maxDelay: "12" });

  React.useEffect(() => {
    if (!settings) return;
    setLi({
      startHour: settings.linkedin_send_start_hour ?? "9",
      endHour: settings.linkedin_send_end_hour ?? "19",
      minDelay: settings.linkedin_min_delay_seconds ?? "45",
      maxDelay: settings.linkedin_max_delay_seconds ?? "180",
    });
    setWa({
      startHour: settings.whatsapp_send_start_hour ?? "8",
      endHour: settings.whatsapp_send_end_hour ?? "21",
      minDelay: settings.whatsapp_min_delay_seconds ?? "4",
      maxDelay: settings.whatsapp_max_delay_seconds ?? "12",
    });
  }, [settings]);

  const saveChannel = async (channel: "linkedin" | "whatsapp", s: ChannelFormState) => {
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: `${channel}_send_start_hour`, value: s.startHour }),
        updateSetting.mutateAsync({ key: `${channel}_send_end_hour`, value: s.endHour }),
        updateSetting.mutateAsync({ key: `${channel}_min_delay_seconds`, value: s.minDelay }),
        updateSetting.mutateAsync({ key: `${channel}_max_delay_seconds`, value: s.maxDelay }),
      ]);
      toast.success(`Timing ${channel} salvato`);
    } catch {
      toast.error("Errore nel salvataggio");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Timing invii multichannel</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configura finestra oraria e delay random tra invii bulk. Default conservativi per ridurre rischio TOS.
          I messaggi fuori finestra vengono spostati automaticamente al giorno successivo.
        </p>
      </div>
      <ChannelSection
        title="LinkedIn"
        color="#0A66C2"
        channel="linkedin"
        state={li}
        setState={setLi}
        onSave={() => saveChannel("linkedin", li)}
        saving={updateSetting.isPending}
      />
      <ChannelSection
        title="WhatsApp"
        color="#25D366"
        channel="whatsapp"
        state={wa}
        setState={setWa}
        onSave={() => saveChannel("whatsapp", wa)}
        saving={updateSetting.isPending}
      />
    </div>
  );
}
