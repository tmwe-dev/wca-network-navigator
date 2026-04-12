import type { MissionStepProps } from "./types";

export function ChannelStep({ data, onChange }: MissionStepProps) {
  const channels = [
    { key: "email" as const, label: "📧 Email", desc: "Comunicazione formale e tracciabile" },
    { key: "whatsapp" as const, label: "💬 WhatsApp", desc: "Messaggistica diretta e veloce" },
    { key: "linkedin" as const, label: "🔗 LinkedIn", desc: "Networking professionale" },
    { key: "mix" as const, label: "🔄 Mix", desc: "Combina più canali in sequenza" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {channels.map(ch => (
        <button key={ch.key} onClick={() => onChange({ ...data, channel: ch.key })}
          className={`p-4 rounded-xl border text-left transition-all ${
            data.channel === ch.key ? "bg-primary/10 border-primary ring-1 ring-primary/30" : "bg-muted/30 border-border hover:border-primary/50"
          }`}>
          <div className="text-sm font-medium">{ch.label}</div>
          <div className="text-xs text-muted-foreground mt-1">{ch.desc}</div>
        </button>
      ))}
    </div>
  );
}
