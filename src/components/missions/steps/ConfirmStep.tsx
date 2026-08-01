import { Badge } from "@/components/ui/badge";
import type { MissionStepProps } from "./types";

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium capitalize">{value}</div>
    </div>
  );
}

export function ConfirmStep({ data }: MissionStepProps) {
  const totalContacts = data.batching?.batches.reduce((s, b) => s + b.count, 0) || 0;
  const channelLabel = { email: "📧 Email", whatsapp: "💬 WhatsApp", linkedin: "🔗 LinkedIn", mix: "🔄 Mix" };
  const scheduleLabel = { immediate: "⚡ Subito", scheduled: "📅 Programmato", distributed: "📊 Distribuito" };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">Rivedi la configurazione completa della missione:</p>
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard label="Paesi" value={`${data.targets?.countries?.length || 0}`} />
        <SummaryCard label="Contatti" value={`${totalContacts}`} />
        <SummaryCard label="Canale" value={data.channel ? channelLabel[data.channel] : "—"} />
        <SummaryCard label="Scheduling" value={data.schedule ? scheduleLabel[data.schedule] : "—"} />
        <SummaryCard label="Deep Search" value={data.deepSearch?.enabled ? "✅ Attivo" : "❌ No"} />
        <SummaryCard label="Qualità" value={data.toneConfig?.quality === "premium" ? "💎 Premium" : data.toneConfig?.quality === "fast" ? "⚡ Rapida" : "✨ Standard"} />
        <SummaryCard label="Tono" value={data.toneConfig?.tone || "professionale"} />
        <SummaryCard label="Lingua" value={data.toneConfig?.language === "auto" ? "🌍 Auto" : data.toneConfig?.language || "auto"} />
      </div>

      {data.communication && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Comunicazione</div>
          <div className="text-sm">
            {data.communication.templateMode === "ai_generate" && "🤖 AI genera in tempo reale"}
            {data.communication.templateMode === "preset" && `📋 ${data.communication.emailType || "Tipo email selezionato"}`}
            {data.communication.templateMode === "custom" && `✏️ Modello personalizzato: "${data.communication.customSubject || "..."}"`}
          </div>
        </div>
      )}

      {data.attachments && (data.attachments.templateIds.length > 0 || data.attachments.imageIds.length > 0 || data.attachments.links.length > 0) && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Allegati</div>
          <div className="flex gap-3 text-xs">
            {data.attachments.templateIds.length > 0 && <span>📎 {data.attachments.templateIds.length} documenti</span>}
            {data.attachments.imageIds.length > 0 && <span>🖼️ {data.attachments.imageIds.length} immagini</span>}
            {data.attachments.links.length > 0 && <span>🔗 {data.attachments.links.length} link</span>}
          </div>
        </div>
      )}

      {data.agents && data.agents.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Agenti assegnati</div>
          <div className="flex gap-2 flex-wrap">
            {data.agents.map(a => <Badge key={a.agentId} variant="secondary">{a.agentName}</Badge>)}
          </div>
        </div>
      )}

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-primary">
        Crediti stimati: ~{totalContacts * (data.toneConfig?.quality === "premium" ? 15 : data.toneConfig?.quality === "fast" ? 3 : 8)} crediti
      </div>
    </div>
  );
}
